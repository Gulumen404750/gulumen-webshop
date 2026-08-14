import type { MetadataRoute } from 'next'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://gulumen.hu'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/fizetes',
          '/fizetes/',
          '/kosar',
          '/profil',
          '/regisztracio',
          '/kedvencek',
        ],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  }
}
