import type { MetadataRoute } from 'next'
import { getAllProductsAsync, categories } from '@/lib/data'
import { SEO_LOCALES, localizePath } from '@/i18n/routing'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://gulumen.hu'

function localizedUrls(internalPath: string, search = ''): MetadataRoute.Sitemap {
  return SEO_LOCALES.map((locale) => ({
    url: `${BASE_URL}${localizePath(internalPath, locale, search)}`,
    lastModified: new Date(),
    changeFrequency: internalPath === '/' ? ('daily' as const) : ('weekly' as const),
    priority: internalPath === '/' ? 1 : 0.85,
    alternates: {
      languages: Object.fromEntries([
        ...SEO_LOCALES.map((l) => [l, `${BASE_URL}${localizePath(internalPath, l, search)}`]),
        ['x-default', `${BASE_URL}${localizePath(internalPath, 'en', search)}`],
      ]),
    },
  }))
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticInternal = [
    '/',
    '/termekek',
    '/ujdonsagok',
    '/akciok',
    '/beszerzesre-rendelheto',
    '/szallitas',
    '/visszakuldes',
    '/kapcsolat',
    '/regisztracio',
  ]

  const staticPages: MetadataRoute.Sitemap = staticInternal.flatMap((path) =>
    localizedUrls(path)
  )

  const categoryPages: MetadataRoute.Sitemap = categories.flatMap((cat) =>
    localizedUrls('/termekek', `?kategoria=${cat.slug}`)
  )

  let productPages: MetadataRoute.Sitemap = []
  try {
    const products = await getAllProductsAsync()
    productPages = products.flatMap((p) => localizedUrls(`/termek/${p.slug}`))
  } catch {
    // Build time or no DB: sitemap without product URLs
  }

  return [...staticPages, ...categoryPages, ...productPages]
}
