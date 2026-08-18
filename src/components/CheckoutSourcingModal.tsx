'use client'

import { useEffect, useRef, useState } from 'react'
import { useLocale } from '@/context/LocaleContext'
import { useDisplayMoney } from '@/hooks/useDisplayMoney'
import { useFocusTrap } from '@/hooks/useFocusTrap'

type Props = {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
}

export function CheckoutSourcingModal({ isOpen, onClose, onConfirm }: Props) {
  const { t } = useLocale()
  const { copy } = useDisplayMoney()
  const [accepted, setAccepted] = useState(false)
  const prevOpen = useRef(false)
  const dialogRef = useRef<HTMLDivElement>(null)

  useFocusTrap(dialogRef, isOpen)

  useEffect(() => {
    if (isOpen) setAccepted(false)
  }, [isOpen])

  useEffect(() => {
    if (!prevOpen.current && isOpen) prevOpen.current = true
    if (prevOpen.current && !isOpen) prevOpen.current = false
  }, [isOpen])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const handleConfirm = () => {
    if (!accepted) return
    onConfirm()
    onClose()
  }

  return (
    <>
      <div
        className="fixed inset-0 z-[70] bg-black/60"
        aria-hidden
        onClick={onClose}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="checkout-sourcing-title"
        className="fixed left-1/2 top-1/2 z-[71] w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl border border-[var(--border)] bg-[var(--card-bg)] p-6 shadow-xl"
      >
        <h2 id="checkout-sourcing-title" className="font-heading text-lg font-bold text-foreground mb-4">
          {t('cart.blockSourcingTitle')}
        </h2>
        <p className="text-sm text-muted whitespace-pre-line mb-4">{t('pages.shipping.sourcingFullDescription', copy)}</p>
        <div className="mb-6">
          <label className="flex gap-3 cursor-pointer items-start">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
              className="mt-1 w-4 h-4 shrink-0 rounded border-[var(--border)] text-accent focus:ring-accent"
              aria-describedby="checkout-sourcing-disclaimer"
            />
            <span id="checkout-sourcing-disclaimer" className="text-sm text-foreground">
              {t('cart.sourcingDisclaimerAccept')}
            </span>
          </label>
        </div>
        <div className="flex flex-wrap gap-3 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="py-2.5 px-4 border-2 border-[var(--border)] text-foreground font-medium rounded-lg hover:bg-[var(--border)] transition-colors"
          >
            {t('buttons.cancel')}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!accepted}
            className="py-2.5 px-4 bg-accent text-white font-heading font-semibold rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t('cart.checkoutConfirmButton')}
          </button>
        </div>
      </div>
    </>
  )
}
