import { NextResponse } from 'next/server'
import { unsubscribeByToken } from '@/lib/marketing-consent'

/** GET /api/newsletter/unsubscribe?token=... – csak marketing hozzájárulást von vissza. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token')?.trim() ?? ''
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://gulumen.hu'

  if (!token) {
    return new NextResponse(htmlPage('Érvénytelen leiratkozási link.', false), {
      status: 400,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }

  const result = await unsubscribeByToken(token)
  if (!result.ok) {
    return new NextResponse(htmlPage('A leiratkozási link érvénytelen vagy lejárt.', false), {
      status: 404,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }

  return new NextResponse(
    htmlPage(
      `Sikeresen leiratkoztál a marketing / hírlevél üzenetekről${result.email ? ` (${result.email})` : ''}. A rendelési e-maileket továbbra is megkapod.`,
      true,
      appUrl
    ),
    { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  )
}

function htmlPage(message: string, ok: boolean, appUrl?: string): string {
  return `<!DOCTYPE html>
<html lang="hu">
<head><meta charset="utf-8"><title>Hírlevél leiratkozás – Gulumen</title>
<style>body{font-family:system-ui,sans-serif;max-width:480px;margin:40px auto;padding:0 16px;line-height:1.5}h1{font-size:1.25rem}a{color:#0d9488}</style>
</head>
<body>
  <h1>${ok ? 'Leiratkozás kész' : 'Hiba'}</h1>
  <p>${escapeHtml(message)}</p>
  ${appUrl ? `<p><a href="${appUrl}">Vissza a webshopba</a></p>` : ''}
</body>
</html>`
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
