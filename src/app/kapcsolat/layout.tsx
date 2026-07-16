import type { Metadata } from 'next'
import { getRequestLocale } from '@/lib/locale-server'
import { getTranslations, t } from '@/i18n/translations'
import { buildPageMetadata, getSiteDescription } from '@/i18n/seo'

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale()
  const dict = getTranslations(locale)
  return buildPageMetadata({
    locale,
    title: `${t(dict, 'pages.contactTitle')} – Gulumen`,
    description: getSiteDescription(locale),
    internalPath: '/kapcsolat',
  })
}

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children
}
