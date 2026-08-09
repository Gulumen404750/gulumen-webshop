import { NextResponse } from 'next/server'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { prisma, isDbConfigured } from '@/lib/prisma'
import { createSession, getSessionCookieHeader, isJwtConfigured } from '@/lib/auth'
import { devCreateUser, devFindUserByEmail } from '@/lib/dev-auth'
import { claimUserPromoCoupon } from '@/lib/promo-coupons'
import { setMarketingOptIn } from '@/lib/marketing-consent'
import {
  findUserByEmail,
  isUniqueEmailConstraintError,
  normalizeEmail,
} from '@/lib/user-email'
import { grantBirthdayCouponForUser, isBirthdayToday, parseBirthDateInput } from '@/lib/birthday-coupon'
import { rateLimit } from '@/lib/rate-limit'

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Legalább 8 karakter'),
  name: z.string().max(200).optional(),
  acceptOffers: z.boolean().optional(),
  birthDate: z.union([z.string(), z.null()]).optional(),
})

const EMAIL_ALREADY_REGISTERED = 'Ezzel az e-mail címmel már regisztráltak. Jelentkezz be.'

export async function POST(request: Request) {
  if (!isJwtConfigured()) {
    return NextResponse.json({ error: 'Auth not configured' }, { status: 503 })
  }

  const limit = await rateLimit(request, { preset: 'auth' })
  if (!limit.ok) {
    return NextResponse.json({ error: 'Too many requests. Try again later.' }, { status: 429 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const parsed = registerSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    )
  }
  const { email, password, name, acceptOffers, birthDate: birthDateRaw } = parsed.data
  const emailNorm = normalizeEmail(email)
  const birthParsed = parseBirthDateInput(birthDateRaw)
  if (birthParsed === 'invalid') {
    return NextResponse.json({ error: 'Érvénytelen születési dátum' }, { status: 400 })
  }

  try {
    if (isDbConfigured()) {
      const existing = await findUserByEmail(emailNorm)
      if (existing) {
        return NextResponse.json({ error: EMAIL_ALREADY_REGISTERED }, { status: 409 })
      }

      const passwordHash = await bcrypt.hash(password, 12)
      const wantsMarketing = Boolean(acceptOffers)
      const now = new Date()
      let user
      try {
        user = await prisma.user.create({
          data: {
            email: emailNorm,
            passwordHash,
            name: name?.trim() || null,
            birthDate: birthParsed,
            marketingOptIn: wantsMarketing,
            marketingOptInAt: wantsMarketing ? now : null,
            marketingOptInSource: wantsMarketing ? 'registration' : null,
          },
        })
      } catch (createError) {
        if (isUniqueEmailConstraintError(createError)) {
          return NextResponse.json({ error: EMAIL_ALREADY_REGISTERED }, { status: 409 })
        }
        throw createError
      }

      if (acceptOffers) {
        await claimUserPromoCoupon(user.id, 'registration')
        await setMarketingOptIn({
          email: emailNorm,
          optedIn: true,
          source: 'registration',
          confirmed: true,
          userId: user.id,
        })
      }

      let birthdayCoupon: {
        code: string
        percent: number
        validUntil: string
        active: boolean
      } | null = null
      // Kupon csak ha ma van a születésnap (különben a napi cron adja)
      if (birthParsed && isBirthdayToday(birthParsed)) {
        const grant = await grantBirthdayCouponForUser(user.id, { sendEmail: true })
        if (grant.ok) birthdayCoupon = grant.coupon
      }

      const token = await createSession(user.id, user.email)
      const response = NextResponse.json({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          marketingOptIn: user.marketingOptIn,
        },
        birthdayCoupon,
      })
      response.headers.set('Set-Cookie', getSessionCookieHeader(token))
      return response
    }

    if (devFindUserByEmail(emailNorm)) {
      return NextResponse.json({ error: EMAIL_ALREADY_REGISTERED }, { status: 409 })
    }

    const user = await devCreateUser(emailNorm, password, name)
    const token = await createSession(user.id, user.email)
    const response = NextResponse.json({
      user: { id: user.id, email: user.email, name: user.name },
      devMode: true,
    })
    response.headers.set('Set-Cookie', getSessionCookieHeader(token))
    return response
  } catch (e) {
    if (isUniqueEmailConstraintError(e)) {
      return NextResponse.json({ error: EMAIL_ALREADY_REGISTERED }, { status: 409 })
    }
    console.error('[api/auth/register] POST', e)
    return NextResponse.json({ error: 'Regisztráció sikertelen' }, { status: 500 })
  }
}
