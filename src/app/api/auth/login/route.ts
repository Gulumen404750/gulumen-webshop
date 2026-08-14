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
import {
  clearUserLockout,
  getUserLockoutStatus,
  recordUserLoginFailure,
  tooManyLoginAttemptsResponse,
} from '@/lib/account-lockout'
import { getClientIp } from '@/lib/request-ip'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

function tooManyResponse(opts?: { locked?: boolean; retryAfterSec?: number }) {
  const payload = tooManyLoginAttemptsResponse(opts)
  return NextResponse.json(payload.body, { status: payload.status, headers: payload.headers })
}

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
    return tooManyResponse()
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
  const emailNorm = normalizeEmail(email)
  const ip = getClientIp(request)
  const userAgent = request.headers.get('user-agent')

  if (isDbConfigured()) {
    const user = await findUserByEmail(emailNorm)
    if (user) {
      const lock = getUserLockoutStatus(user)
      if (lock.locked) {
        return tooManyResponse({ locked: true, retryAfterSec: lock.retryAfterSec })
      }
    }
    if (!user) {
      await loginRateLimitRecordFailure(request)
      return NextResponse.json(
        { error: 'Hibás e-mail vagy jelszó' },
        { status: 401 }
      )
    }
    if (!user.passwordHash) {
      await loginRateLimitRecordFailure(request)
      const lock = await recordUserLoginFailure({
        userId: user.id,
        email: user.email,
        ip,
        userAgent,
      })
      if (lock.locked) {
        return tooManyResponse({ locked: true, retryAfterSec: lock.retryAfterSec })
      }
      return NextResponse.json(
        { error: 'Ehhez a fiókhoz Google-lel jelentkezz be.' },
        { status: 401 }
      )
    }

    const ok = await bcrypt.compare(password, user.passwordHash)
    if (!ok) {
      await loginRateLimitRecordFailure(request)
      const lock = await recordUserLoginFailure({
        userId: user.id,
        email: user.email,
        ip,
        userAgent,
      })
      if (lock.locked) {
        return tooManyResponse({ locked: true, retryAfterSec: lock.retryAfterSec })
      }
      return NextResponse.json(
        { error: 'Hibás e-mail vagy jelszó' },
        { status: 401 }
      )
    }

    await loginRateLimitRecordSuccess(request)
    await clearUserLockout(user.id)
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
