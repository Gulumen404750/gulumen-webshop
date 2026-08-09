import { NextResponse } from 'next/server'
import { getClearSessionCookieHeader } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'

export async function POST(request: Request) {
  const limit = await rateLimit(request, { preset: 'auth' })
  if (!limit.ok) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  const response = NextResponse.json({ ok: true })
  response.headers.set('Set-Cookie', getClearSessionCookieHeader())
  return response
}
