/**
 * Marketing / hírlevél hozzájárulás – elkülönítve a tranzakciós e-mailektől.
 */

import { randomBytes } from 'crypto'
import { prisma, isDbConfigured } from '@/lib/prisma'

export type MarketingSource =
  | 'registration'
  | 'newsletter'
  | 'checkout'
  | 'admin'
  | 'unsubscribe'

export type MarketingStatus = {
  email: string
  optedIn: boolean
  confirmed: boolean
  canSendMarketing: boolean
  source: string | null
  optedInAt: Date | null
  optedOutAt: Date | null
  unsubToken: string | null
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

function newUnsubToken(): string {
  return randomBytes(24).toString('hex')
}

export async function canSendMarketingEmail(email: string): Promise<boolean> {
  if (!isDbConfigured()) return false
  const status = await getMarketingStatus(email)
  return status.canSendMarketing
}

export async function getMarketingStatus(email: string): Promise<MarketingStatus> {
  const emailNorm = normalizeEmail(email)
  const empty: MarketingStatus = {
    email: emailNorm,
    optedIn: false,
    confirmed: false,
    canSendMarketing: false,
    source: null,
    optedInAt: null,
    optedOutAt: null,
    unsubToken: null,
  }
  if (!isDbConfigured() || !emailNorm) return empty

  const [user, consent] = await Promise.all([
    prisma.user.findUnique({
      where: { email: emailNorm },
      select: {
        marketingOptIn: true,
        marketingOptInAt: true,
        marketingOptOutAt: true,
        marketingOptInSource: true,
      },
    }),
    prisma.marketingConsent.findUnique({ where: { email: emailNorm } }),
  ])

  if (user) {
    const optedIn = user.marketingOptIn
    return {
      email: emailNorm,
      optedIn,
      confirmed: optedIn,
      canSendMarketing: optedIn,
      source: user.marketingOptInSource ?? consent?.source ?? null,
      optedInAt: user.marketingOptInAt ?? consent?.optedInAt ?? null,
      optedOutAt: user.marketingOptOutAt ?? consent?.optedOutAt ?? null,
      unsubToken: consent?.unsubToken ?? null,
    }
  }

  if (consent) {
    return {
      email: emailNorm,
      optedIn: consent.optedIn,
      confirmed: consent.confirmed,
      canSendMarketing: consent.optedIn && consent.confirmed,
      source: consent.source,
      optedInAt: consent.optedInAt,
      optedOutAt: consent.optedOutAt,
      unsubToken: consent.unsubToken,
    }
  }

  return empty
}

export async function setMarketingOptIn(params: {
  email: string
  optedIn: boolean
  source: MarketingSource
  confirmed?: boolean
  userId?: string | null
}): Promise<MarketingStatus> {
  const emailNorm = normalizeEmail(params.email)
  if (!isDbConfigured() || !emailNorm) {
    return {
      email: emailNorm,
      optedIn: false,
      confirmed: false,
      canSendMarketing: false,
      source: null,
      optedInAt: null,
      optedOutAt: null,
      unsubToken: null,
    }
  }

  const now = new Date()
  const confirmed = params.confirmed ?? params.optedIn
  const existing = await prisma.marketingConsent.findUnique({ where: { email: emailNorm } })
  const nextConfirmed =
    params.optedIn && (confirmed || Boolean(existing?.confirmed && existing?.optedIn))

  const consent = await prisma.marketingConsent.upsert({
    where: { email: emailNorm },
    create: {
      email: emailNorm,
      optedIn: params.optedIn,
      confirmed: params.optedIn ? nextConfirmed : false,
      source: params.source,
      optedInAt: params.optedIn ? now : null,
      optedOutAt: params.optedIn ? null : now,
      unsubToken: newUnsubToken(),
    },
    update: {
      optedIn: params.optedIn,
      confirmed: params.optedIn ? nextConfirmed : false,
      source: params.source,
      optedInAt: params.optedIn ? existing?.optedInAt ?? now : existing?.optedInAt ?? null,
      optedOutAt: params.optedIn ? null : now,
    },
  })

  const user = params.userId
    ? await prisma.user.findUnique({ where: { id: params.userId } })
    : await prisma.user.findUnique({ where: { email: emailNorm } })

  if (user) {
    if (params.optedIn && nextConfirmed) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          marketingOptIn: true,
          marketingOptInAt: user.marketingOptInAt ?? now,
          marketingOptOutAt: null,
          marketingOptInSource: params.source,
        },
      })
    } else if (!params.optedIn) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          marketingOptIn: false,
          marketingOptOutAt: now,
          marketingOptInSource: params.source,
        },
      })
    }
  }

  return {
    email: emailNorm,
    optedIn: consent.optedIn,
    confirmed: consent.confirmed,
    canSendMarketing: consent.optedIn && consent.confirmed,
    source: consent.source,
    optedInAt: consent.optedInAt,
    optedOutAt: consent.optedOutAt,
    unsubToken: consent.unsubToken,
  }
}

export async function confirmMarketingOptIn(email: string): Promise<boolean> {
  if (!isDbConfigured()) return false
  const emailNorm = normalizeEmail(email)
  const consent = await prisma.marketingConsent.findUnique({ where: { email: emailNorm } })
  if (!consent || !consent.optedIn) return false

  const now = new Date()
  await prisma.marketingConsent.update({
    where: { email: emailNorm },
    data: {
      confirmed: true,
      optedInAt: consent.optedInAt ?? now,
      source: consent.source ?? 'newsletter',
    },
  })
  await prisma.user.updateMany({
    where: { email: emailNorm },
    data: {
      marketingOptIn: true,
      marketingOptInAt: now,
      marketingOptOutAt: null,
      marketingOptInSource: 'newsletter',
    },
  })
  return true
}

export async function unsubscribeByToken(
  token: string
): Promise<{ ok: boolean; email?: string }> {
  if (!isDbConfigured() || !token) return { ok: false }
  const consent = await prisma.marketingConsent.findUnique({ where: { unsubToken: token } })
  if (!consent) return { ok: false }

  const now = new Date()
  await prisma.marketingConsent.update({
    where: { id: consent.id },
    data: {
      optedIn: false,
      confirmed: false,
      optedOutAt: now,
      source: 'unsubscribe',
    },
  })
  await prisma.user.updateMany({
    where: { email: consent.email },
    data: {
      marketingOptIn: false,
      marketingOptOutAt: now,
      marketingOptInSource: 'unsubscribe',
    },
  })
  return { ok: true, email: consent.email }
}

export function marketingUnsubscribeUrl(unsubToken: string | null | undefined): string | null {
  if (!unsubToken) return null
  const base = process.env.NEXT_PUBLIC_APP_URL || 'https://gulumen.hu'
  return `${base}/api/newsletter/unsubscribe?token=${encodeURIComponent(unsubToken)}`
}

/** Biztosít unsub tokent (létrehozza a consent sort, ha kell) marketing e-mailhez. */
export async function ensureUnsubToken(email: string): Promise<string | null> {
  if (!isDbConfigured()) return null
  const emailNorm = normalizeEmail(email)
  if (!emailNorm) return null
  const existing = await prisma.marketingConsent.findUnique({ where: { email: emailNorm } })
  if (existing) return existing.unsubToken
  const created = await prisma.marketingConsent.create({
    data: {
      email: emailNorm,
      optedIn: false,
      confirmed: false,
      unsubToken: newUnsubToken(),
    },
  })
  return created.unsubToken
}
