import { NextResponse } from 'next/server'
import { admin, appUrl, currentOwner, syncConnection, type Connection } from '@/lib/gmail/server'

export const maxDuration = 60

export async function POST(request: Request) {
  if (request.headers.get('origin') !== appUrl()) return new Response('Forbidden', { status: 403 })
  const owner = await currentOwner()
  if (!owner) return new Response('Unauthorized', { status: 401 })
  const { data, error } = await admin().from('gmail_connections').select('*').eq('user_id', owner.userId).eq('couple_id', owner.coupleId).eq('enabled', true).single()
  if (error || !data) return NextResponse.json({ error: 'Gmailとの連携が必要です' }, { status: 409 })
  try { return NextResponse.json(await syncConnection(data as Connection, true)) }
  catch { return NextResponse.json({ error: '同期できませんでした。Googleとの連携状態を確認してください。' }, { status: 503 }) }
}
