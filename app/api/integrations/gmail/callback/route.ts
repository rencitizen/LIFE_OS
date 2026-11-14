import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { appUrl, currentOwner, gmail, GMAIL_SCOPE, oauthClient, saveConnection, syncConnection } from '@/lib/gmail/server'

export const maxDuration = 60
import { equalSecret } from '@/lib/gmail/secrets'

export async function GET(request: Request) {
  const result = (status: string) => {
    const response = NextResponse.redirect(`${appUrl()}/settings?gmail=${status}`)
    response.cookies.set('gmail_oauth', '', { httpOnly: true, secure: appUrl().startsWith('https:'), sameSite: 'lax', path: '/api/integrations/gmail', maxAge: 0 })
    return response
  }
  try {
    const url = new URL(request.url)
    if (url.searchParams.has('error')) return result('cancelled')
    const value = (await cookies()).get('gmail_oauth')?.value
    if (!value) return result('expired')
    const saved = JSON.parse(value) as { state: string; verifier: string; userId: string; coupleId: string }
    const owner = await currentOwner()
    const code = url.searchParams.get('code')
    if (!owner || owner.userId !== saved.userId || owner.coupleId !== saved.coupleId || !code || !equalSecret(saved.state, url.searchParams.get('state') ?? '')) return result('expired')
    const client = oauthClient()
    const { tokens } = await client.getToken({ code, codeVerifier: saved.verifier })
    if (!tokens.refresh_token || !tokens.scope?.split(' ').includes(GMAIL_SCOPE)) return result('permission')
    client.setCredentials(tokens)
    const profile = await gmail<{ emailAddress: string; historyId: string }>(client, 'profile')
    const connection = await saveConnection(owner, profile.emailAddress, tokens.refresh_token, profile.historyId)
    try { await syncConnection(connection) } catch { return result('connected_pending') }
    return result('connected')
  } catch {
    // Authorization codes, token responses and secrets must never enter logs.
    return result('failed')
  }
}
