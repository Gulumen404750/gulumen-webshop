import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { ADMIN_COOKIE_NAME, getAdminCookieOptions } from '@/lib/admin-session'

function logoutResponse(request: NextRequest) {
  const url = request.nextUrl.clone()
  url.pathname = '/admin/login'
  const res = NextResponse.redirect(url)
  res.cookies.set(ADMIN_COOKIE_NAME, '', { ...getAdminCookieOptions(0), maxAge: 0 })
  return res
}

export async function POST(request: NextRequest) {
  return logoutResponse(request)
}

export async function GET(request: NextRequest) {
  return logoutResponse(request)
}
