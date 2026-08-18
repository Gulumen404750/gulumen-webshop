/**
 * Checkout welcome 10% + hírlevél ajánlat.
 * - Elfogadáskor: marketingOptIn + claim (ajánlat eltűnik, kedvezmény aktív a fizetésig)
 * - Fizetés után: hasRedeemedWelcomeCoupon = true (többé nem jár 10%)
 */

import { prisma, isDbConfigured } from '@/lib/prisma'
import { setMarketingOptIn, getMarketingStatus } from '@/lib/marketing-consent'
import { claimUserPromoCoupon } from '@/lib/promo-coupons'
import { WELCOME_CHECKOUT_COUPON_PERCENT } from '@/lib/coupon-config'

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export type WelcomeOfferEligibility = {
  email: string
  eligible: boolean
  reason?:
    | 'already_subscribed'
    | 'already_redeemed'
    | 'already_claimed'
    | 'invalid_email'
    | 'db_unavailable'
  percent: number
  marketingOptIn: boolean
  hasRedeemedWelcomeCoupon: boolean
  /** Elfogadva, de még nem „felhasználva” fizetéssel – a checkout %-ot adhat. */
  claimedPending: boolean
}

export async function getWelcomeOfferEligibility(
  email: string
): Promise<WelcomeOfferEligibility> {
  const emailNorm = normalizeEmail(email)
  const percent = WELCOME_CHECKOUT_COUPON_PERCENT
  const base = {
    email: emailNorm,
    percent,
    marketingOptIn: false,
    hasRedeemedWelcomeCoupon: false,
    claimedPending: false,
  }

  if (!emailNorm || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNorm)) {
    return { ...base, eligible: false, reason: 'invalid_email' }
  }
  if (!isDbConfigured()) {
    return { ...base, eligible: false, reason: 'db_unavailable' }
  }

  const [user, consent, marketing] = await Promise.all([
    prisma.user.findUnique({
      where: { email: emailNorm },
      select: {
        id: true,
        marketingOptIn: true,
        hasRedeemedWelcomeCoupon: true,
      },
    }),
    prisma.marketingConsent.findUnique({
      where: { email: emailNorm },
      select: {
        optedIn: true,
        confirmed: true,
        hasRedeemedWelcomeCoupon: true,
        source: true,
      },
    }),
    getMarketingStatus(emailNorm),
  ])

  const hasRedeemedWelcomeCoupon = Boolean(
    user?.hasRedeemedWelcomeCoupon || consent?.hasRedeemedWelcomeCoupon
  )
  const marketingOptIn = marketing.canSendMarketing

  // Claimed pending: csak checkout welcome forrásból, még nem redeemed
  const claimedPending =
    marketingOptIn && !hasRedeemedWelcomeCoupon && consent?.source === 'checkout'

  if (hasRedeemedWelcomeCoupon) {
    return {
      ...base,
      eligible: false,
      reason: 'already_redeemed',
      marketingOptIn,
      hasRedeemedWelcomeCoupon: true,
      claimedPending: false,
    }
  }

  if (marketingOptIn) {
    // Már feliratkozott – welcome UI nem; checkout claim pending esetén a % újra alkalmazható
    return {
      ...base,
      eligible: false,
      reason: claimedPending ? 'already_claimed' : 'already_subscribed',
      marketingOptIn: true,
      hasRedeemedWelcomeCoupon: false,
      claimedPending,
    }
  }

  return {
    ...base,
    eligible: true,
    marketingOptIn: false,
    hasRedeemedWelcomeCoupon: false,
    claimedPending: false,
  }
}

/**
 * Welcome ajánlat elfogadása: marketing opt-in (+ user esetén registration promo claim).
 * hasRedeemedWelcomeCoupon csak sikeres fizetés után kerül true-ra.
 */
export async function acceptWelcomeCheckoutOffer(params: {
  email: string
  userId?: string | null
}): Promise<
  | { ok: true; percent: number; alreadyAccepted?: boolean }
  | { ok: false; error: string; code: string }
> {
  if (!isDbConfigured()) {
    return { ok: false, error: 'Database not configured', code: 'db_unavailable' }
  }

  const eligibility = await getWelcomeOfferEligibility(params.email)
  const emailNorm = eligibility.email

  // Már beváltva fizetéssel → nincs újabb 10%
  if (eligibility.hasRedeemedWelcomeCoupon) {
    return {
      ok: false,
      error: 'A welcome 10% kedvezményt ezzel az e-mail címmel már felhasználtad.',
      code: 'already_redeemed',
    }
  }

  // Már elfogadva (pending) → checkout újra alkalmazhatja a welcome 10%-ot
  if (eligibility.claimedPending) {
    return {
      ok: true,
      percent: WELCOME_CHECKOUT_COUPON_PERCENT,
      alreadyAccepted: true,
    }
  }

  if (!eligibility.eligible) {
    return {
      ok: false,
      error:
        eligibility.reason === 'already_subscribed'
          ? 'Már feliratkoztál a hírlevélre – a welcome ajánlat nem elérhető.'
          : 'A welcome ajánlat nem elérhető.',
      code: eligibility.reason ?? 'not_eligible',
    }
  }

  const user =
    params.userId
      ? await prisma.user.findUnique({ where: { id: params.userId } })
      : await prisma.user.findUnique({ where: { email: emailNorm } })

  await setMarketingOptIn({
    email: emailNorm,
    optedIn: true,
    source: 'checkout',
    confirmed: true,
    userId: user?.id ?? params.userId ?? null,
  })

  if (user) {
    await claimUserPromoCoupon(user.id, 'registration')
  }

  return { ok: true, percent: WELCOME_CHECKOUT_COUPON_PERCENT }
}

/** Sikeres fizetés után: welcome kupon véglegesen felhasználva (User + MarketingConsent). */
export async function markWelcomeCouponRedeemed(email: string): Promise<void> {
  if (!isDbConfigured()) return
  const emailNorm = normalizeEmail(email)
  if (!emailNorm) return

  await Promise.all([
    prisma.user.updateMany({
      where: { email: emailNorm },
      data: { hasRedeemedWelcomeCoupon: true },
    }),
    prisma.marketingConsent.updateMany({
      where: { email: emailNorm },
      data: { hasRedeemedWelcomeCoupon: true },
    }),
  ])
}
