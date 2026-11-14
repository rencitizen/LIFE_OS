import { OAuth2Client } from 'google-auth-library'
import { admin, syncConnection, type Connection } from '@/lib/gmail/server'
import { required } from '@/lib/gmail/secrets'

export const maxDuration = 60
const verifier = new OAuth2Client()

export async function POST(request: Request) {
  try {
    const bearer = request.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1]
    if (!bearer) return new Response('Unauthorized', { status: 401 })
    const ticket = await verifier.verifyIdToken({ idToken: bearer, audience: required('GMAIL_PUSH_AUDIENCE') })
    const claims = ticket.getPayload()
    if (claims?.email !== required('GMAIL_PUSH_SERVICE_ACCOUNT') || claims.email_verified !== true) return new Response('Forbidden', { status: 403 })
  } catch { return new Response('Unauthorized', { status: 401 }) }
  let email: string
  try {
    const raw = await request.text()
    if (Buffer.byteLength(raw) > 64_000) return new Response('Too large', { status: 413 })
    const envelope = JSON.parse(raw)
    const data = JSON.parse(Buffer.from(envelope.message.data, 'base64').toString('utf8'))
    if (typeof data.emailAddress !== 'string' || !/^\d+$/.test(data.historyId)) throw new Error('Invalid event')
    email = data.emailAddress.toLowerCase()
  } catch { return new Response('Invalid event', { status: 400 }) }
  const { data, error } = await admin().from('gmail_connections').select('*').eq('email', email).eq('enabled', true).maybeSingle()
  if (error) return new Response('Retry', { status: 503 })
  if (!data) return new Response(null, { status: 204 })
  try { await syncConnection(data as Connection); return new Response(null, { status: 204 }) }
  catch { return new Response('Retry', { status: 503 }) }
}
