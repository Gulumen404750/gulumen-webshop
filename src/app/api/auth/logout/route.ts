import { NextResponse } from 'next/server'
import { getClearSessionCookieHeader } from '@/lib/auth'

export async function POST() {
  const response = NextResponse.json({ ok: true })
  response.headers.set('Set-Cookie', getClearSessionCookieHeader())
  return response
}
