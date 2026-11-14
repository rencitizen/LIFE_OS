import { NextResponse } from 'next/server'
import { admin, syncConnection, type Connection } from '@/lib/gmail/server'
import { equalSecret, required } from '@/lib/gmail/secrets'

export const maxDuration = 60

export async function GET(request: Request) {
  if (!equalSecret(request.headers.get('authorization') ?? '', `Bearer ${required('CRON_SECRET')}`)) return new Response('Unauthorized', { status: 401 })
  const { data, error } = await admin().from('gmail_connections').select('*').eq('enabled', true).limit(10)
  if (error) return new Response('Retry', { status: 503 })
  const results = await Promise.allSettled((data as Connection[]).map(connection => syncConnection(connection)))
  const failed = results.filter(result => result.status === 'rejected').length
  return NextResponse.json({ synced: results.length - failed, failed }, { status: failed ? 503 : 200 })
}
