import type { MetadataRoute } from 'next'
import { LOCALES } from '@/i18n/locales'
import { localizePath } from '@/i18n/routing'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://gulumen.hu'

const PRIVATE_INTERNAL = ['/fizetes', '/kosar', '/profil', '/regisztracio', '/kedvencek'] as const

function localizedDisallows(): string[] {
  const paths: string[] = []
  for (const internal of PRIVATE_INTERNAL) {
    paths.push(internal)
    paths.push(`${internal}/`)
    for (const locale of LOCALES) {
      const localized = localizePath(internal, locale)
      paths.push(localized)
      paths.push(`${localized}/`)
    }
  }
  return paths
}

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/admin', '/admin/', ...localizedDisallows()],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  }
}
