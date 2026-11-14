import { NextResponse } from 'next/server'
import { admin, appUrl, currentOwner } from '@/lib/gmail/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const owner = await currentOwner()
  if (!owner) return NextResponse.json({ connected: false }, { status: 401 })
  try {
    const db = admin()
    const { data, error } = await db.from('gmail_connections').select('email,enabled,last_synced_at,last_error,watch_expires_at,connected_at').eq('user_id', owner.userId).eq('couple_id', owner.coupleId).maybeSingle()
    if (error) throw error
    const { data: notifications, error: listError } = await db.from('gmail_card_notifications').select('message_id,provider,amount,merchant,used_at,kind,reason,expense_id').eq('user_id', owner.userId).eq('couple_id', owner.coupleId).order('created_at', { ascending: false }).limit(10)
    if (listError) throw listError
    const { count: reviewCount, error: countError } = await db.from('gmail_card_notifications').select('message_id', { count: 'exact', head: true }).eq('user_id', owner.userId).eq('couple_id', owner.coupleId).eq('kind', 'review')
    if (countError) throw countError
    const watching = !!(data?.watch_expires_at && new Date(data.watch_expires_at).getTime() > Date.now() && process.env.GMAIL_PUSH_AUDIENCE && process.env.GMAIL_PUSH_SERVICE_ACCOUNT)
    return NextResponse.json({ connected: !!data?.enabled, watching, oauthTesting: process.env.GMAIL_OAUTH_TESTING !== 'false', connection: data, notifications: notifications ?? [], reviewCount: reviewCount ?? 0 }, { headers: { 'Cache-Control': 'no-store' } })
  } catch { return NextResponse.json({ error: '連携状態を取得できませんでした' }, { status: 503 }) }
}

export async function DELETE(request: Request) {
  if (request.headers.get('origin') !== appUrl()) return new Response('Forbidden', { status: 403 })
  const owner = await currentOwner()
  if (!owner) return new Response('Unauthorized', { status: 401 })
  const { error } = await admin().from('gmail_connections').update({ enabled: false, refresh_token_encrypted: '', history_id: null, watch_expires_at: null }).eq('user_id', owner.userId)
  if (error) return NextResponse.json({ error: '連携解除に失敗しました' }, { status: 503 })
  return NextResponse.json({ connected: false })
}
