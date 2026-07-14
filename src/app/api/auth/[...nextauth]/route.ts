import '@/lib/bootstrap-auth-env'
import NextAuth from 'next-auth'
import { bootstrapAuthEnv } from '@/lib/bootstrap-auth-env'
import { getAuthOptions } from '@/lib/auth-options'

/** Never statically prerender – auth must read runtime Railway env. */
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function mergeCookieHeader(existing: string | null, response: Response): string {
  const parts = existing ? [existing] : []
  const setCookies =
    typeof response.headers.getSetCookie === 'function'
      ? response.headers.getSetCookie()
      : []
  for (const raw of setCookies) {
    const pair = raw.split(';')[0]?.trim()
    if (pair) parts.push(pair)
  }
  return parts.join('; ')
}

/**
 * GET /api/auth/signin/:provider + pages.signIn → NextAuth ?error=<providerId> (pl. error=google).
 * OAuth indításához a GET-et belső POST-ra alakítjuk (CSRF tokennel).
 */
async function maybeConvertProviderSignInGet(
  req: Request,
  ctx: { params: Promise<{ nextauth: string[] }> },
): Promise<Response | null> {
  if (req.method !== 'GET') return null

  const url = new URL(req.url)
  const segments = url.pathname.replace(/\/$/, '').split('/')
  const providerId = segments[segments.length - 1]
  const parentSegment = segments[segments.length - 2]

  if (parentSegment !== 'signin' || !providerId || providerId === 'signin') return null

  const csrfRes = await fetch(new URL('/api/auth/csrf', url.origin), {
    headers: { cookie: req.headers.get('cookie') ?? '' },
  })
  if (!csrfRes.ok) {
    console.error('[auth-handler] CSRF fetch failed for provider sign-in', {
      providerId,
      status: csrfRes.status,
    })
    return null
  }

  const { csrfToken } = (await csrfRes.json()) as { csrfToken: string }
  const callbackUrl = url.searchParams.get('callbackUrl') ?? `${url.origin}/profil`
  const cookie = mergeCookieHeader(req.headers.get('cookie'), csrfRes)

  const postReq = new Request(new URL(`/api/auth/signin/${providerId}`, url.origin), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      cookie,
    },
    body: new URLSearchParams({ csrfToken, callbackUrl }).toString(),
  })

  console.log('[auth-handler] GET signin → POST OAuth start', { providerId, callbackUrl })
  return NextAuth(getAuthOptions())(postReq, ctx)
}

/** Runtime handler – bootstrap + fresh options every request (NO_SECRET safe). */
async function authHandler(req: Request, ctx: { params: Promise<{ nextauth: string[] }> }) {
  bootstrapAuthEnv()
  const url = new URL(req.url)
  if (url.pathname.includes('/api/auth/')) {
    console.log('[auth-handler]', req.method, url.pathname, url.search || '')
  }

  const converted = await maybeConvertProviderSignInGet(req, ctx)
  if (converted) return converted

  const options = getAuthOptions()
  return NextAuth(options)(req, ctx)
}

export { authHandler as GET, authHandler as POST }
