import type { MetadataRoute } from 'next'
import { getAllProductsAsync, categories } from '@/lib/data'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://gulumen.hu'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE_URL, lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
    { url: `${BASE_URL}/termekek`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: `${BASE_URL}/ujdonsagok`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.8 },
    { url: `${BASE_URL}/aszf`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE_URL}/szallitas`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE_URL}/visszakuldes`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE_URL}/kapcsolat`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE_URL}/regisztracio`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
  ]

  const categoryPages: MetadataRoute.Sitemap = categories.map((cat) => ({
    url: `${BASE_URL}/termekek?kategoria=${cat.slug}`,
    lastModified: new Date(),
    changeFrequency: 'daily' as const,
    priority: 0.85,
  }))

  let productPages: MetadataRoute.Sitemap = []
  try {
    const products = await getAllProductsAsync()
    productPages = products.map((p) => ({
      url: `${BASE_URL}/termek/${p.slug}`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    }))
  } catch {
    // Build time or no DB: sitemap without product URLs
  }

  return [...staticPages, ...categoryPages, ...productPages]
}
