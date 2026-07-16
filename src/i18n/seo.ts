import type { Metadata } from 'next'
import type { Locale } from './locales'
import { buildAlternatesLanguages, localizePath, SEO_LOCALES } from './routing'

export const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://gulumen.hu'
export const SITE_NAME = 'Gulumen'

/** Globális meta description – gyártói pozicionálás, nyelvenként. */
export const SITE_DESCRIPTIONS: Record<Locale, string> = {
  hu: 'Gulumen – Prémium, 3D nyomtatott tárgyak Magyarországról. Fedezd fel egyedi kiegészítőinket, amelyekkel otthonod minden szegletét stílusosan és funkcionálisan rendezheted be. Rendelj közvetlenül a gyártótól!',
  en: 'Gulumen – Premium 3D printed products from Hungary. Discover unique accessories to furnish every corner of your home with style and function. Order directly from the manufacturer!',
  de: 'Gulumen – Premium 3D-gedruckte Produkte aus Ungarn. Entdecke einzigartige Accessoires, mit denen du jeden Winkel deines Zuhauses stilvoll und funktional einrichten kannst. Bestelle direkt beim Hersteller!',
  ro: 'Gulumen – Produse premium printate 3D din Ungaria. Descoperă accesorii unice cu care poți amenaja fiecare colț al casei tale cu stil și funcționalitate. Comandă direct de la producător!',
}

export const SITE_TITLES: Record<Locale, string> = {
  hu: 'Gulumen – Prémium 3D nyomtatott termékek gyártója',
  en: 'Gulumen – Premium 3D Printed Products Manufacturer',
  de: 'Gulumen – Hersteller Premium 3D-gedruckter Produkte',
  ro: 'Gulumen – Producător de produse premium printate 3D',
}

/** Főoldal / kategória H1 – egységes SEO címsor. */
export const HERO_H1: Record<Locale, string> = {
  hu: 'Prémium 3D nyomtatott otthoni és funkcionális tárgyak – Gondos kivitelezés, egyedi tervezés.',
  en: 'Premium 3D printed home and functional products – Careful craftsmanship, unique design.',
  de: 'Premium 3D-gedruckte Wohn- und Funktionsartikel – Sorgfältige Ausführung, einzigartiges Design.',
  ro: 'Produse premium printate 3D pentru casă și uz funcțional – Execuție atentă, design unic.',
}

export const OG_LOCALE: Record<Locale, string> = {
  hu: 'hu_HU',
  en: 'en_US',
  de: 'de_DE',
  ro: 'ro_RO',
}

export const KNOWS_ABOUT = [
  '3D printing',
  'Additive manufacturing',
  'Hungarian manufacturer',
] as const

const CATEGORY_META_PREFIX: Record<Locale, string> = {
  hu: '3D nyomtatott',
  en: '3D printed',
  de: '3D-gedruckte',
  ro: 'Printate 3D',
}

export function getSiteDescription(locale: Locale): string {
  return SITE_DESCRIPTIONS[locale] ?? SITE_DESCRIPTIONS.en
}

export function getSiteTitle(locale: Locale): string {
  return SITE_TITLES[locale] ?? SITE_TITLES.en
}

export function categoryMetaTitle(categoryName: string, locale: Locale): string {
  return `${CATEGORY_META_PREFIX[locale]} ${categoryName} – ${SITE_NAME}`
}

export function categoryMetaDescription(categoryName: string, locale: Locale): string {
  const descriptions: Record<Locale, string> = {
    hu: `Prémium 3D nyomtatott ${categoryName} közvetlenül a magyar gyártótól. Egyedi tervezés, gondos kivitelezés – rendelj a Gulumen kínálatából!`,
    en: `Premium 3D printed ${categoryName} directly from the Hungarian manufacturer. Unique design, careful craftsmanship – order from Gulumen!`,
    de: `Premium 3D-gedruckte ${categoryName} direkt vom ungarischen Hersteller. Einzigartiges Design, sorgfältige Ausführung – bestelle bei Gulumen!`,
    ro: `${categoryName} premium printate 3D direct de la producătorul maghiar. Design unic, execuție atentă – comandă de la Gulumen!`,
  }
  return descriptions[locale] ?? descriptions.en
}

export function productsMetaTitle(locale: Locale): string {
  const titles: Record<Locale, string> = {
    hu: '3D nyomtatott termékek – Gulumen',
    en: '3D printed products – Gulumen',
    de: '3D-gedruckte Produkte – Gulumen',
    ro: 'Produse printate 3D – Gulumen',
  }
  return titles[locale] ?? titles.en
}

export function buildPageMetadata(options: {
  locale: Locale
  title: string
  description: string
  internalPath: string
  search?: string
  image?: string
}): Metadata {
  const { locale, title, description, internalPath, search = '', image } = options
  const canonicalPath = localizePath(internalPath, locale, search)
  const canonical = `${BASE_URL}${canonicalPath}`
  const languages = buildAlternatesLanguages(internalPath, search, BASE_URL)
  const ogImage = image ?? `${BASE_URL}/img/logo.png`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: SITE_NAME,
      type: 'website',
      images: [{ url: ogImage, width: 512, height: 512, alt: SITE_NAME }],
      locale: OG_LOCALE[locale],
      alternateLocale: SEO_LOCALES.filter((l) => l !== locale).map((l) => OG_LOCALE[l]),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImage],
    },
    alternates: {
      canonical,
      languages,
    },
  }
}

export function organizationSchema(locale: Locale = 'hu') {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_NAME,
    url: BASE_URL,
    logo: `${BASE_URL}/img/logo.png`,
    description: getSiteDescription(locale),
    knowsAbout: [...KNOWS_ABOUT],
    areaServed: 'EU',
  }
}

export function websiteSchema(locale: Locale = 'hu') {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    url: BASE_URL,
    description: getSiteDescription(locale),
    inLanguage: [...SEO_LOCALES],
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
      url: BASE_URL,
    },
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${BASE_URL}/hu/termekek?kereses={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  }
}
