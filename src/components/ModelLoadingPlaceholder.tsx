'use client'

import { useLocale } from '@/context/LocaleContext'

export function ModelLoadingPlaceholder({
  className = 'min-h-[280px] flex items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--card-bg)] text-muted',
}: {
  className?: string
}) {
  const { t } = useLocale()
  return <div className={className}>{t('product.loadingModel')}</div>
}
