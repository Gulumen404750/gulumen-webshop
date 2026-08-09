import type { Metadata } from 'next'
import { LOCALES, type Locale } from '@/i18n/locales'
import { getTranslations, t } from '@/i18n/translations'
import { getServerLocale } from '@/lib/locale-server'
import { buildLocalizedUrl, getHreflangAlternates } from '@/lib/hreflang'

const BASE_URL = (process.env.NEXT_PUBLIC_APP_URL || 'https://gulumen.hu').replace(/\/$/, '')
const BRAND_IMAGE = `${BASE_URL}/og-image.png`

export const OG_LOCALE: Record<Locale, string> = {
  hu: 'hu_HU',
  en: 'en_US',
  de: 'de_DE',
  ro: 'ro_RO',
}

export function getSiteCopy(locale: Locale) {
  const dict = getTranslations(locale)
  return {
    title: t(dict, 'seo.title'),
    description: t(dict, 'seo.description'),
    organizationDescription: t(dict, 'seo.organizationDescription'),
    productNotFound: t(dict, 'seo.productNotFound'),
    catHuntTitle: t(dict, 'seo.catHuntTitle'),
  }
}

export function buildLanguageAlternates(pathname: string, search = ''): Record<string, string> {
  const languages: Record<string, string> = {}
  for (const locale of LOCALES) {
    languages[locale] = buildLocalizedUrl(pathname, search, locale)
  }
  languages['x-default'] = buildLocalizedUrl(pathname, search, 'en')
  return languages
}

type LocalizedMetadataOptions = {
  pathname?: string
  search?: string
  title?: string
  description?: string
  canonicalPath?: string
  ogType?: 'website' | 'article'
  images?: NonNullable<Metadata['openGraph']>['images']
  /** Extra Open Graph fields merged into the result. */
  openGraphExtras?: Metadata['openGraph']
}

/**
 * Locale-aware title/description/OG/Twitter + hreflang alternates + canonical.
 */
export async function buildLocalizedMetadata(
  options: LocalizedMetadataOptions = {}
): Promise<Metadata> {
  const locale = await getServerLocale()
  const copy = getSiteCopy(locale)
  const title = options.title ?? copy.title
  const description = options.description ?? copy.description
  const pathname = options.pathname ?? '/'
  const search = options.search ?? ''
  const canonicalPath = options.canonicalPath ?? pathname
  const canonical = `${BASE_URL}${canonicalPath.startsWith('/') ? canonicalPath : `/${canonicalPath}`}`
  const images = options.images ?? [
    {
      url: BRAND_IMAGE,
      width: 1200,
      height: 1200,
      alt: 'Gulumen logo',
    },
  ]

  const languages = buildLanguageAlternates(pathname, search)
  // Ensure link-tag style alternates stay in sync with metadata API.
  void getHreflangAlternates(pathname, search)

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: 'Gulumen',
      type: options.ogType ?? 'website',
      images,
      locale: OG_LOCALE[locale],
      alternateLocale: LOCALES.filter((l) => l !== locale).map((l) => OG_LOCALE[l]),
      ...options.openGraphExtras,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: Array.isArray(images)
        ? images.map((img) => (typeof img === 'string' ? img : 'url' in img ? String(img.url) : BRAND_IMAGE))
        : [BRAND_IMAGE],
    },
    alternates: {
      canonical,
      languages,
    },
  }
}

export { BASE_URL, BRAND_IMAGE }
