import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

function logoutResponse(request: NextRequest) {
  const url = request.nextUrl.clone()
  url.pathname = '/admin/login'
  const res = NextResponse.redirect(url)
  res.cookies.set('admin_authorized', '', { path: '/', maxAge: 0 })
  return res
}

export async function POST(request: NextRequest) {
  return logoutResponse(request)
}

export async function GET(request: NextRequest) {
  return logoutResponse(request)
}
