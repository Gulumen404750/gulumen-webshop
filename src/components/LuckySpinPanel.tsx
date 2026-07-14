'use client'

import { useState } from 'react'
import { useLocale } from '@/context/LocaleContext'
import { useLuckySpin } from '@/hooks/useLuckySpin'
import { LuckySpinModal } from '@/components/LuckySpinModal'
import { LUCKY_SPIN_MIN_LIKES } from '@/lib/gamification/constants'

export function LuckySpinPanel() {
  const { t } = useLocale()
  const { data, spinWheel } = useLuckySpin(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [spinning, setSpinning] = useState(false)

  const label = data?.isActive ? t('luckySpin.offerActive') : t('luckySpin.title')
  const likesCount = data?.likesCount ?? 0
  const isEligible = data?.isEligible ?? false

  const handleSpin = async () => {
    setSpinning(true)
    try {
      return await spinWheel()
    } catch {
      return null
    } finally {
      setSpinning(false)
    }
  }

  const hint = !isEligible
    ? t('luckySpin.collectFavorites')
    : data?.isActive
      ? t('luckySpin.discountHint')
      : data?.canSpin
        ? t('luckySpin.subtitle')
        : data?.nextSpinAt
          ? t('luckySpin.nextSpin')
          : t('luckySpin.subtitle')

  return (
    <>
      <section className="mb-8 p-4 sm:p-5 rounded-xl border border-accent/25 bg-accent/5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <span
              className={`text-3xl shrink-0 ${!isEligible ? 'grayscale opacity-50' : ''}`}
              aria-hidden
            >
              🎡
            </span>
            <div className="min-w-0">
              <h2 className="font-heading text-lg font-semibold text-foreground">{label}</h2>
              <p className="text-sm text-muted mt-1">{hint}</p>
              {!isEligible && (
                <p className="text-xs text-muted mt-1 tabular-nums">
                  {likesCount} / {LUCKY_SPIN_MIN_LIKES}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="shrink-0 px-5 py-2.5 bg-accent text-white text-sm font-semibold rounded-xl hover:opacity-90 transition-opacity"
          >
            {data?.isActive ? t('luckySpin.offerActive') : t('luckySpin.spinCta')}
          </button>
        </div>
      </section>
      <LuckySpinModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        data={data}
        onSpin={handleSpin}
        spinning={spinning}
      />
    </>
  )
}
