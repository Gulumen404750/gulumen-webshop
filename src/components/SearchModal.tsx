'use client'

import { useRouter } from 'next/navigation'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useLocale } from '@/context/LocaleContext'

type Props = { isOpen: boolean; onClose: () => void }

export function SearchModal({ isOpen, onClose }: Props) {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const { t } = useLocale()

  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isOpen])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [isOpen, onClose])

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      const q = query.trim()
      if (q) {
        const params = new URLSearchParams()
        params.set('kereses', q)
        router.push(`/termekek?${params.toString()}`)
      } else {
        router.push('/termekek')
      }
      onClose()
    },
    [query, router, onClose]
  )

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center pt-[20vh] px-4 bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-label={t('common.search')}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-xl rounded-xl border border-[var(--border)] bg-[var(--card-bg)] shadow-xl p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('common.searchPlaceholder')}
            className="flex-1 px-4 py-3 rounded-lg border border-[var(--border)] bg-background text-foreground placeholder:text-muted"
            autoComplete="off"
            aria-label={t('common.search')}
          />
          <button
            type="submit"
            className="px-4 py-3 bg-accent text-white font-medium rounded-lg hover:opacity-90 transition-opacity"
          >
            {t('common.search')}
          </button>
        </form>
        <p className="mt-2 text-xs text-muted">{t('common.searchHint')}</p>
      </div>
    </div>
  )
}
