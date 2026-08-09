'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { useLocale } from '@/context/LocaleContext'

type Props = {
  isOpen: boolean
  onClose: () => void
  children: ReactNode
}

export function ShopFiltersDrawer({ isOpen, onClose, children }: Props) {
  const { t } = useLocale()
  const drawerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [isOpen, onClose])

  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <>
      <div
        className="fixed inset-0 z-[55] bg-black/50 lg:hidden"
        aria-hidden
        onClick={onClose}
      />
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label={t('common.filters')}
        className="fixed inset-x-0 bottom-0 z-[60] lg:hidden max-h-[min(85vh,640px)] rounded-t-2xl bg-[var(--card-bg)] border-t border-[var(--border)] shadow-xl flex flex-col"
        style={{ paddingBottom: 'max(0px, env(safe-area-inset-bottom))' }}
      >
        <div className="flex justify-center pt-3 pb-1 shrink-0" aria-hidden>
          <div className="w-10 h-1 rounded-full bg-[var(--border)]" />
        </div>
        <div className="flex items-center justify-between px-4 pb-3 border-b border-[var(--border)] shrink-0">
          <h2 className="font-heading text-lg font-bold text-foreground">{t('common.filters')}</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-muted hover:text-foreground hover:bg-[var(--border)]"
            aria-label={t('buttons.close')}
          >
            <CloseIcon className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">{children}</div>
      </div>
    </>
  )
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}
