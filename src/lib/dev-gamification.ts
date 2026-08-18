/**
 * Helyi fejlesztés pont-fallback – ha nincs DATABASE_URL.
 * Szinkron jóváírás (nincs outbox), ugyanazok a szabályok mint DB módban.
 */
import path from 'path'
import fs from 'fs'
import {
  BROWSE_DAILY_MAX_BONUSES,
  BROWSE_DAILY_TARGET_SECONDS,
  DAILY_LIKE_TARGET,
  HEARTBEAT_MIN_INTERVAL_MS,
  HEARTBEAT_TICK_SECONDS,
  LIKE_BONUS_WINDOW_MS,
  LIKE_UNDO_DECREMENTS_DAILY_COUNT,
  LUCKY_SPIN_COOLDOWN_DAYS,
  LUCKY_SPIN_MIN_LIKES,
  LUCKY_SPIN_PRODUCT_COUNT,
  LUCKY_SPIN_VALIDITY_DAYS,
  POINTS_BROWSE_5MIN,
  POINTS_DAILY_LIKE_BONUS,
  REDEEM_THRESHOLD_MIN,
} from '@/lib/gamification/constants'
import { canGrantBrowseBonus } from '@/lib/gamification/browse-bonus'
import { formatGamificationDateKey } from '@/lib/gamification/dates'
import { getCurrentWeekId } from '@/lib/gamification/lucky-spin'
import { canRedeemFromBalance, redeemableCouponCount } from '@/lib/gamification/user-coupons'
import { mockProducts } from '@/lib/data'
import { isDbConfigured } from '@/lib/prisma'
import type { HeartbeatResult } from '@/lib/gamification/browse-heartbeat'

const DATA_DIR = path.join(process.cwd(), 'data')
const DEV_GAMIFICATION_FILE = path.join(DATA_DIR, 'dev-gamification.json')

type DevWallet = {
  balance: number
  lifetimeEarned: number
  lifetimeRedeemed: number
  gamificationSuspended: boolean
}

type DevDailyActivity = {
  activeSeconds: number
  sessionProgressSeconds: number
  bonusGrantedCount: number
  lastBonusGrantedAt: string | null
  lastHeartbeatAt: string | null
}

type DevLikeWindow = {
  windowStartedAt: string
  qualifyingLikeCount: number
  bonusGranted: boolean
}

type DevGamificationStore = {
  wallets: Record<string, DevWallet>
  dailyActivity: Record<string, DevDailyActivity>
  likeWindows: Record<string, DevLikeWindow>
  /** productId:userId → countsForDailyBonus at like time */
  likeFlags: Record<string, boolean>
  luckySpins?: Record<string, DevLuckySpin>
}

type DevLuckySpin = {
  id: string
  userId: string
  weekId: string
  productIds: string[]
  priceSnapshot: Record<string, number>
  generatedAt: string
  expiresAt: string
}

function emptyStore(): DevGamificationStore {
  return { wallets: {}, dailyActivity: {}, likeWindows: {}, likeFlags: {}, luckySpins: {} }
}

function loadStore(): DevGamificationStore {
  if (isDbConfigured()) {
    console.error('[dev-gamification] DATABASE_URL is set – JSON fallback must not be used')
    return emptyStore()
  }
  try {
    if (!fs.existsSync(DEV_GAMIFICATION_FILE)) return emptyStore()
    const raw = fs.readFileSync(DEV_GAMIFICATION_FILE, 'utf-8')
    const data = JSON.parse(raw) as Partial<DevGamificationStore>
    return {
      wallets: data.wallets ?? {},
      dailyActivity: data.dailyActivity ?? {},
      likeWindows: data.likeWindows ?? {},
      likeFlags: data.likeFlags ?? {},
      luckySpins: data.luckySpins ?? {},
    }
  } catch {
    return emptyStore()
  }
}

function saveStore(store: DevGamificationStore): void {
  if (isDbConfigured()) {
    console.error('[dev-gamification] DATABASE_URL is set – refusing to write dev-gamification.json')
    return
  }
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
  fs.writeFileSync(DEV_GAMIFICATION_FILE, JSON.stringify(store, null, 2), 'utf-8')
}

function activityKey(userId: string, dateKey: string): string {
  return `${userId}:${dateKey}`
}

function ensureWallet(store: DevGamificationStore, userId: string): DevWallet {
  if (!store.wallets[userId]) {
    store.wallets[userId] = {
      balance: 0,
      lifetimeEarned: 0,
      lifetimeRedeemed: 0,
      gamificationSuspended: false,
    }
  }
  return store.wallets[userId]
}

function applyDevPoints(store: DevGamificationStore, userId: string, delta: number): void {
  const wallet = ensureWallet(store, userId)
  if (wallet.gamificationSuspended && delta > 0) return
  wallet.balance = Math.max(0, wallet.balance + delta)
  if (delta > 0) wallet.lifetimeEarned += delta
  if (delta < 0) wallet.lifetimeRedeemed += Math.abs(delta)
}

function ensureLikeWindow(store: DevGamificationStore, userId: string, now: Date): DevLikeWindow {
  const existing = store.likeWindows[userId]
  if (existing) {
    const endsAt = new Date(existing.windowStartedAt).getTime() + LIKE_BONUS_WINDOW_MS
    if (now.getTime() >= endsAt) {
      store.likeWindows[userId] = {
        windowStartedAt: now.toISOString(),
        qualifyingLikeCount: 0,
        bonusGranted: false,
      }
    }
  } else {
    store.likeWindows[userId] = {
      windowStartedAt: now.toISOString(),
      qualifyingLikeCount: 0,
      bonusGranted: false,
    }
  }
  return store.likeWindows[userId]
}

export function devGetWallet(userId: string) {
  const store = loadStore()
  const wallet = store.wallets[userId] ?? {
    balance: 0,
    lifetimeEarned: 0,
    lifetimeRedeemed: 0,
    gamificationSuspended: false,
  }
  const canRedeem = canRedeemFromBalance(
    wallet.balance,
    REDEEM_THRESHOLD_MIN,
    wallet.gamificationSuspended
  )
  return {
    balance: wallet.balance,
    lifetimeEarned: wallet.lifetimeEarned,
    lifetimeRedeemed: wallet.lifetimeRedeemed,
    redeemThreshold: REDEEM_THRESHOLD_MIN,
    canRedeem,
    redeemableCount: redeemableCouponCount(
      wallet.balance,
      REDEEM_THRESHOLD_MIN,
      wallet.gamificationSuspended
    ),
    hasActiveCoupon: false,
    activeCouponCode: null,
    activeCouponPercent: null,
    activeCouponValidUntil: null,
    coupons: [],
    suspended: wallet.gamificationSuspended,
    giftPointsAvailable: 0,
    giftBalance: 0,
    activityBalance: wallet.balance,
    giftExpiresAt: null,
    gamificationEnabled: true,
    mode: 'dev' as const,
  }
}

export function devRecordBrowseHeartbeat(input: {
  userId: string
  isVisible: boolean
  hasFocus: boolean
}): HeartbeatResult {
  const emptyResult = (reason?: string): HeartbeatResult => ({
    accepted: false,
    activeSecondsToday: 0,
    sessionProgressSeconds: 0,
    targetSeconds: BROWSE_DAILY_TARGET_SECONDS,
    bonusesGrantedToday: 0,
    maxBonusesPerDay: BROWSE_DAILY_MAX_BONUSES,
    bonusQueued: false,
    reason,
  })

  if (!input.isVisible || !input.hasFocus) return emptyResult('inactive_tab')

  const store = loadStore()
  const now = new Date()
  const dateKey = formatGamificationDateKey(now)
  const key = activityKey(input.userId, dateKey)

  const existing = store.dailyActivity[key]
  if (existing?.lastHeartbeatAt) {
    const elapsed = now.getTime() - new Date(existing.lastHeartbeatAt).getTime()
    if (elapsed < HEARTBEAT_MIN_INTERVAL_MS) {
      return {
        accepted: false,
        activeSecondsToday: existing.activeSeconds,
        sessionProgressSeconds: existing.sessionProgressSeconds,
        targetSeconds: BROWSE_DAILY_TARGET_SECONDS,
        bonusesGrantedToday: existing.bonusGrantedCount,
        maxBonusesPerDay: BROWSE_DAILY_MAX_BONUSES,
        bonusQueued: false,
        reason: 'too_frequent',
      }
    }
  }

  const activity: DevDailyActivity = {
    activeSeconds: (existing?.activeSeconds ?? 0) + HEARTBEAT_TICK_SECONDS,
    sessionProgressSeconds: (existing?.sessionProgressSeconds ?? 0) + HEARTBEAT_TICK_SECONDS,
    bonusGrantedCount: existing?.bonusGrantedCount ?? 0,
    lastBonusGrantedAt: existing?.lastBonusGrantedAt ?? null,
    lastHeartbeatAt: now.toISOString(),
  }
  store.dailyActivity[key] = activity

  let bonusQueued = false
  if (
    canGrantBrowseBonus(
      {
        bonusGrantedCount: activity.bonusGrantedCount,
        lastBonusGrantedAt: activity.lastBonusGrantedAt ? new Date(activity.lastBonusGrantedAt) : null,
        sessionProgressSeconds: activity.sessionProgressSeconds,
      },
      now
    )
  ) {
    applyDevPoints(store, input.userId, POINTS_BROWSE_5MIN)
    activity.bonusGrantedCount += 1
    activity.lastBonusGrantedAt = now.toISOString()
    activity.sessionProgressSeconds = 0
    store.dailyActivity[key] = activity
    bonusQueued = true
  }

  saveStore(store)

  return {
    accepted: true,
    activeSecondsToday: activity.activeSeconds,
    sessionProgressSeconds: activity.sessionProgressSeconds,
    targetSeconds: BROWSE_DAILY_TARGET_SECONDS,
    bonusesGrantedToday: activity.bonusGrantedCount,
    maxBonusesPerDay: BROWSE_DAILY_MAX_BONUSES,
    bonusQueued,
  }
}

export function devOnLikeToggle(userId: string, productId: string, liked: boolean) {
  const store = loadStore()
  const now = new Date()
  const flagKey = `${productId}:${userId}`
  const window = ensureLikeWindow(store, userId, now)
  const windowEndsAt = new Date(window.windowStartedAt).getTime() + LIKE_BONUS_WINDOW_MS
  const canEarnProgress = !window.bonusGranted && window.qualifyingLikeCount < DAILY_LIKE_TARGET

  let dailyBonusQueued = false

  if (liked) {
    const countsForDailyBonus = canEarnProgress
    store.likeFlags[flagKey] = countsForDailyBonus
    if (countsForDailyBonus) {
      window.qualifyingLikeCount += 1
      if (window.qualifyingLikeCount >= DAILY_LIKE_TARGET && !window.bonusGranted) {
        applyDevPoints(store, userId, POINTS_DAILY_LIKE_BONUS)
        window.bonusGranted = true
        dailyBonusQueued = true
      }
    }
  } else {
    const hadFlag = store.likeFlags[flagKey]
    delete store.likeFlags[flagKey]
    if (
      LIKE_UNDO_DECREMENTS_DAILY_COUNT &&
      hadFlag &&
      !window.bonusGranted &&
      window.qualifyingLikeCount > 0
    ) {
      window.qualifyingLikeCount -= 1
    }
  }

  store.likeWindows[userId] = window
  saveStore(store)

  return {
    qualifyingLikeCount: window.qualifyingLikeCount,
    qualifyingLikeTarget: DAILY_LIKE_TARGET,
    pointLimitReached: window.bonusGranted || window.qualifyingLikeCount >= DAILY_LIKE_TARGET,
    canEarnLikeProgress: !window.bonusGranted && window.qualifyingLikeCount < DAILY_LIKE_TARGET,
    windowResetsAt: new Date(windowEndsAt).toISOString(),
    dailyBonusQueued,
    dailyLikeCount: window.qualifyingLikeCount,
    dailyLikeTarget: DAILY_LIKE_TARGET,
  }
}

export function devGetLikeStatus(userId: string) {
  const store = loadStore()
  const now = new Date()
  const window = ensureLikeWindow(store, userId, now)
  saveStore(store)
  const windowEndsAt = new Date(window.windowStartedAt).getTime() + LIKE_BONUS_WINDOW_MS
  return {
    qualifyingLikeCount: window.qualifyingLikeCount,
    qualifyingLikeTarget: DAILY_LIKE_TARGET,
    pointLimitReached: window.bonusGranted || window.qualifyingLikeCount >= DAILY_LIKE_TARGET,
    canEarnLikeProgress: !window.bonusGranted && window.qualifyingLikeCount < DAILY_LIKE_TARGET,
    windowResetsAt: new Date(windowEndsAt).toISOString(),
  }
}

// ─── Lucky Spin (dev fallback) ───────────────────────────────────────────

type DevGamificationStoreWithSpin = DevGamificationStore

function loadStoreWithSpin(): DevGamificationStoreWithSpin {
  const base = loadStore()
  if (!base.luckySpins) base.luckySpins = {}
  return base
}

function devPickProducts(userId: string): string[] {
  let liked: string[] = []
  try {
    const likesFile = path.join(DATA_DIR, 'product-likes.json')
    if (fs.existsSync(likesFile)) {
      const raw = fs.readFileSync(likesFile, 'utf-8')
      const records = JSON.parse(raw) as { productId: string; userId: string }[]
      liked = records.filter((r) => r.userId === userId).map((r) => r.productId)
    }
  } catch {
    // ignore
  }
  const shuffled = [...liked].sort(() => Math.random() - 0.5)
  const selected = shuffled.slice(0, LUCKY_SPIN_PRODUCT_COUNT)
  if (selected.length < LUCKY_SPIN_PRODUCT_COUNT) {
    const exclude = new Set(selected)
    const filler = mockProducts
      .filter((p) => !exclude.has(p.id) && (p.stock ?? 0) > 0)
      .map((p) => p.id)
      .sort(() => Math.random() - 0.5)
      .slice(0, LUCKY_SPIN_PRODUCT_COUNT - selected.length)
    selected.push(...filler)
  }
  return selected.slice(0, LUCKY_SPIN_PRODUCT_COUNT)
}

function devGetUserLikesCount(userId: string): number {
  try {
    const likesFile = path.join(DATA_DIR, 'product-likes.json')
    if (!fs.existsSync(likesFile)) return 0
    const raw = fs.readFileSync(likesFile, 'utf-8')
    const records = JSON.parse(raw) as { productId: string; userId: string }[]
    return records.filter((r) => r.userId === userId).length
  } catch {
    return 0
  }
}

export function devGetLuckySpin(userId: string) {
  const store = loadStoreWithSpin()
  const now = new Date()
  const likesCount = devGetUserLikesCount(userId)
  const isEligible = likesCount >= LUCKY_SPIN_MIN_LIKES
  const spins = Object.values(store.luckySpins ?? {}).filter((s) => s.userId === userId)
  spins.sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime())
  const latest = spins[0] ?? null
  const active = latest && new Date(latest.expiresAt) > now ? latest : null
  const cooldownMs = LUCKY_SPIN_COOLDOWN_DAYS * 24 * 60 * 60 * 1000
  const canSpin = isEligible && (!latest || now.getTime() - new Date(latest.generatedAt).getTime() >= cooldownMs)
  let nextSpinAt: string | null = null
  if (!canSpin && latest && isEligible) {
    nextSpinAt = new Date(new Date(latest.generatedAt).getTime() + cooldownMs).toISOString()
  }
  return {
    spin: active
      ? {
          id: active.id,
          userId: active.userId,
          weekId: active.weekId,
          productIds: active.productIds,
          priceSnapshot: active.priceSnapshot,
          generatedAt: new Date(active.generatedAt),
          expiresAt: new Date(active.expiresAt),
        }
      : null,
    canSpin: canSpin && !active,
    nextSpinAt,
    isActive: Boolean(active),
    isExpired: latest ? new Date(latest.expiresAt) <= now : false,
    likesCount,
    isEligible,
  }
}

export function devGenerateLuckySpin(userId: string): {
  ok: true
  spin: { id: string; userId: string; weekId: string; productIds: string[]; priceSnapshot?: Record<string, number>; generatedAt: Date; expiresAt: Date }
} | { ok: false; error: string; status: number } {
  const likesCount = devGetUserLikesCount(userId)
  if (likesCount < LUCKY_SPIN_MIN_LIKES) {
    return { ok: false, error: `Collect at least ${LUCKY_SPIN_MIN_LIKES} favorites to spin`, status: 403 }
  }
  const status = devGetLuckySpin(userId)
  if (status.spin) {
    return { ok: true, spin: status.spin }
  }
  if (!status.canSpin) {
    return { ok: false, error: 'Spin not available yet', status: 429 }
  }

  const store = loadStoreWithSpin()
  const now = new Date()
  const weekId = getCurrentWeekId(now)
  const existingWeek = Object.values(store.luckySpins ?? {}).find(
    (s) => s.userId === userId && s.weekId === weekId
  )
  if (existingWeek && new Date(existingWeek.expiresAt) > now) {
    return {
      ok: true,
      spin: {
        id: existingWeek.id,
        userId: existingWeek.userId,
        weekId: existingWeek.weekId,
        productIds: existingWeek.productIds,
        priceSnapshot: existingWeek.priceSnapshot,
        generatedAt: new Date(existingWeek.generatedAt),
        expiresAt: new Date(existingWeek.expiresAt),
      },
    }
  }

  const productIds = devPickProducts(userId)
  if (productIds.length === 0) {
    return { ok: false, error: 'No products available', status: 400 }
  }

  const priceSnapshot: Record<string, number> = {}
  for (const id of productIds) {
    const p = mockProducts.find((m) => m.id === id)
    if (p) priceSnapshot[id] = p.discountPriceHuf ?? p.priceHuf
  }

  const spin: DevLuckySpin = {
    id: existingWeek?.id ?? `dev-spin-${Date.now()}`,
    userId,
    weekId,
    productIds,
    priceSnapshot,
    generatedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + LUCKY_SPIN_VALIDITY_DAYS * 24 * 60 * 60 * 1000).toISOString(),
  }
  if (!store.luckySpins) store.luckySpins = {}
  store.luckySpins[spin.id] = spin
  saveStore(store)

  return {
    ok: true,
    spin: {
      id: spin.id,
      userId: spin.userId,
      weekId: spin.weekId,
      productIds: spin.productIds,
      priceSnapshot: spin.priceSnapshot,
      generatedAt: new Date(spin.generatedAt),
      expiresAt: new Date(spin.expiresAt),
    },
  }
}
