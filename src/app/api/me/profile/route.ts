import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession, resolveSessionUserId } from '@/lib/auth'
import { prisma, isDbConfigured } from '@/lib/prisma'
import {
  ageFromBirthDate,
  formatBirthDateForInput,
  parseBirthDateInput,
} from '@/lib/birthday-coupon'

/**
 * GET /api/me/profile – bejelentkezett user profil (születési dátum).
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

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      birthDate: formatBirthDateForInput(user.birthDate),
      age: user.birthDate ? ageFromBirthDate(user.birthDate) : null,
      marketingOptIn: user.marketingOptIn,
    },
  })
}

const patchSchema = z.object({
  birthDate: z.union([z.string(), z.null()]).optional(),
  name: z.string().max(200).optional(),
})

/**
 * PATCH /api/me/profile – születési dátum / név frissítés.
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

  const data: { birthDate?: Date | null; name?: string | null } = {}

  if (parsed.data.birthDate !== undefined) {
    const birth = parseBirthDateInput(parsed.data.birthDate)
    if (birth === 'invalid') {
      return NextResponse.json({ error: 'Érvénytelen születési dátum' }, { status: 400 })
    }
    data.birthDate = birth
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

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      birthDate: formatBirthDateForInput(user.birthDate),
      age: user.birthDate ? ageFromBirthDate(user.birthDate) : null,
      marketingOptIn: user.marketingOptIn,
    },
  })
}
