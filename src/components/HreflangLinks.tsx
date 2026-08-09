import { headers } from 'next/headers'
import { getHreflangAlternates } from '@/lib/hreflang'

const BASE_URL = (process.env.NEXT_PUBLIC_APP_URL || 'https://gulumen.hu').replace(/\/$/, '')

export async function HreflangLinks() {
  const headersList = await headers()
  const pathname = headersList.get('x-pathname') ?? '/'
  const search = headersList.get('x-search') ?? ''
  const alternates = getHreflangAlternates(pathname, search)
  const pathOnly = `${BASE_URL}${pathname.startsWith('/') ? pathname : `/${pathname}`}`

  return (
    <>
      <link rel="canonical" href={pathOnly} />
      {alternates.map((alt) => (
        <link key={alt.hreflang} rel="alternate" hrefLang={alt.hreflang} href={alt.href} />
      ))}
    </>
  )
}
