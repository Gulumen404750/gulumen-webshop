import { NextResponse } from 'next/server'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { isDbConfigured } from '@/lib/prisma'
import { createSession, getSessionCookieHeader, isJwtConfigured } from '@/lib/auth'
import { devVerifyUser } from '@/lib/dev-auth'
import { findUserByEmail, normalizeEmail } from '@/lib/user-email'
import { rateLimit } from '@/lib/rate-limit'
import {
  loginRateLimitCheck,
  loginRateLimitRecordFailure,
  loginRateLimitRecordSuccess,
} from '@/lib/login-rate-limit'
import { getClientIp } from '@/lib/request-ip'
import { RECAPTCHA_ACTIONS, verifyRecaptchaToken } from '@/lib/recaptcha'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  captchaToken: z.string().max(4000).optional(),
})

export async function POST(request: Request) {
  if (!isJwtConfigured()) {
    return NextResponse.json({ error: 'Auth not configured' }, { status: 503 })
  }

  const ipLimit = await rateLimit(request, { preset: 'auth' })
  if (!ipLimit.ok) {
    return NextResponse.json(
      { error: 'Too many requests. Try again later.' },
      { status: 429 }
    )
  }

  const limit = await loginRateLimitCheck(request)
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
  const { email, password, captchaToken } = parsed.data
  const emailNorm = normalizeEmail(email)

  const captcha = await verifyRecaptchaToken({
    token: captchaToken,
    action: RECAPTCHA_ACTIONS.login,
    ip: getClientIp(request),
  })
  if (!captcha.ok) {
    return NextResponse.json({ error: captcha.error }, { status: 400 })
  }

  if (isDbConfigured()) {
    const user = await findUserByEmail(emailNorm)
    if (!user) {
      await loginRateLimitRecordFailure(request)
      return NextResponse.json(
        { error: 'Hibás e-mail vagy jelszó' },
        { status: 401 }
      )
    }
    if (!user.passwordHash) {
      await loginRateLimitRecordFailure(request)
      return NextResponse.json(
        { error: 'Ehhez a fiókhoz Google-lel jelentkezz be.' },
        { status: 401 }
      )
    }

    const ok = await bcrypt.compare(password, user.passwordHash)
    if (!ok) {
      await loginRateLimitRecordFailure(request)
      return NextResponse.json(
        { error: 'Hibás e-mail vagy jelszó' },
        { status: 401 }
      )
    }

    await loginRateLimitRecordSuccess(request)
    const token = await createSession(user.id, user.email)
    const response = NextResponse.json({
      user: { id: user.id, email: user.email, name: user.name },
    })
    response.headers.set('Set-Cookie', getSessionCookieHeader(token))
    return response
  }

  const devUser = await devVerifyUser(emailNorm, password)
  if (!devUser) {
    await loginRateLimitRecordFailure(request)
    return NextResponse.json(
      { error: 'Hibás e-mail vagy jelszó' },
      { status: 401 }
    )
  }

  await loginRateLimitRecordSuccess(request)
  const token = await createSession(devUser.id, devUser.email)
  const response = NextResponse.json({
    user: { id: devUser.id, email: devUser.email, name: devUser.name },
    devMode: true,
  })
  response.headers.set('Set-Cookie', getSessionCookieHeader(token))
  return response
}
