'use client'

import { useLocale } from '@/context/LocaleContext'

/** Client heading that resolves a translation key (for server pages that pass product grids). */
export function PageHeading({
  titleKey,
  className = 'font-heading text-2xl font-bold text-foreground mb-8',
}: {
  titleKey: string
  className?: string
}) {
  const { t } = useLocale()
  return <h1 className={className}>{t(titleKey)}</h1>
}

export function PageEmptyMessage({
  messageKey,
  className = 'text-muted text-center py-12',
}: {
  messageKey: string
  className?: string
}) {
  const { t } = useLocale()
  return <p className={className}>{t(messageKey)}</p>
}
