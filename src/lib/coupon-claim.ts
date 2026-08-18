/**
 * Admin / kampány kupon aktiválása: egyszer / felhasználó, személyes példány a tárcában.
 * A sablon (NYAR2026) megmarad; a vásárló a saját, egyszer használható klónját kapja.
 */
import { randomUUID } from 'crypto'
import { prisma, isDbConfigured } from '@/lib/prisma'
import { isCouponInValidPeriod } from '@/lib/coupon-checkout'

export const ADMIN_CLAIM_SOURCE = 'admin_claim'

export type CouponClaimErrorCode =
  | 'coupon_invalid'
  | 'coupon_inactive'
  | 'coupon_expired'
  | 'coupon_exhausted'
  | 'coupon_login_required'
  | 'coupon_not_owned'
  | 'coupon_already_claimed'
  | 'coupon_used'
  | 'coupon_unavailable'

export type ClaimedCoupon = {
  id: string
  /** Felületen mutatott kód (kampánykód, pl. NYAR2026). */
  code: string
  /** Checkout-nak küldött egyedi kód. */
  checkoutCode: string
  discountType: 'percent' | 'fixed'
  discountValue: number
  minOrderHuf: number | null
  validUntil: Date | null
  source: string | null
  userId: string | null
}

export type CouponClaimResult =
  | { ok: true; coupon: ClaimedCoupon; created: boolean }
  | { ok: false; code: CouponClaimErrorCode; error: string }

const ERRORS: Record<CouponClaimErrorCode, string> = {
  coupon_invalid: 'Invalid coupon code',
  coupon_inactive: 'Coupon is not active',
  coupon_expired: 'Coupon is outside its validity period',
  coupon_exhausted: 'Coupon usage limit reached',
  coupon_login_required: 'Login required for this coupon',
  coupon_not_owned: 'Coupon does not belong to this account',
  coupon_already_claimed: 'Coupon already activated on this account',
  coupon_used: 'Coupon has already been used',
  coupon_unavailable: 'Coupon checkout requires database',
}

export function failClaim(code: CouponClaimErrorCode): Extract<CouponClaimResult, { ok: false }> {
  return { ok: false, code, error: ERRORS[code] }
}

export function personalClaimCode(templateCode: string, suffix: string): string {
  const base = templateCode.replace(/[^A-Z0-9-]/gi, '').toUpperCase().slice(0, 18) || 'CLAIM'
  const cleanSuffix = suffix.replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 8) || 'X'
  return `${base}-${cleanSuffix}`
}

export function interpretOwnedCoupon(row: {
  usedCount: number
  maxUses: number | null
}): 'used' | 'already_claimed' {
  const max = row.maxUses ?? 1
  if (max > 0 && row.usedCount >= max) return 'used'
  return 'already_claimed'
}

export function isCampaignTemplate(coupon: { userId: string | null; source: string | null }): boolean {
  if (coupon.userId) return false
  return coupon.source !== 'gamification'
}

function toClaimed(row: {
  id: string
  code: string
  claimedFromCode?: string | null
  discountType: string
  discountValue: number
  minOrderHuf: number | null
  validUntil: Date | null
  source: string | null
  userId: string | null
}): ClaimedCoupon {
  return {
    id: row.id,
    code: (row.claimedFromCode || row.code).toUpperCase(),
    checkoutCode: row.code,
    discountType: row.discountType === 'fixed' ? 'fixed' : 'percent',
    discountValue: row.discountValue,
    minOrderHuf: row.minOrderHuf,
    validUntil: row.validUntil,
    source: row.source,
    userId: row.userId,
  }
}

function ownedResult(
  row: {
    id: string
    code: string
    claimedFromCode?: string | null
    discountType: string
    discountValue: number
    minOrderHuf: number | null
    validUntil: Date | null
    source: string | null
    userId: string | null
    usedCount: number
    maxUses: number | null
  },
  allowExistingUnused: boolean
): CouponClaimResult {
  const state = interpretOwnedCoupon(row)
  if (state === 'used') return failClaim('coupon_used')
  if (!allowExistingUnused) return failClaim('coupon_already_claimed')
  return { ok: true, coupon: toClaimed(row), created: false }
}

/**
 * @param allowExistingUnused checkout: a már aktivált, még fel nem használt példányt alkalmazza.
 *   Profil beváltó: false → „Már aktiválva”.
 */
export async function claimCouponForUser(params: {
  userId: string | null
  code: string
  now?: Date
  allowExistingUnused?: boolean
}): Promise<CouponClaimResult> {
  if (!isDbConfigured()) return failClaim('coupon_unavailable')
  const userId = params.userId
  if (!userId) return failClaim('coupon_login_required')

  const code = params.code.trim().toUpperCase().replace(/\s+/g, '')
  if (!code) return failClaim('coupon_invalid')
  const now = params.now ?? new Date()
  const allowExistingUnused = params.allowExistingUnused === true

  const found = await prisma.coupon.findUnique({ where: { code } })
  if (!found) return failClaim('coupon_invalid')

  if (found.userId) {
    if (found.userId !== userId) return failClaim('coupon_not_owned')
    if (!found.active) {
      return interpretOwnedCoupon(found) === 'used'
        ? failClaim('coupon_used')
        : failClaim('coupon_inactive')
    }
    if (!isCouponInValidPeriod(found, now)) return failClaim('coupon_expired')
    return ownedResult(found, allowExistingUnused)
  }

  const existing = await prisma.coupon.findFirst({
    where: { userId, claimedFromCode: code },
  })
  if (existing) return ownedResult(existing, allowExistingUnused)

  if (!found.active) return failClaim('coupon_inactive')
  if (!isCouponInValidPeriod(found, now)) return failClaim('coupon_expired')
  if (found.maxUses != null && found.usedCount >= found.maxUses) {
    return failClaim('coupon_exhausted')
  }

  try {
    const outcome = await prisma.$transaction(async (tx) => {
      const again = await tx.coupon.findFirst({
        where: { userId, claimedFromCode: code },
      })
      if (again) return { row: again, created: false as const }

      const template = await tx.coupon.findUnique({ where: { id: found.id } })
      if (!template || !template.active) return null
      if (!isCouponInValidPeriod(template, now)) return null
      if (template.maxUses != null && template.usedCount >= template.maxUses) return null

      const newUsed = template.usedCount + 1
      await tx.coupon.update({
        where: { id: template.id },
        data: {
          usedCount: newUsed,
          ...(template.maxUses != null && newUsed >= template.maxUses ? { active: false } : {}),
        },
      })

      const suffix = randomUUID().replace(/-/g, '').slice(0, 6).toUpperCase()
      const row = await tx.coupon.create({
        data: {
          code: personalClaimCode(template.code, suffix),
          discountType: template.discountType,
          discountValue: template.discountValue,
          active: true,
          validFrom: template.validFrom ?? now,
          validUntil: template.validUntil,
          minOrderHuf: template.minOrderHuf,
          maxUses: 1,
          usedCount: 0,
          userId,
          source: ADMIN_CLAIM_SOURCE,
          claimedFromCode: template.code,
        },
      })
      return { row, created: true as const }
    })

    if (!outcome) return failClaim('coupon_exhausted')
    if (!outcome.created) return ownedResult(outcome.row, allowExistingUnused)
    return { ok: true, coupon: toClaimed(outcome.row), created: true }
  } catch (e) {
    const prismaCode =
      e && typeof e === 'object' && 'code' in e ? String((e as { code: string }).code) : ''
    if (prismaCode === 'P2002') {
      const raced = await prisma.coupon.findFirst({
        where: { userId, claimedFromCode: code },
      })
      if (raced) return ownedResult(raced, allowExistingUnused)
      return failClaim('coupon_already_claimed')
    }
    throw e
  }
}
