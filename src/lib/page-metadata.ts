import type { Metadata } from 'next'
import { getServerLocale } from '@/lib/locale-server'
import { getTranslations, t } from '@/i18n/translations'
import { buildLocalizedMetadata, getSiteCopy } from '@/lib/site-metadata'

/** Locale-aware page metadata from a seo.* title key. */
export async function pageMetadata(
  pathname: string,
  titleKey: string
): Promise<Metadata> {
  const locale = await getServerLocale()
  const dict = getTranslations(locale)
  const copy = getSiteCopy(locale)
  return buildLocalizedMetadata({
    pathname,
    title: t(dict, titleKey),
    description: copy.description,
  })
}
