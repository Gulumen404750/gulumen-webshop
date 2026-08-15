import '@/lib/bootstrap-auth-env'
import NextAuth from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'
import { bootstrapAuthEnv, resolveNextAuthUrl } from '@/lib/bootstrap-auth-env'
import { getAuthOptions } from '@/lib/auth-options'
import { CSP_NONCE_HEADER } from '@/lib/admin-security-headers'

/** Never statically prerender – auth must read runtime Railway env. */
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/auth/signin/:provider – böngészőben CSRF lekérés + auto POST.
 * Szerveroldali NextAuth rekurzió App Routerben 500-at okoz.
 */
function handleProviderSignInGet(req: NextRequest): NextResponse | null {
  const url = req.nextUrl
  const segments = url.pathname.replace(/\/$/, '').split('/')
  const providerId = segments[segments.length - 1]
  const parentSegment = segments[segments.length - 2]

  if (parentSegment !== 'signin' || !providerId || providerId === 'signin') return null

  const authOrigin = resolveNextAuthUrl()
  const callbackUrl = url.searchParams.get('callbackUrl') ?? `${authOrigin}/profil`
  const postAction = `${authOrigin}/api/auth/signin/${providerId}`
  const csrfUrl = `${authOrigin}/api/auth/csrf`
  // Middleware állítja az x-nonce-t; production CSP tiltja az unsafe-inline scriptet.
  const nonce = req.headers.get(CSP_NONCE_HEADER)?.trim()
  const nonceAttr = nonce ? ` nonce="${nonce.replace(/"/g, '')}"` : ''

  const html = `<!DOCTYPE html>
<html lang="hu">
<head>
  <meta charset="utf-8" />
  <title>Google bejelentkezés…</title>
</head>
<body>
  <p>Átirányítás a Google bejelentkezéshez…</p>
  <script${nonceAttr}>
    (async function () {
      try {
        const csrfRes = await fetch(${JSON.stringify(csrfUrl)}, { credentials: 'include' });
        if (!csrfRes.ok) throw new Error('CSRF ' + csrfRes.status);
        const { csrfToken } = await csrfRes.json();
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = ${JSON.stringify(postAction)};
        const csrfInput = document.createElement('input');
        csrfInput.type = 'hidden';
        csrfInput.name = 'csrfToken';
        csrfInput.value = csrfToken;
        form.appendChild(csrfInput);
        const cbInput = document.createElement('input');
        cbInput.type = 'hidden';
        cbInput.name = 'callbackUrl';
        cbInput.value = ${JSON.stringify(callbackUrl)};
        form.appendChild(cbInput);
        document.body.appendChild(form);
        form.submit();
      } catch (e) {
        document.body.innerHTML = '<p>Bejelentkezési hiba. <a href="/profil">Vissza a profilhoz</a></p>';
        console.error('OAuth start failed', e);
      }
    })();
  </script>
</body>
</html>`

  console.log('[auth-handler] GET signin → browser auto POST', { providerId, callbackUrl, postAction })
  return new NextResponse(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}

/** Runtime handler – bootstrap + fresh options every request (NO_SECRET safe). */
async function authHandler(req: NextRequest, ctx: { params: Promise<{ nextauth: string[] }> }) {
  bootstrapAuthEnv()
  const url = req.nextUrl
  if (url.pathname.includes('/api/auth/')) {
    console.log('[auth-handler]', req.method, url.pathname, url.search || '')
  }

  if (req.method === 'GET') {
    const converted = handleProviderSignInGet(req)
    if (converted) return converted
  }

  const options = getAuthOptions()
  return NextAuth(options)(req, ctx)
}

export { authHandler as GET, authHandler as POST }
