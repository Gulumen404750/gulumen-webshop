const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://gulumen.hu'

export function OrganizationJsonLd() {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Gulumen',
    url: BASE_URL,
    logo: `${BASE_URL}/img/logo.png`,
    description:
      'Kedves, családias webáruház mindenkinek – praktikus és szerethető dolgok az otthonba. Télen, nyáron, a mindennapokban veletek vagyunk, mint egy nagy család.',
  }
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  )
}
