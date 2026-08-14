'use client'

import Script from 'next/script'
import { usePathname } from 'next/navigation'
import { useEffect } from 'react'
import { pageView } from '@/lib/analytics'

const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID

export function Analytics({ nonce }: { nonce?: string } = {}) {
  const pathname = usePathname()

  useEffect(() => {
    if (pathname) pageView(pathname)
  }, [pathname])

  if (!GA_ID) return null

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
        strategy="afterInteractive"
        nonce={nonce}
      />
      <Script id="ga-config" strategy="afterInteractive" nonce={nonce}>
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_ID}');
        `}
      </Script>
    </>
  )
}
