import { createHash, randomBytes } from 'node:crypto'
import { NextResponse } from 'next/server'
import { appUrl, currentOwner, GMAIL_SCOPE, oauthClient } from '@/lib/gmail/server'
import { required } from '@/lib/gmail/secrets'

export async function POST(request: Request) {
  if (request.headers.get('origin') !== appUrl()) return new Response('Forbidden', { status: 403 })
  const owner = await currentOwner()
  if (!owner) return NextResponse.json({ error: 'ログインとペア設定が必要です' }, { status: 401 })
  try {
    required('GMAIL_TOKEN_ENCRYPTION_KEY')
    const state = randomBytes(32).toString('base64url')
    const verifier = randomBytes(48).toString('base64url')
    const url = oauthClient().generateAuthUrl({
      scope: [GMAIL_SCOPE], access_type: 'offline', prompt: 'consent', state,
      code_challenge: createHash('sha256').update(verifier).digest('base64url'),
      code_challenge_method: 'S256' as import('google-auth-library').CodeChallengeMethod,
    })
    const response = NextResponse.redirect(url, 303)
    response.cookies.set('gmail_oauth', JSON.stringify({ state, verifier, userId: owner.userId, coupleId: owner.coupleId }), { httpOnly: true, secure: appUrl().startsWith('https:'), sameSite: 'lax', path: '/api/integrations/gmail', maxAge: 600 })
    return response
  } catch {
    return NextResponse.json({ error: 'Gmail連携の設定が完了していません' }, { status: 503 })
  }
}
