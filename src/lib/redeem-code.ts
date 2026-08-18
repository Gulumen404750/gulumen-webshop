/**
 * Egy kódbevitő: ajándékpont-token / tételcímke, vagy admin százalékos/fix kupon.
 * Sorrend: egyedi token → saját aktivált kupon → Coupon sablon → ajándékpont tételcímke.
 */
import { prisma, isDbConfigured } from '@/lib/prisma'
import { previewCouponCode, type CouponRedeemPreview } from '@/lib/coupon-checkout'
import { ownedCouponRedeemError } from '@/lib/coupon-claim'
import {
  findGiftPointCodeByToken,
  findUnclaimedGiftPointCodeByBatchLabel,
} from '@/lib/gamification/gift-point-codes'

export function normalizeRedeemCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, '')
}

export function pickRedeemKind(found: {
  giftToken: boolean
  coupon: boolean
  giftBatch: boolean
}): 'gift_token' | 'coupon' | 'gift_batch' | 'none' {
  if (found.giftToken) return 'gift_token'
  if (found.coupon) return 'coupon'
  if (found.giftBatch) return 'gift_batch'
  return 'none'
}

export type RedeemLookup =
  | { kind: 'gift_points'; token: string; via: 'token' | 'batch' }
  | { kind: 'coupon'; coupon: CouponRedeemPreview }
  | { kind: 'coupon_error'; error: string; code: string }
  | { kind: 'none' }

export async function lookupRedeemableCode(
  raw: string,
  userId: string | null
): Promise<RedeemLookup> {
  if (!isDbConfigured()) return { kind: 'none' }
  const code = normalizeRedeemCode(raw)
  if (!code) return { kind: 'none' }

  const giftByToken = await findGiftPointCodeByToken(code)
  if (giftByToken) {
    return { kind: 'gift_points', token: giftByToken.token, via: 'token' }
  }

  if (userId) {
    const existing = await prisma.coupon.findFirst({
      where: {
        userId,
        OR: [{ claimedFromCode: code }, { code }],
      },
    })
    if (existing) return ownedCouponRedeemError(existing)
  }

  const coupon = await previewCouponCode({ couponCode: code, userId })
  if (coupon.ok) {
    return { kind: 'coupon', coupon: coupon.coupon }
  }
  if (coupon.code !== 'coupon_invalid') {
    return { kind: 'coupon_error', error: coupon.error, code: coupon.code }
  }

  const giftByBatch = await findUnclaimedGiftPointCodeByBatchLabel(code)
  if (giftByBatch) {
    return { kind: 'gift_points', token: giftByBatch.token, via: 'batch' }
  }

  return { kind: 'none' }
}
