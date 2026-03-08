import { NextResponse } from 'next/server'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { prisma, isDbConfigured } from '@/lib/prisma'
import { createSession, getSessionCookieHeader, isJwtConfigured } from '@/lib/auth'
import {
  loginRateLimitCheck,
  loginRateLimitRecordFailure,
  loginRateLimitRecordSuccess,
} from '@/lib/login-rate-limit'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export async function POST(request: Request) {
  if (!isDbConfigured() || !isJwtConfigured()) {
    return NextResponse.json({ error: 'Auth not configured' }, { status: 503 })
  }

  const limit = loginRateLimitCheck(request)
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Too many login attempts. Try again later.' },
      { status: 429 }
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const parsed = loginSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    )
  }
  const { email, password } = parsed.data
  const emailNorm = email.trim().toLowerCase()

  const user = await prisma.user.findUnique({ where: { email: emailNorm } })
  if (!user) {
    loginRateLimitRecordFailure(request)
    return NextResponse.json(
      { error: 'Hibás e-mail vagy jelszó' },
      { status: 401 }
    )
  }
  if (!user.passwordHash) {
    loginRateLimitRecordFailure(request)
    return NextResponse.json(
      { error: 'Ehhez a fiókhoz Google-lel jelentkezz be.' },
      { status: 401 }
    )
  }

  const ok = await bcrypt.compare(password, user.passwordHash)
  if (!ok) {
    loginRateLimitRecordFailure(request)
    return NextResponse.json(
      { error: 'Hibás e-mail vagy jelszó' },
      { status: 401 }
    )
  }

  loginRateLimitRecordSuccess(request)
  const token = await createSession(user.id, user.email)
  const response = NextResponse.json({
    user: { id: user.id, email: user.email, name: user.name },
  })
  response.headers.set('Set-Cookie', getSessionCookieHeader(token))
  return response
}
