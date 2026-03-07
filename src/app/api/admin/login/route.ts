import { NextResponse } from 'next/server'

/**
 * POST /api/admin/login
 * Body: { key: string }. Ha key === ADMIN_API_KEY, beállítja az admin cookie-t.
 */
export async function POST(request: Request) {
  const adminKey = process.env.ADMIN_API_KEY
  if (!adminKey) {
    return NextResponse.json({ error: 'Admin not configured' }, { status: 503 })
  }
  const body = await request.json().catch(() => ({}))
  const key = typeof body?.key === 'string' ? body.key : ''
  if (key !== adminKey) {
    return NextResponse.json({ error: 'Invalid key' }, { status: 401 })
  }
  const res = NextResponse.json({ ok: true })
  res.cookies.set('admin_authorized', '1', {
    path: '/',
    maxAge: 60 * 60 * 24,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  })
  return res
}
