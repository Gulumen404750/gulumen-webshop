import '@/lib/bootstrap-auth-env'
import NextAuth from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'
import { bootstrapAuthEnv, resolveNextAuthUrl } from '@/lib/bootstrap-auth-env'
import { getAuthOptions } from '@/lib/auth-options'

/** Never statically prerender – auth must read runtime Railway env. */
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type NextAuthCtx = { params: Promise<{ nextauth: string[] }> }

function copySetCookies(from: Response, to: NextResponse): void {
  const setCookies =
    typeof from.headers.getSetCookie === 'function' ? from.headers.getSetCookie() : []
  for (const raw of setCookies) {
    to.headers.append('Set-Cookie', raw)
  }
}

/**
 * GET /api/auth/signin/:provider – auto-submit POST forma (CSRF + OAuth indítás).
 * A szerveroldali szintetikus POST nem működik App Routerben (next/headers cookie-k).
 */
async function handleProviderSignInGet(req: NextRequest): Promise<NextResponse | null> {
  const url = req.nextUrl
  const segments = url.pathname.replace(/\/$/, '').split('/')
  const providerId = segments[segments.length - 1]
  const parentSegment = segments[segments.length - 2]

  if (parentSegment !== 'signin' || !providerId || providerId === 'signin') return null

  const authOrigin = resolveNextAuthUrl()
  const csrfReq = new NextRequest(new URL('/api/auth/csrf', authOrigin), {
    method: 'GET',
    headers: req.headers,
  })
  const options = getAuthOptions()
  const csrfRes = await NextAuth(options)(csrfReq, {
    params: Promise.resolve({ nextauth: ['csrf'] }),
  })

  if (!(csrfRes instanceof Response) || !csrfRes.ok) {
    console.error('[auth-handler] CSRF fetch failed for provider sign-in', {
      providerId,
      status: csrfRes instanceof Response ? csrfRes.status : 'not-a-response',
    })
    return null
  }

  const { csrfToken } = (await csrfRes.json()) as { csrfToken: string }
  const callbackUrl = url.searchParams.get('callbackUrl') ?? `${authOrigin}/profil`
  const postAction = `${authOrigin}/api/auth/signin/${providerId}`

  const html = `<!DOCTYPE html>
<html lang="hu">
<head>
  <meta charset="utf-8" />
  <title>Google bejelentkezés…</title>
</head>
<body>
  <p>Átirányítás a Google bejelentkezéshez…</p>
  <form id="oauth-start" method="POST" action="${postAction}">
    <input type="hidden" name="csrfToken" value="${csrfToken}" />
    <input type="hidden" name="callbackUrl" value="${callbackUrl}" />
  </form>
  <script>document.getElementById('oauth-start').submit()</script>
</body>
</html>`

  console.log('[auth-handler] GET signin → auto-submit POST', { providerId, callbackUrl, postAction })
  const response = new NextResponse(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
  copySetCookies(csrfRes, response)
  return response
}

/** Runtime handler – bootstrap + fresh options every request (NO_SECRET safe). */
async function authHandler(req: NextRequest, ctx: NextAuthCtx) {
  bootstrapAuthEnv()
  const url = req.nextUrl
  if (url.pathname.includes('/api/auth/')) {
    console.log('[auth-handler]', req.method, url.pathname, url.search || '')
  }

  if (req.method === 'GET') {
    try {
      const converted = await handleProviderSignInGet(req)
      if (converted) return converted
    } catch (error) {
      console.error('[auth-handler] provider sign-in GET conversion failed', error)
    }
  }

  const options = getAuthOptions()
  return NextAuth(options)(req, ctx)
}

export { authHandler as GET, authHandler as POST }
