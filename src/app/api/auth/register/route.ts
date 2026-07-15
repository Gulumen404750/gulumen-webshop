import { NextResponse } from 'next/server'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { prisma, isDbConfigured } from '@/lib/prisma'
import { createSession, getSessionCookieHeader, isJwtConfigured } from '@/lib/auth'
import { devCreateUser, devFindUserByEmail } from '@/lib/dev-auth'
import { claimUserPromoCoupon } from '@/lib/promo-coupons'

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Legalább 8 karakter'),
  name: z.string().max(200).optional(),
  acceptOffers: z.boolean().optional(),
})

export async function POST(request: Request) {
  if (!isJwtConfigured()) {
    return NextResponse.json({ error: 'Auth not configured' }, { status: 503 })
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
  const { email, password, name, acceptOffers } = parsed.data
  const emailNorm = email.trim().toLowerCase()

  try {
    if (isDbConfigured()) {
      const existing = await prisma.user.findUnique({ where: { email: emailNorm } })
      if (existing) {
        return NextResponse.json(
          { error: 'Ezzel az e-mail címmel már regisztráltak' },
          { status: 409 }
        )
      }

      const passwordHash = await bcrypt.hash(password, 12)
      const user = await prisma.user.create({
        data: {
          email: emailNorm,
          passwordHash,
          name: name?.trim() || null,
        },
      })

      if (acceptOffers) {
        await claimUserPromoCoupon(user.id, 'registration')
      }

      const token = await createSession(user.id, user.email)
      const response = NextResponse.json({
        user: { id: user.id, email: user.email, name: user.name },
      })
      response.headers.set('Set-Cookie', getSessionCookieHeader(token))
      return response
    }

    if (devFindUserByEmail(emailNorm)) {
      return NextResponse.json(
        { error: 'Ezzel az e-mail címmel már regisztráltak' },
        { status: 409 }
      )
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
    console.error('[api/auth/register] POST', e)
    return NextResponse.json({ error: 'Regisztráció sikertelen' }, { status: 500 })
  }
}
