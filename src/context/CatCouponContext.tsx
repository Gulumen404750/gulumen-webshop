'use client'

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'
import { useAuth } from './AuthContext'
import {
  clearGoogleAuthPending,
  readGoogleAuthPending,
} from '@/lib/google-auth-pending'

const STORAGE_PREFIX_CAT = 'gulumen-cat-coupon-'
const STORAGE_PREFIX_REG = 'gulumen-registration-coupon-'
/** Régi egykulcsos formátum – migrációhoz */
const STORAGE_PREFIX_LEGACY = 'gulumen-cat-coupon-'

import {
  CAT_COUPON_PERCENT,
  REGISTRATION_COUPON_PERCENT,
} from '@/lib/coupon-config'

export type CatCouponStatus = 'not_claimed' | 'claimed' | 'used'

type StoredCoupon = { status: 'claimed' | 'used'; percent: number }

type CatCouponContextValue = {
  status: CatCouponStatus
  /** Csak az 5%-os macska kupon állapota – e-mailhez kötve, a modál ezt használja */
  catStatus: CatCouponStatus
  /** 10%-os regisztrációs kupon állapota */
  registrationStatus: CatCouponStatus
  isDiscountActive: boolean
  activate: () => boolean
  /**
   * Fizetés után: szerver állapotról szinkronizál (a tényleges égetés a
   * finalize-rewards / webhook feladata – ne jelöljön minden kupont used-ra).
   */
  markUsed: () => void
  discountPercent: number
  claimRegistrationCoupon: (userId: string) => boolean
}

const CatCouponContext = createContext<CatCouponContextValue | null>(null)

/** E-mail kulcs – mindig kisbetű, hogy regisztráció és bejelentkezés egyezzen. */
export function normalizeCouponUserId(userId: string): string {
  return userId.trim().toLowerCase()
}

function getCatKey(userId: string): string {
  return `${STORAGE_PREFIX_CAT}${normalizeCouponUserId(userId)}`
}
function getRegKey(userId: string): string {
  return `${STORAGE_PREFIX_REG}${normalizeCouponUserId(userId)}`
}
function getLegacyKey(userId: string): string {
  return `${STORAGE_PREFIX_LEGACY}${normalizeCouponUserId(userId)}`
}

function writeStored(key: string, data: StoredCoupon): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(key, JSON.stringify(data))
}

async function syncPromoCouponsFromServer(uid: string | null): Promise<void> {
  if (!uid || typeof window === 'undefined') return
  try {
    const res = await fetch('/api/me/promo-coupons', { credentials: 'include' })
    if (!res.ok) return
    const data = (await res.json()) as {
      cat?: 'claimed' | 'used' | null
      registration?: 'claimed' | 'used' | null
    }
    const normalized = normalizeCouponUserId(uid)
    if (data.cat === 'claimed') {
      writeStored(getCatKey(normalized), { status: 'claimed', percent: CAT_COUPON_PERCENT * 100 })
    } else if (data.cat === 'used') {
      writeStored(getCatKey(normalized), { status: 'used', percent: 5 })
    }
    if (data.registration === 'claimed') {
      writeStored(getRegKey(normalized), { status: 'claimed', percent: REGISTRATION_COUPON_PERCENT * 100 })
    } else if (data.registration === 'used') {
      writeStored(getRegKey(normalized), { status: 'used', percent: 10 })
    }
  } catch {
    // offline / nincs DB – localStorage marad
  }
}

async function claimPromoOnServer(kind: 'cat' | 'registration'): Promise<void> {
  try {
    await fetch('/api/me/promo-coupons', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind }),
    })
  } catch {
    // localStorage fallback
  }
}

function readStored(key: string): StoredCoupon | null {
  if (typeof window === 'undefined') return null
  const raw = localStorage.getItem(key)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as StoredCoupon
    if (parsed?.status && typeof parsed.percent === 'number') return parsed
  } catch {}
  if (raw === 'claimed' || raw === 'used') {
    return { status: raw, percent: 5 }
  }
  return null
}

/** Régi egy kulcsos formátum migrálása: 5% → macska, 10% → regisztráció */
function migrateLegacy(uid: string): void {
  if (typeof window === 'undefined') return
  const legacyKey = getLegacyKey(uid)
  const raw = localStorage.getItem(legacyKey)
  if (!raw) return
  const catKey = getCatKey(uid)
  const regKey = getRegKey(uid)
  if (localStorage.getItem(catKey) || localStorage.getItem(regKey)) return
  try {
    const parsed = JSON.parse(raw) as { status?: string; percent?: number }
    const status = parsed?.status === 'used' ? 'used' : 'claimed'
    const pct = typeof parsed?.percent === 'number' ? parsed.percent : 5
    if (Math.abs(pct - 10) < 1) {
      localStorage.setItem(regKey, JSON.stringify({ status, percent: 10 }))
    } else {
      localStorage.setItem(catKey, JSON.stringify({ status, percent: 5 }))
    }
    localStorage.removeItem(legacyKey)
  } catch {
    localStorage.removeItem(legacyKey)
  }
}

function readCat(uid: string | null): StoredCoupon | null {
  if (!uid) return null
  migrateLegacy(uid)
  return readStored(getCatKey(uid))
}
function readReg(uid: string | null): StoredCoupon | null {
  if (!uid) return null
  migrateLegacy(uid)
  return readStored(getRegKey(uid))
}

function couponStatus(stored: StoredCoupon | null): CatCouponStatus {
  if (!stored) return 'not_claimed'
  return stored.status
}

function combinedStatus(userId: string | null): CatCouponStatus {
  const cat = readCat(userId)
  const reg = readReg(userId)
  if (cat?.status === 'used' && reg?.status === 'used') return 'used'
  if (cat?.status === 'used' && !reg) return 'used'
  if (reg?.status === 'used' && !cat) return 'used'
  if (cat?.status === 'claimed' || reg?.status === 'claimed') return 'claimed'
  return 'not_claimed'
}

function catOnlyStatus(userId: string | null): CatCouponStatus {
  return couponStatus(readCat(userId))
}

function regOnlyStatus(userId: string | null): CatCouponStatus {
  return couponStatus(readReg(userId))
}

function combinedPercent(userId: string | null): number {
  const cat = readCat(userId)
  const reg = readReg(userId)
  let p = 0
  if (cat?.status === 'claimed') p += CAT_COUPON_PERCENT
  if (reg?.status === 'claimed') p += REGISTRATION_COUPON_PERCENT
  return p
}

export function CatCouponProvider({ children }: { children: ReactNode }) {
  const { userId, authChecked, isNewUser } = useAuth()
  const [status, setStatus] = useState<CatCouponStatus>('not_claimed')
  const [catStatus, setCatStatus] = useState<CatCouponStatus>('not_claimed')
  const [registrationStatus, setRegistrationStatus] = useState<CatCouponStatus>('not_claimed')
  const [storedPercent, setStoredPercent] = useState(0)

  const refresh = useCallback((uid: string | null) => {
    setStatus(combinedStatus(uid))
    setCatStatus(catOnlyStatus(uid))
    setRegistrationStatus(regOnlyStatus(uid))
    setStoredPercent(combinedPercent(uid))
  }, [])

  useEffect(() => {
    if (!userId || !authChecked) return
    void (async () => {
      await syncPromoCouponsFromServer(userId)
      const cat = readCat(userId)
      const reg = readReg(userId)
      if (cat?.status === 'claimed') await claimPromoOnServer('cat')
      if (reg?.status === 'claimed') await claimPromoOnServer('registration')
      refresh(userId)
    })()
  }, [userId, authChecked, refresh])

  useEffect(() => {
    refresh(userId)
  }, [userId, refresh])

  const activate = useCallback((): boolean => {
    if (!userId) return false
    const cat = readCat(userId)
    if (cat?.status) return false
    const payload: StoredCoupon = { status: 'claimed', percent: CAT_COUPON_PERCENT * 100 }
    localStorage.setItem(getCatKey(userId), JSON.stringify(payload))
    void claimPromoOnServer('cat')
    refresh(userId)
    return true
  }, [userId, refresh])

  const claimRegistrationCoupon = useCallback(
    (uid: string): boolean => {
      if (typeof window === 'undefined') return false
      const normalized = normalizeCouponUserId(uid)
      const reg = readReg(normalized)
      if (reg?.status) return false
      const payload: StoredCoupon = { status: 'claimed', percent: REGISTRATION_COUPON_PERCENT * 100 }
      localStorage.setItem(getRegKey(normalized), JSON.stringify(payload))
      if (userId && normalizeCouponUserId(userId) === normalized) {
        void claimPromoOnServer('registration')
        refresh(userId)
      }
      return true
    },
    [userId, refresh]
  )

  useEffect(() => {
    if (!authChecked || !userId) return
    const pending = readGoogleAuthPending()
    if (!pending) return
    // Új Google fióknál a NewUserConsentGate kezeli a hozzájárulást + kupont.
    if (isNewUser) return
    // Meglévő fiók: soha ne aktiváljunk regisztrációs kupont a pendingből.
    clearGoogleAuthPending()
  }, [userId, isNewUser, authChecked])

  const markUsed = useCallback(() => {
    if (!userId) return
    void (async () => {
      await syncPromoCouponsFromServer(userId)
      refresh(userId)
    })()
  }, [userId, refresh])

  const isDiscountActive = status === 'claimed' && storedPercent > 0
  const value: CatCouponContextValue = {
    status,
    catStatus,
    registrationStatus,
    isDiscountActive,
    activate,
    markUsed,
    discountPercent: storedPercent,
    claimRegistrationCoupon,
  }

  return <CatCouponContext.Provider value={value}>{children}</CatCouponContext.Provider>
}

export function useCatCoupon(): CatCouponContextValue {
  const ctx = useContext(CatCouponContext)
  if (!ctx) throw new Error('useCatCoupon must be used within CatCouponProvider (inside AuthProvider)')
  return ctx
}
