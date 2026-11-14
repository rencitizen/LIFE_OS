import 'server-only'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { OAuth2Client } from 'google-auth-library'
import { createClient } from '@/lib/supabase/server'
import { decryptToken, encryptToken, required } from './secrets'
import {
  cardMailQuery,
  CARD_PARSER_VERSION,
  RETRYABLE_PARSE_REASONS,
  VIEWCARD_SENDER,
  notificationProvider,
  parseCardNotifications,
  type GmailMessage,
} from './notifications'

export const GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly'
export const CALLBACK_PATH = '/api/integrations/gmail/callback'

export function appUrl() {
  const url = new URL(required('NEXT_PUBLIC_APP_URL'))
  if (
    url.protocol !== 'https:' &&
    !(url.protocol === 'http:' && url.hostname === 'localhost')
  )
    throw new Error('Invalid app URL')
  return url.origin
}

export function oauthClient() {
  return new OAuth2Client(
    required('GOOGLE_GMAIL_CLIENT_ID'),
    required('GOOGLE_GMAIL_CLIENT_SECRET'),
    `${appUrl()}${CALLBACK_PATH}`
  )
}

export function admin() {
  return createSupabaseClient(
    required('NEXT_PUBLIC_SUPABASE_URL'),
    required('SUPABASE_SERVICE_ROLE_KEY'),
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

export async function currentOwner() {
  const db = await createClient()
  const {
    data: { user },
  } = await db.auth.getUser()
  if (!user) return null
  const { data, error } = await db
    .from('users')
    .select('id,couple_id')
    .eq('id', user.id)
    .single()
  if (error || !data?.couple_id) return null
  return { userId: user.id, coupleId: data.couple_id }
}

export type Connection = {
  user_id: string
  couple_id: string
  email: string
  refresh_token_encrypted: string
  connected_at: string
  history_id: string | null
  watch_expires_at: string | null
  enabled: boolean
}

export class GmailError extends Error {
  constructor(public status: number) {
    super('Gmail request failed')
  }
}

export async function gmail<T>(
  client: OAuth2Client,
  path: string,
  init?: RequestInit
): Promise<T> {
  const { token } = await client.getAccessToken()
  if (!token) throw new Error('No access token')
  const response = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/${path}`,
    {
      ...init,
      headers: { ...init?.headers, Authorization: `Bearer ${token}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(20_000),
    }
  )
  if (!response.ok) throw new GmailError(response.status)
  return response.json() as Promise<T>
}

export async function saveConnection(
  owner: { userId: string; coupleId: string },
  email: string,
  token: string,
  historyId: string
) {
  const db = admin()
  const { data: previous, error: previousError } = await db
    .from('gmail_connections')
    .select('email,enabled,connected_at,history_id,couple_id')
    .eq('user_id', owner.userId)
    .maybeSingle()
  if (previousError) throw new Error('Unable to check connection')
  const continuing =
    previous?.enabled &&
    previous.email === email.toLowerCase() &&
    previous.couple_id === owner.coupleId
  const { data, error } = await db
    .from('gmail_connections')
    .upsert(
      {
        user_id: owner.userId,
        couple_id: owner.coupleId,
        email: email.toLowerCase(),
        refresh_token_encrypted: encryptToken(token, owner.userId),
        enabled: true,
        connected_at: continuing
          ? previous.connected_at
          : new Date().toISOString(),
        history_id: continuing ? previous.history_id : historyId,
        watch_expires_at: null,
        last_error: null,
      },
      { onConflict: 'user_id' }
    )
    .select('*')
    .single()
  if (error) throw new Error('Unable to save connection')
  return data as Connection
}

export async function syncConnection(connection: Connection, scanRecentViewCard = false) {
  const db = admin()
  const { data: owner, error: ownerError } = await db
    .from('users')
    .select('couple_id')
    .eq('id', connection.user_id)
    .single()
  if (
    ownerError ||
    owner?.couple_id !== connection.couple_id ||
    !connection.enabled
  )
    throw new Error('Connection owner changed')
  const client = oauthClient()
  client.setCredentials({
    refresh_token: decryptToken(
      connection.refresh_token_encrypted,
      connection.user_id
    ),
  })
  const ids = new Set<string>()
  let historyId = connection.history_id
  try {
    let fullSync = !historyId
    if (historyId) {
      try {
        const startHistoryId = historyId
        let page = ''
        do {
          const params = new URLSearchParams({
            startHistoryId,
            historyTypes: 'messageAdded',
            maxResults: '100',
          })
          if (page) params.set('pageToken', page)
          const result = await gmail<{
            history?: { messagesAdded?: { message: { id: string } }[] }[]
            historyId: string
            nextPageToken?: string
          }>(client, `history?${params}`)
          for (const event of result.history ?? [])
            for (const item of event.messagesAdded ?? [])
              ids.add(item.message.id)
          historyId = result.historyId
          page = result.nextPageToken ?? ''
          if (ids.size > 500)
            throw new Error('Sync backlog requires manual recovery')
        } while (page)
      } catch (error) {
        if (!(error instanceof GmailError) || error.status !== 404) throw error
        fullSync = true
      }
    }
    if (fullSync) {
      // Capture a cursor BEFORE listing so messages arriving during the scan are
      // handled again on the next run instead of skipped.
      historyId = (await gmail<{ historyId: string }>(client, 'profile'))
        .historyId
      let page = ''
      do {
        const params = new URLSearchParams({
          q: cardMailQuery(connection.connected_at),
          maxResults: '100',
        })
        if (page) params.set('pageToken', page)
        const result = await gmail<{
          messages?: { id: string }[]
          nextPageToken?: string
        }>(client, `messages?${params}`)
        for (const message of result.messages ?? []) ids.add(message.id)
        page = result.nextPageToken ?? ''
        if (ids.size > 500)
          throw new Error('Sync backlog requires manual recovery')
      } while (page)
    }
    if (scanRecentViewCard && !fullSync) {
      // Existing history cursors can already be past mail from the newly supported sender.
      const after = Math.max(new Date(connection.connected_at).getTime(), Date.now() - 30 * 86400_000)
      let page = ''
      do {
        const params = new URLSearchParams({
          q: `after:${Math.floor(after / 1000)} from:${VIEWCARD_SENDER}`,
          maxResults: '100',
        })
        if (page) params.set('pageToken', page)
        const result = await gmail<{ messages?: { id: string }[]; nextPageToken?: string }>(
          client, `messages?${params}`
        )
        for (const message of result.messages ?? []) ids.add(message.id)
        page = result.nextPageToken ?? ''
        if (ids.size > 500) throw new Error('Sync backlog requires manual recovery')
      } while (page)
    }
    // Retry only parse failures once per parser release. Purchase receipts whose
    // expense was deleted are deliberately excluded; so are flash/cancellation.
    const { data: retryRows, error: retryError } = await db
      .from('gmail_card_notifications')
      .select('message_id')
      .eq('email', connection.email)
      .eq('user_id', connection.user_id)
      .eq('couple_id', connection.couple_id)
      .eq('kind', 'review')
      .gte('created_at', connection.connected_at)
      .is('expense_id', null)
      .lt('parser_version', CARD_PARSER_VERSION)
      .in('reason', [...RETRYABLE_PARSE_REASONS])
      .order('created_at', { ascending: true })
      .limit(25)
    if (retryError) throw new Error('Unable to list parse retries')
    const retryIds = new Set((retryRows ?? []).map(row => row.message_id.split('#')[0]))
    for (const id of retryIds) {
      if (!/^[A-Za-z0-9_-]{1,100}$/.test(id)) throw new Error('Invalid retry message ID')
      ids.add(id)
    }
    let processed = 0
    for (const id of ids) {
      const { data: existing, error: existingError } = await db
        .from('gmail_card_notifications')
        .select('message_id,kind,reason,expense_id,parser_version')
        .eq('email', connection.email)
        .eq('message_id', id)
        .maybeSingle()
      if (existingError) throw new Error('Unable to check notification')
      if (existing && !(
        existing.kind === 'review' && existing.expense_id === null &&
        existing.parser_version < CARD_PARSER_VERSION &&
        RETRYABLE_PARSE_REASONS.some(reason => reason === existing.reason)
      )) continue
      let message: GmailMessage
      try {
        const metadata = await gmail<GmailMessage>(
          client,
          `messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Authentication-Results`
        )
        if (!notificationProvider(metadata)) {
          if (retryIds.has(id)) throw new Error('Retry sender authentication failed')
          continue
        }
        message = await gmail<GmailMessage>(
          client,
          `messages/${id}?format=full`
        )
      } catch (error) {
        if (error instanceof GmailError && error.status === 404) {
          if (retryIds.has(id)) {
            const { error: missingError } = await db.from('gmail_card_notifications')
              .update({ parser_version: CARD_PARSER_VERSION })
              .eq('email', connection.email).eq('user_id', connection.user_id)
              .eq('kind', 'review').is('expense_id', null)
              .or(`message_id.eq.${id},message_id.like.${id}#%`)
            if (missingError) throw new Error('Unable to record missing retry')
          }
          continue
        }
        throw error
      }
      if (
        Number(message.internalDate) <
        new Date(connection.connected_at).getTime()
      )
        continue
      const notifications = parseCardNotifications(message)
      if (!notifications.length) continue
      const { error } = await db.rpc('ingest_gmail_card_notifications', {
        p_user_id: connection.user_id,
        p_email: connection.email,
        p_message_id: id,
        p_notifications: notifications.map(row => ({ ...row, parserVersion: CARD_PARSER_VERSION })),
      })
      if (error) throw new Error('Unable to save notification')
      processed++
    }
    const watchTopic = process.env.GMAIL_PUBSUB_TOPIC
    let watchExpiresAt = connection.watch_expires_at
    if (
      watchTopic &&
      (!watchExpiresAt ||
        new Date(watchExpiresAt).getTime() < Date.now() + 2 * 86400_000)
    ) {
      const watch = await gmail<{ expiration: string }>(client, 'watch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topicName: watchTopic }),
      })
      watchExpiresAt = new Date(Number(watch.expiration)).toISOString()
    }
    // Compare-and-swap: a late concurrent sync must never move a newer cursor
    // backwards. Inserts themselves are atomic/idempotent in the database.
    let update = db
      .from('gmail_connections')
      .update({
        history_id: historyId,
        watch_expires_at: watchExpiresAt,
        last_synced_at: new Date().toISOString(),
        last_error: null,
      })
      .eq('user_id', connection.user_id)
      .eq('connected_at', connection.connected_at)
    update = connection.history_id
      ? update.eq('history_id', connection.history_id)
      : update.is('history_id', null)
    const { error } = await update
    if (error) throw new Error('Unable to save sync cursor')
    return { processed }
  } catch {
    await db
      .from('gmail_connections')
      .update({
        last_error:
          '同期に失敗しました。Googleとの連携状態を確認してください。',
      })
      .eq('user_id', connection.user_id)
      .eq('connected_at', connection.connected_at)
    throw new Error('Gmail sync failed')
  }
}
