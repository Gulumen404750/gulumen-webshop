'use client'

import { useState, useEffect, useRef } from 'react'
import type { Product } from '@/lib/data'
import { getSourcingDealStatus } from '@/lib/data'
import { useLocale } from '@/context/LocaleContext'

const SOURCING_TIME_REF_KEY = 'gulumen_sourcing_time_ref'
const REF_MAX_AGE_MS = 2 * 60 * 60 * 1000 // 2 óra

/** localStorage: minden lap ugyanazt a ref-et használja, így a számláló nem csúszik el két ablak/lap között. */
function getStoredTimeRef(): { serverRef: number; clientRef: number } | null {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(SOURCING_TIME_REF_KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as { serverRef: number; clientRef: number }
    if (Date.now() - data.clientRef > REF_MAX_AGE_MS) return null
    return data
  } catch {
    return null
  }
}

function setStoredTimeRef(serverRef: number, clientRef: number): void {
  try {
    localStorage.setItem(SOURCING_TIME_REF_KEY, JSON.stringify({ serverRef, clientRef }))
  } catch {
    // ignore
  }
}

/** Formátum: DD:HH:MM:SS */
function formatCountdownDDHHMMSS(ms: number): string {
  if (ms <= 0) return '00:00:00:00'
  const d = Math.floor(ms / 86400000)
  const h = Math.floor((ms % 86400000) / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  const s = Math.floor((ms % 60000) / 1000)
  return [
    String(d).padStart(2, '0'),
    String(h).padStart(2, '0'),
    String(m).padStart(2, '0'),
    String(s).padStart(2, '0'),
  ].join(':')
}

/** forceArchivingSoon: lejárt termékek oldalon mindig "Hamarosan archiválásra kerül", nincs visszaszámláló. */
/** onExpired: ha a kártya listán lejár/elfogy, egyszer meghívódik – animáció + eltűnés. */
export function SourcingDealCardCountdown({
  product,
  serverNow: serverNowProp,
  forceArchivingSoon,
  onExpired,
}: {
  product: Product
  serverNow?: number
  forceArchivingSoon?: boolean
  onExpired?: (productId: string) => void
}) {
  const { t } = useLocale()
  const [nowMs, setNowMs] = useState<number | null>(null)
  const getAdjustedNowMsRef = useRef<() => number>(() => Date.now())
  const onExpiredFiredRef = useRef(false)

  useEffect(() => {
    if (forceArchivingSoon) return
    // Frissítéskor mindig a szerver aktuális idejét használjuk, ne a régi localStorage ref-et –
    // így a számláló nem indul újra és a lejárt termékek konzisztensek maradnak.
    if (serverNowProp != null) {
      const clientRef = Date.now()
      setStoredTimeRef(serverNowProp, clientRef)
      getAdjustedNowMsRef.current = () => serverNowProp + (Date.now() - clientRef)
    } else {
      const stored = getStoredTimeRef()
      if (stored) {
        getAdjustedNowMsRef.current = () => stored.serverRef + (Date.now() - stored.clientRef)
      } else {
        getAdjustedNowMsRef.current = () => Date.now()
      }
    }
    const getAdjustedNowMs = () => getAdjustedNowMsRef.current()
    setNowMs(getAdjustedNowMs())
    const id = setInterval(() => setNowMs(getAdjustedNowMs()), 1000)
    return () => clearInterval(id)
  }, [])

  if (product.type !== 'sourcing_deal') return null

  // Lejárt termékek oldal: "Lejárt" szöveg, nincs visszaszámláló.
  if (forceArchivingSoon) {
    return (
      <div className="px-3 py-2.5 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-center text-sm font-medium rounded-b-xl">
        {t('status.expired')}
      </div>
    )
  }

  const effectiveCount = product.ordersCount ?? 0

  // Ha a szerver szerint már lejárt (pl. refresh után), azonnal „Hamarosan archiválásra kerül” + onExpired, ne várakozzunk a tickre.
  if (serverNowProp != null) {
    const statusWithServer = getSourcingDealStatus(product, new Date(serverNowProp), effectiveCount)
    if (statusWithServer === 'soldout' || statusWithServer === 'closed') {
      if (onExpired && !onExpiredFiredRef.current) {
        onExpiredFiredRef.current = true
        onExpired(product.id)
      }
      return (
        <div className="px-3 py-2.5 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-center text-sm font-medium rounded-b-xl">
          {t('sourcing.archivingSoon')}
        </div>
      )
    }
  }

  // Hydration: ha van serverNow, első renderre használjuk (szerver és kliens ugyanazt a szöveget rendereli).
  const effectiveNowMs = nowMs ?? serverNowProp ?? null
  if (effectiveNowMs === null) return null

  const status = getSourcingDealStatus(product, new Date(effectiveNowMs), effectiveCount)

  const saleFrom = product.saleFrom ? new Date(product.saleFrom).getTime() : 0
  const saleTo = product.saleTo ? new Date(product.saleTo).getTime() : 0

  // Lejárt vagy elfogyott: csak szöveg, nincs visszaszámláló; lista oldalon egyszer onExpired (animáció + eltűnés).
  if (status === 'soldout' || status === 'closed') {
    if (onExpired && !onExpiredFiredRef.current) {
      onExpiredFiredRef.current = true
      onExpired(product.id)
    }
    return (
      <div className="px-3 py-2.5 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-center text-sm font-medium rounded-b-xl">
        {t('sourcing.archivingSoon')}
      </div>
    )
  }

  if (status === 'preview' && saleFrom - effectiveNowMs > 0) {
    return (
      <div className="px-3 py-2.5 bg-blue-50 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 text-center text-sm font-medium border-y border-blue-200 dark:border-blue-800 rounded-b-xl">
        <span className="font-semibold">{t('status.startsIn')}:</span>{' '}
        <span className="tabular-nums">{formatCountdownDDHHMMSS(saleFrom - effectiveNowMs)}</span>
      </div>
    )
  }

  if (status === 'sale' && saleTo - effectiveNowMs > 0) {
    // Kijelzés: mindig a teljes rendelhető mennyiség (maxOrders - ordersCount). A kosár ne csökkentse.
    const displayAvailable = Math.max(0, (product.maxOrders ?? 0) - (product.ordersCount ?? 0))
    return (
      <div className="px-3 py-2.5 bg-red-50 dark:bg-red-900/40 text-red-800 dark:text-red-200 text-center text-sm font-semibold border-y border-red-200 dark:border-red-800 rounded-b-xl">
        <div>
          <span>{t('status.endsIn')}:</span>{' '}
          <span className="tabular-nums">{formatCountdownDDHHMMSS(saleTo - effectiveNowMs)}</span>
        </div>
        {displayAvailable >= 0 && (
          <div className="text-xs font-medium mt-0.5 opacity-90">
            {t('sourcing.availableCount', { count: displayAvailable })}
          </div>
        )}
      </div>
    )
  }

  return null
}
