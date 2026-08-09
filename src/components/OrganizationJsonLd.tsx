const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://gulumen.hu'

export function OrganizationJsonLd() {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Gulumen',
    url: BASE_URL,
    logo: `${BASE_URL}/og-image.png`,
    image: `${BASE_URL}/og-image.png`,
    description:
      'Szerethető és hasznos kiegészítők a család minden tagjának, télen-nyáron. A te otthonod, a mi szívügyünk.',
  }
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  )
}
