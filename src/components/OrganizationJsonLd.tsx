import { organizationSchema, websiteSchema } from '@/i18n/seo'
import type { Locale } from '@/i18n/locales'

type Props = { locale?: Locale }

export function OrganizationJsonLd({ locale = 'hu' }: Props) {
  const org = organizationSchema(locale)
  const site = websiteSchema(locale)
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(org) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(site) }}
      />
    </>
  )
}
