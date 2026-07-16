import { buildAlternatesLanguages } from '@/i18n/routing'
import { BASE_URL } from '@/i18n/seo'

type Props = {
  internalPath: string
  search?: string
}

/**
 * Dinamikus hreflang linkek a <head>-ben (hu, de, en, x-default).
 * A metadata.alternates.languages mellett is biztonsági hálóként szolgál.
 */
export function HreflangLinks({ internalPath, search = '' }: Props) {
  const languages = buildAlternatesLanguages(internalPath, search, BASE_URL)
  return (
    <>
      {Object.entries(languages).map(([hreflang, href]) => (
        <link key={hreflang} rel="alternate" hrefLang={hreflang} href={href} />
      ))}
    </>
  )
}
