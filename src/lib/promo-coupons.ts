import { prisma, isDbConfigured } from '@/lib/prisma'
import { CAT_COUPON_PERCENT, REGISTRATION_COUPON_PERCENT } from '@/lib/coupon-config'

export type PromoCouponKind = 'cat' | 'registration'
export type PromoCouponStatus = 'claimed' | 'used'

export type UserPromoCouponState = {
  cat: PromoCouponStatus | null
  registration: PromoCouponStatus | null
}

export type AdminPromoCouponRow = {
  userId: string
  email: string
  name: string | null
  registeredAt: string
  catStatus: PromoCouponStatus | null
  catClaimedAt: string | null
  catUsedAt: string | null
  registrationStatus: PromoCouponStatus | null
  registrationClaimedAt: string | null
  registrationUsedAt: string | null
}

function kindPercent(kind: PromoCouponKind): number {
  return kind === 'cat' ? CAT_COUPON_PERCENT : REGISTRATION_COUPON_PERCENT
}

export async function getUserPromoCouponState(userId: string): Promise<UserPromoCouponState> {
  if (!isDbConfigured()) {
    return { cat: null, registration: null }
  }
  const rows = await prisma.userPromoCoupon.findMany({
    where: { userId },
    select: { kind: true, status: true },
  })
  const state: UserPromoCouponState = { cat: null, registration: null }
  for (const row of rows) {
    if (row.kind === 'cat' || row.kind === 'registration') {
      state[row.kind] = row.status as PromoCouponStatus
    }
  }
  return state
}

/** Aktív (claimed) promo kuponok összesített %-a checkouthoz. */
export async function getActivePromoDiscountPercent(userId: string): Promise<number> {
  const state = await getUserPromoCouponState(userId)
  let p = 0
  if (state.cat === 'claimed') p += CAT_COUPON_PERCENT
  if (state.registration === 'claimed') p += REGISTRATION_COUPON_PERCENT
  return p
}

export async function claimUserPromoCoupon(
  userId: string,
  kind: PromoCouponKind
): Promise<{ ok: true; status: PromoCouponStatus } | { ok: false; reason: 'already_claimed' | 'already_used' }> {
  if (!isDbConfigured()) {
    return { ok: true, status: 'claimed' }
  }

  const existing = await prisma.userPromoCoupon.findUnique({
    where: { userId_kind: { userId, kind } },
  })
  if (existing?.status === 'used') {
    return { ok: false, reason: 'already_used' }
  }
  if (existing?.status === 'claimed') {
    return { ok: false, reason: 'already_claimed' }
  }

  await prisma.userPromoCoupon.create({
    data: { userId, kind, status: 'claimed' },
  })
  return { ok: true, status: 'claimed' }
}

export async function markUserPromoCouponsUsed(userId: string): Promise<void> {
  if (!isDbConfigured()) return
  const now = new Date()
  await prisma.userPromoCoupon.updateMany({
    where: { userId, status: 'claimed' },
    data: { status: 'used', usedAt: now },
  })
}

export async function markUserPromoCouponUsed(userId: string, kind: PromoCouponKind): Promise<void> {
  if (!isDbConfigured()) return
  await prisma.userPromoCoupon.updateMany({
    where: { userId, kind, status: 'claimed' },
    data: { status: 'used', usedAt: new Date() },
  })
}

/** Admin: regisztrált felhasználók promo kupon állapota. */
export async function listAdminPromoCouponUsers(limit = 500): Promise<AdminPromoCouponRow[]> {
  if (!isDbConfigured()) return []

  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      promoCoupons: true,
    },
  })

  return users.map((u) => {
    const cat = u.promoCoupons.find((c) => c.kind === 'cat')
    const reg = u.promoCoupons.find((c) => c.kind === 'registration')
    return {
      userId: u.id,
      email: u.email,
      name: u.name,
      registeredAt: u.createdAt.toISOString(),
      catStatus: (cat?.status as PromoCouponStatus) ?? null,
      catClaimedAt: cat?.claimedAt.toISOString() ?? null,
      catUsedAt: cat?.usedAt?.toISOString() ?? null,
      registrationStatus: (reg?.status as PromoCouponStatus) ?? null,
      registrationClaimedAt: reg?.claimedAt.toISOString() ?? null,
      registrationUsedAt: reg?.usedAt?.toISOString() ?? null,
    }
  })
}

export function promoKindLabel(kind: PromoCouponKind): string {
  return kind === 'cat' ? `Macska (${Math.round(kindPercent(kind) * 100)}%)` : `Regisztráció (${Math.round(kindPercent(kind) * 100)}%)`
}

export function promoStatusLabel(status: PromoCouponStatus | null): string {
  if (!status) return '—'
  if (status === 'claimed') return 'Aktív'
  return 'Felhasználva'
}
