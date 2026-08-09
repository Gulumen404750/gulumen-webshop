'use client'

import { useState, useEffect, useRef } from 'react'
import type { Product } from '@/lib/data'
import { isSaleActive } from '@/lib/storefront-config'
import { useLocale } from '@/context/LocaleContext'

const DAY_MS = 86_400_000

function formatHoursCountdown(ms: number): string {
  if (ms <= 0) return '00:00:00'
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  const s = Math.floor((ms % 60_000) / 1000)
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':')
}

function getSaleRemainingLabel(
  ms: number,
  t: (key: string, params?: Record<string, string | number>) => string
): { text: string; urgent: boolean } {
  if (ms <= 0) return { text: '', urgent: false }
  if (ms >= DAY_MS) {
    const days = Math.ceil(ms / DAY_MS)
    return { text: t('status.saleDaysLeft', { count: days }), urgent: false }
  }
  return { text: `${t('status.endsIn')}: ${formatHoursCountdown(ms)}`, urgent: true }
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-13a.75.75 0 00-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 000-1.5h-3.25V5z"
        clipRule="evenodd"
      />
    </svg>
  )
}

type Props = {
  product: Product
  variant?: 'overlay' | 'inline'
  onExpired?: () => void
}

export function SaleCountdown({ product, variant = 'overlay', onExpired }: Props) {
  const { t } = useLocale()
  const [remaining, setRemaining] = useState<number | null>(null)
  const expiredFiredRef = useRef(false)

  useEffect(() => {
    if (!product.saleEndAt || !isSaleActive(product)) return
    const end = new Date(product.saleEndAt).getTime()
    const tick = () => {
      const ms = Math.max(0, end - Date.now())
      setRemaining(ms)
      if (ms <= 0 && onExpired && !expiredFiredRef.current) {
        expiredFiredRef.current = true
        onExpired()
      }
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [product, onExpired])

  if (!isSaleActive(product)) return null
  if (remaining == null || !product.saleEndAt) return null

  const { text, urgent } = getSaleRemainingLabel(remaining, t)
  if (!text) return null

  if (variant === 'inline') {
    return (
      <span
        aria-live="polite"
        aria-atomic="true"
        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium border ${
          urgent
            ? 'bg-discount/15 text-discount border-discount/30 sale-countdown-urgent'
            : 'bg-discount/10 text-discount border-discount/20'
        }`}
      >
        <ClockIcon className="w-3.5 h-3.5 shrink-0 opacity-80" />
        <span className="tabular-nums">{text}</span>
      </span>
    )
  }

  return (
    <div
      className={`absolute inset-x-0 bottom-0 z-[5] px-3 pb-2.5 pt-8 bg-gradient-to-t from-black/80 via-black/45 to-transparent pointer-events-none ${
        urgent ? 'sale-countdown-urgent' : ''
      }`}
    >
      <div
        aria-live="polite"
        aria-atomic="true"
        className="flex items-center justify-center gap-1.5 text-white text-xs font-medium"
      >
        <ClockIcon className="w-3.5 h-3.5 shrink-0 opacity-90" />
        <span className={`tabular-nums tracking-wide ${urgent ? 'font-semibold' : ''}`}>{text}</span>
      </div>
    </div>
  )
}
