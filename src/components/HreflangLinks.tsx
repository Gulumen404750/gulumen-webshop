import { headers } from 'next/headers'
import { getHreflangAlternates } from '@/lib/hreflang'

export async function HreflangLinks() {
  const headersList = await headers()
  const pathname = headersList.get('x-pathname') ?? '/'
  const search = headersList.get('x-search') ?? ''
  const alternates = getHreflangAlternates(pathname, search)

  return (
    <>
      {alternates.map((alt) => (
        <link key={alt.hreflang} rel="alternate" hrefLang={alt.hreflang} href={alt.href} />
      ))}
    </>
  )
}
