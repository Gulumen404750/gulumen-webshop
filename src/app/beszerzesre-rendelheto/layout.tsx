import type { Metadata } from 'next'
import { getRequestLocale } from '@/lib/locale-server'
import { getTranslations, t } from '@/i18n/translations'
import { buildPageMetadata, getSiteDescription } from '@/i18n/seo'

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale()
  const dict = getTranslations(locale)
  const title = t(dict, 'nav.sourcing')
  return buildPageMetadata({
    locale,
    title: `${title} – Gulumen`,
    description: getSiteDescription(locale),
    internalPath: '/beszerzesre-rendelheto',
  })
}

export default function SourcingLayout({ children }: { children: React.ReactNode }) {
  return children
}
