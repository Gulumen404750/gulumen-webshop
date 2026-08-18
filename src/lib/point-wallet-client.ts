/**
 * Kliensoldali ponttárca cache segédek (SWR).
 * Stripe redirect után a memóriabeli SWR cache elvész – sessionStorage-ből
 * azonnal visszaállítjuk az optimista pontlevonást (fetcher + mutate).
 */
import { mutate } from 'swr'

export type PointWalletData = {
  balance: number
  lifetimeEarned: number
  lifetimeRedeemed: number
  redeemThreshold: number
  canRedeem: boolean
  hasActiveCoupon: boolean
  activeCouponCode: string | null
  suspended: boolean
  giftPointsAvailable?: number
  giftPointValidityDays?: number
  gamificationEnabled?: boolean
  mode?: 'dev'
}

export const POINT_WALLET_SWR_KEY = '/api/gamification/wallet'

const PENDING_REDEEM_STORAGE_KEY = 'gulumen:pendingPointsRedeem'

type PendingRedeem = {
  pointsUsed: number
  /**
   * Egyenleg a levonás előtt – ha a szerver már levonta, nem vonunk újra.
   * null = ismeretlen (csak egyszeri optimista levonás mutate-tel).
   */
  balanceBefore: number | null
}

/** Ugyanazon oldalbetöltésen belül ne vonjuk le kétszer a mutate útján. */
let appliedPendingInMemory: number | null = null

export function readPendingPointsRedeem(): PendingRedeem | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(PENDING_REDEEM_STORAGE_KEY)
    if (!raw) return null
    // Legacy: sima szám
    if (/^\d+$/.test(raw)) {
      const pointsUsed = Number(raw)
      if (!Number.isFinite(pointsUsed) || pointsUsed <= 0) return null
      return { pointsUsed: Math.floor(pointsUsed), balanceBefore: null }
    }
    const parsed = JSON.parse(raw) as Partial<PendingRedeem>
    const pointsUsed = Number(parsed.pointsUsed)
    if (!Number.isFinite(pointsUsed) || pointsUsed <= 0) return null
    const balanceBefore =
      typeof parsed.balanceBefore === 'number' && Number.isFinite(parsed.balanceBefore)
        ? Math.floor(parsed.balanceBefore)
        : null
    return {
      pointsUsed: Math.floor(pointsUsed),
      balanceBefore,
    }
  } catch {
    return null
  }
}

/**
 * Checkout siker / Stripe redirect előtt: mentjük a levonandó pontokat.
 * balanceBefore kell, hogy a szerver oldali levonás után ne vonjunk le kétszer.
 * @param opts.replace – false esetén megőrzi a meglévő stash-t (siker oldal).
 */
export function stashPendingPointsRedeem(
  pointsUsed: number,
  balanceBefore?: number,
  opts?: { replace?: boolean }
) {
  if (typeof window === 'undefined' || pointsUsed <= 0) return
  try {
    if (opts?.replace === false && readPendingPointsRedeem()) return
    const payload: PendingRedeem = {
      pointsUsed: Math.floor(pointsUsed),
      balanceBefore:
        typeof balanceBefore === 'number' && Number.isFinite(balanceBefore)
          ? Math.floor(balanceBefore)
          : null,
    }
    sessionStorage.setItem(PENDING_REDEEM_STORAGE_KEY, JSON.stringify(payload))
  } catch {
    /* private mode stb. */
  }
}

export function clearPendingPointsRedeem() {
  appliedPendingInMemory = null
  if (typeof window === 'undefined') return
  try {
    sessionStorage.removeItem(PENDING_REDEEM_STORAGE_KEY)
  } catch {
    /* ignore */
  }
}

export function withDeductedBalance(
  prev: PointWalletData,
  pointsUsed: number
): PointWalletData {
  const nextBalance = Math.max(0, prev.balance - pointsUsed)
  return {
    ...prev,
    balance: nextBalance,
    lifetimeRedeemed: (prev.lifetimeRedeemed ?? 0) + pointsUsed,
    canRedeem:
      nextBalance >= prev.redeemThreshold && !prev.suspended && !prev.hasActiveCoupon,
  }
}

/**
 * Wallet API válasz: ha van folyamatban lévő fizetéses pontlevonás,
 * azonnal a levont egyenleget mutatjuk. Ha a szerver már levonta, töröljük a pendinget.
 */
export function applyPendingRedeemToWallet(data: PointWalletData): PointWalletData {
  const pending = readPendingPointsRedeem()
  if (!pending) return data

  if (pending.balanceBefore != null) {
    const expected = Math.max(0, pending.balanceBefore - pending.pointsUsed)
    // Szerver már levonta (vagy még alacsonyabb): pending kész
    if (data.balance <= expected) {
      clearPendingPointsRedeem()
      return data
    }
  }

  return withDeductedBalance(data, pending.pointsUsed)
}

/**
 * Azonnali (optimista) pontlevonás a fejléc / profil SWR cache-éből.
 * Idempotens ugyanarra a pointsUsed értékre egy oldalbetöltésen belül.
 */
export async function optimisticRedeemPoints(
  pointsUsed: number,
  opts?: { persist?: boolean; balanceBefore?: number }
) {
  if (!pointsUsed || pointsUsed <= 0) return
  if (opts?.persist) {
    stashPendingPointsRedeem(pointsUsed, opts.balanceBefore)
  }
  if (appliedPendingInMemory === pointsUsed) return
  appliedPendingInMemory = pointsUsed
  await mutate<PointWalletData>(
    POINT_WALLET_SWR_KEY,
    (prev) => {
      if (!prev) return prev
      // Ha a cache már a várt egyenlegen van, ne vonjunk újra
      if (
        typeof opts?.balanceBefore === 'number' &&
        Number.isFinite(opts.balanceBefore) &&
        prev.balance <= Math.max(0, opts.balanceBefore - pointsUsed)
      ) {
        return prev
      }
      return withDeductedBalance(prev, pointsUsed)
    },
    { revalidate: false }
  )
}

/** sessionStorage pending alkalmazása (Stripe visszatérés / siker oldal). */
export async function applyStashedPointsRedeemOnce() {
  const pending = readPendingPointsRedeem()
  if (!pending) return
  await optimisticRedeemPoints(pending.pointsUsed, {
    persist: false,
    ...(pending.balanceBefore != null ? { balanceBefore: pending.balanceBefore } : {}),
  })
}

/** Szerver egyenleggel szinkronizál (finalize után). */
export async function syncPointWalletAfterPayment(newBalance?: number) {
  clearPendingPointsRedeem()
  if (typeof newBalance === 'number' && Number.isFinite(newBalance)) {
    const bal = Math.max(0, Math.floor(newBalance))
    await mutate<PointWalletData>(
      POINT_WALLET_SWR_KEY,
      (prev) =>
        prev
          ? {
              ...prev,
              balance: bal,
              canRedeem: bal >= prev.redeemThreshold && !prev.suspended && !prev.hasActiveCoupon,
            }
          : prev,
      { revalidate: true }
    )
    return
  }
  await mutate(POINT_WALLET_SWR_KEY)
}

/**
 * Stripe megszakítás / elállás: pending optimista pontlevonás törlése +
 * azonnali wallet revalidáció (tényleges DB egyenleg).
 */
export async function resetPendingPointsAfterCancelledCheckout() {
  clearPendingPointsRedeem()
  await mutate(POINT_WALLET_SWR_KEY)
}

/** Kijelentkezéskor: SWR wallet cache ürítése (következő user ne lássa a régit). */
export async function clearPointWalletCache() {
  clearPendingPointsRedeem()
  await mutate(POINT_WALLET_SWR_KEY, undefined, { revalidate: false })
}
