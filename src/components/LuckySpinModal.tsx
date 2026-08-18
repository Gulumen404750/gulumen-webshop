'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useLocale } from '@/context/LocaleContext'
import { intlLocaleFor } from '@/lib/display-money'
import type { LuckySpinData } from '@/hooks/useLuckySpin'

type Props = {
  isOpen: boolean
  onClose: () => void
  data: LuckySpinData | null | undefined
  onSpin: () => Promise<LuckySpinData | null>
  spinning: boolean
}

function useCountdown(expiresAt: string | null | undefined) {
  const [remaining, setRemaining] = useState('')

  useEffect(() => {
    if (!expiresAt) {
      setRemaining('')
      return
    }
    const tick = () => {
      const diff = new Date(expiresAt).getTime() - Date.now()
      if (diff <= 0) {
        setRemaining('00:00:00')
        return
      }
      const h = Math.floor(diff / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      setRemaining(
        `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
      )
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [expiresAt])

  return remaining
}

export function LuckySpinModal({ isOpen, onClose, data, onSpin, spinning }: Props) {
  const { t, locale } = useLocale()
  const [spinData, setSpinData] = useState<LuckySpinData | null | undefined>(data)
  const displayData = spinData ?? data
  const countdown = useCountdown(displayData?.spin?.expiresAt)
  const [animating, setAnimating] = useState(false)
  const [spinError, setSpinError] = useState<string | null>(null)
  const [termsAccepted, setTermsAccepted] = useState(false)

  useEffect(() => {
    if (data) setSpinData(data)
  }, [data])

  useEffect(() => {
    if (!isOpen) {
      setTermsAccepted(false)
      setSpinError(null)
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleSpin = async () => {
    if (!termsAccepted) return
    setSpinError(null)
    setAnimating(true)
    try {
      const result = await onSpin()
      if (result?.isActive && result.spin) {
        setSpinData(result)
      } else if (!result) {
        setSpinError(t('luckySpin.spinFailed'))
      }
    } catch {
      setSpinError(t('luckySpin.spinFailed'))
    } finally {
      setTimeout(() => setAnimating(false), 2000)
    }
  }

  const isActive = displayData?.isActive && displayData.spin
  const canSpin = displayData?.canSpin
  const isEligible = displayData?.isEligible ?? false
  const likesCount = displayData?.likesCount ?? 0
  const tierText = t('luckySpin.discountTiers')

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={t('luckySpin.title')}
    >
      <div
        className="relative w-full max-w-lg rounded-2xl border border-[var(--border)] bg-[var(--card-bg)] shadow-2xl p-5 sm:p-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-lg text-muted hover:text-foreground hover:bg-[var(--border)]"
          aria-label={t('buttons.close')}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="grid gap-3 pr-8">
          <h2 className="font-heading text-xl font-bold text-foreground leading-tight">
            {isActive ? t('luckySpin.offerActive') : t('luckySpin.title')}
          </h2>
          <p className="text-sm text-muted leading-tight">
            {isActive ? tierText : t('luckySpin.subtitle')}
          </p>
        </div>

        {spinError && (
          <p className="text-sm text-red-600 dark:text-red-400 mt-3 leading-tight" role="alert">
            {spinError}
          </p>
        )}

        {!isEligible && (
          <div className="flex flex-col items-center gap-3 py-5">
            <div
              className="relative w-36 h-36 rounded-full border-4 border-[var(--border)] flex items-center justify-center opacity-50 grayscale"
              style={{ background: 'conic-gradient(from 0deg, #9ca3af 0deg 360deg)' }}
            >
              <div className="w-14 h-14 rounded-full bg-[var(--card-bg)] border-2 border-[var(--border)] flex items-center justify-center text-2xl">
                🎡
              </div>
            </div>
            <p className="text-sm font-medium text-muted text-center leading-tight">
              {t('luckySpin.collectFavorites')}
            </p>
            <p className="text-xs text-muted tabular-nums">{likesCount} / 20</p>
          </div>
        )}

        {isEligible && canSpin && !isActive && (
          <div className="flex flex-col items-center gap-4 py-4">
            <div
              className={`relative w-36 h-36 rounded-full border-4 border-accent/30 flex items-center justify-center ${
                animating || spinning ? 'animate-spin-slow' : ''
              }`}
              style={{
                background:
                  'conic-gradient(from 0deg, var(--accent) 0deg 45deg, #f59e0b 45deg 90deg, #ec4899 90deg 135deg, #8b5cf6 135deg 180deg, var(--accent) 180deg 225deg, #f59e0b 225deg 270deg, #ec4899 270deg 315deg, #8b5cf6 315deg 360deg)',
              }}
            >
              <div className="w-14 h-14 rounded-full bg-[var(--card-bg)] border-2 border-[var(--border)] flex items-center justify-center text-2xl">
                🎡
              </div>
            </div>
            <p className="text-sm text-center text-muted leading-tight max-w-sm px-2">{tierText}</p>
            <label className="flex items-start gap-3 cursor-pointer group w-full max-w-sm px-2">
              <input
                type="checkbox"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-2 border-[var(--border)] bg-background text-accent focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-[var(--card-bg)] accent-[var(--accent)]"
              />
              <span className="text-sm text-foreground leading-tight group-hover:text-accent transition-colors">
                {t('luckySpin.acceptTerms')}
              </span>
            </label>
            <button
              type="button"
              onClick={handleSpin}
              disabled={!termsAccepted || spinning || animating}
              className="px-6 py-3 bg-accent text-white font-semibold rounded-xl hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
            >
              {spinning || animating ? t('luckySpin.spinning') : t('luckySpin.spinCta')}
            </button>
          </div>
        )}

        {isActive && displayData.spin && (
          <div className="mt-4 grid gap-4">
            <div className="grid grid-cols-[1fr_auto] items-center gap-3 p-3 rounded-xl bg-accent/10 border border-accent/20">
              <span className="text-sm font-medium text-foreground leading-tight">{t('luckySpin.expiresIn')}</span>
              <span className="font-mono text-lg font-bold text-accent tabular-nums">{countdown}</span>
            </div>

            <p className="text-sm text-foreground leading-tight">{tierText}</p>

            <ul className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {displayData.spin.products.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/termek/${p.slug}`}
                    onClick={onClose}
                    className="block rounded-xl border border-[var(--border)] overflow-hidden hover:border-accent transition-colors group"
                  >
                    <div className="relative aspect-square bg-[var(--border)]">
                      <Image
                        src={p.image}
                        alt={p.name}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform"
                        sizes="120px"
                      />
                    </div>
                    <p className="p-2 text-xs font-medium text-foreground line-clamp-2 leading-tight">{p.name}</p>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        {isEligible && !canSpin && !isActive && displayData?.nextSpinAt && (
          <p className="text-sm text-muted text-center py-6 leading-tight">
            {t('luckySpin.nextSpin')}{' '}
            {new Date(displayData.nextSpinAt).toLocaleDateString(intlLocaleFor(locale), {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
          </p>
        )}
      </div>
    </div>
  )
}
