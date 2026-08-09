'use client'

import { useEffect } from 'react'
import { useLocale } from '@/context/LocaleContext'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const { t } = useLocale()

  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-4 py-16">
      <h1 className="font-heading text-2xl font-bold text-foreground mb-2">{t('errors.title')}</h1>
      <p className="text-muted text-center max-w-md mb-8">
        {t('errors.message')}
      </p>
      <button
        type="button"
        onClick={reset}
        className="px-6 py-3 bg-accent text-white font-heading font-semibold rounded-lg hover:opacity-90 transition-opacity"
      >
        {t('errors.retry')}
      </button>
      <a
        href="/"
        className="mt-4 text-accent font-medium hover:underline"
      >
        {t('errors.backHome')}
      </a>
    </div>
  )
}
