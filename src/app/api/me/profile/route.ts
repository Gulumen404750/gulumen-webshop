import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession, resolveSessionUserId } from '@/lib/auth'
import { prisma, isDbConfigured } from '@/lib/prisma'
import {
  ageFromBirthDate,
  findActiveBirthdayCoupon,
  formatBirthDateForInput,
  grantBirthdayCouponForUser,
  parseBirthDateInput,
} from '@/lib/birthday-coupon'

/**
 * GET /api/me/profile – bejelentkezett user profil (születési dátum + születésnapi kupon).
 */
export async function GET(request: Request) {
  const session = await getSession(request)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }

  const userId = await resolveSessionUserId(session)
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      birthDate: true,
      marketingOptIn: true,
    },
  })
  if (!user) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const birthdayCoupon = await findActiveBirthdayCoupon(userId)

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      birthDate: formatBirthDateForInput(user.birthDate),
      age: user.birthDate ? ageFromBirthDate(user.birthDate) : null,
      marketingOptIn: user.marketingOptIn,
    },
    birthdayCoupon,
  })
}

const patchSchema = z.object({
  birthDate: z.union([z.string(), z.null()]).optional(),
  name: z.string().max(200).optional(),
})

/**
 * PATCH /api/me/profile – születési dátum / név frissítés.
 * Születési dátum megadásakor automatikus 15% kupon + e-mail.
 */
export async function PATCH(request: Request) {
  const session = await getSession(request)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }

  const userId = await resolveSessionUserId(session)
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const before = await prisma.user.findUnique({
    where: { id: userId },
    select: { birthDate: true },
  })
  if (!before) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const data: { birthDate?: Date | null; name?: string | null } = {}
  let birthDateNewlySet = false

  if (parsed.data.birthDate !== undefined) {
    const birth = parseBirthDateInput(parsed.data.birthDate)
    if (birth === 'invalid') {
      return NextResponse.json({ error: 'Érvénytelen születési dátum' }, { status: 400 })
    }
    data.birthDate = birth
    if (birth && !before.birthDate) {
      birthDateNewlySet = true
    } else if (birth && before.birthDate) {
      // Dátum módosítás is: ha még nincs aktív kuponja az idén, adjuk
      birthDateNewlySet = true
    }
  }

  if (parsed.data.name !== undefined) {
    data.name = parsed.data.name.trim() || null
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'Nincs módosítandó mező' }, { status: 400 })
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data,
    select: {
      id: true,
      email: true,
      name: true,
      birthDate: true,
      marketingOptIn: true,
    },
  })

  let birthdayCoupon = await findActiveBirthdayCoupon(userId)
  let birthdayGrant: {
    created?: boolean
    emailed?: boolean
    emailError?: string
  } | null = null

  if (birthDateNewlySet && user.birthDate) {
    const grant = await grantBirthdayCouponForUser(userId, { sendEmail: true })
    if (grant.ok) {
      birthdayCoupon = grant.coupon
      birthdayGrant = {
        created: grant.created,
        emailed: grant.emailed,
        emailError: grant.emailError,
      }
    } else if (grant.reason === 'already_sent_this_year') {
      birthdayCoupon = await findActiveBirthdayCoupon(userId)
    }
  }

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      birthDate: formatBirthDateForInput(user.birthDate),
      age: user.birthDate ? ageFromBirthDate(user.birthDate) : null,
      marketingOptIn: user.marketingOptIn,
    },
    birthdayCoupon,
    birthdayGrant,
  })
}
