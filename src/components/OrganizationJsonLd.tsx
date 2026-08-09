import { getServerLocale } from '@/lib/locale-server'
import { getSiteCopy, BASE_URL } from '@/lib/site-metadata'

export async function OrganizationJsonLd() {
  const locale = await getServerLocale()
  const { organizationDescription } = getSiteCopy(locale)
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Gulumen',
    url: BASE_URL,
    logo: `${BASE_URL}/og-image.png`,
    image: `${BASE_URL}/og-image.png`,
    description: organizationDescription,
    inLanguage: locale,
  }
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  )
}
