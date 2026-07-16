import type { Metadata } from 'next'
import { Suspense } from 'react'
import { Poppins, Inter } from 'next/font/google'
import './globals.css'
import { Header } from '@/components/Header'
import { AIAssistant } from '@/components/AIAssistant'
import { DealPopup } from '@/components/DealPopup'
import { LocaleProvider } from '@/context/LocaleContext'
import { SourcingDealOrdersProvider } from '@/context/SourcingDealOrdersContext'
import { AuthProvider } from '@/context/AuthContext'
import { CatCouponProvider } from '@/context/CatCouponContext'
import { ProductsProvider } from '@/context/ProductsContext'
import { CartProvider } from '@/context/CartContext'
import { WishlistProvider } from '@/context/WishlistContext'
import { ToastProvider } from '@/context/ToastContext'
import { EuroRateProvider } from '@/context/EuroRateContext'
import { OrganizationJsonLd } from '@/components/OrganizationJsonLd'
import { HreflangLinks } from '@/components/HreflangLinks'
import { Analytics } from '@/components/Analytics'
import { WalletErrorGuard } from '@/components/WalletErrorGuard'
import { CallUsStickyCTA } from '@/components/CallUsStickyCTA'
import { Footer } from '@/components/Footer'
import { getRequestLocale } from '@/lib/locale-server'
import {
  BASE_URL,
  buildPageMetadata,
  getSiteDescription,
  getSiteTitle,
} from '@/i18n/seo'
import { headers } from 'next/headers'
import { PATHNAME_HEADER, toInternalPath } from '@/i18n/routing'

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-poppins',
})

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
})

/** Build-time static generation off so Railway/build works without DB and useSearchParams is allowed. */
export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale()
  return {
    metadataBase: new URL(BASE_URL),
    ...buildPageMetadata({
      locale,
      title: getSiteTitle(locale),
      description: getSiteDescription(locale),
      internalPath: '/',
    }),
  }
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const locale = await getRequestLocale()
  const h = await headers()
  const publicPath = h.get(PATHNAME_HEADER) || '/'
  const internalPath = toInternalPath(publicPath)

  return (
    <html lang={locale} className={`${poppins.variable} ${inter.variable}`} suppressHydrationWarning>
      <head>
        <link rel="modulepreload" href="https://ajax.googleapis.com/ajax/libs/model-viewer/4.1.0/model-viewer.min.js" />
        <HreflangLinks internalPath={internalPath === '/' ? '/' : internalPath} />
      </head>
      <body className="min-h-screen flex flex-col font-body">
        <WalletErrorGuard />
        <Analytics />
        <OrganizationJsonLd locale={locale} />
        <Suspense fallback={null}>
          <LocaleProvider initialLocale={locale}>
            <EuroRateProvider>
            <SourcingDealOrdersProvider>
              <AuthProvider>
                <CatCouponProvider>
                  <ProductsProvider>
                  <CartProvider>
                    <WishlistProvider>
                    <ToastProvider>
                      <Header />
                      <main className="flex-1">{children}</main>
                      <Footer />
                      <CallUsStickyCTA />
                      <DealPopup />
                      <AIAssistant />
                    </ToastProvider>
                    </WishlistProvider>
                  </CartProvider>
                  </ProductsProvider>
                </CatCouponProvider>
              </AuthProvider>
            </SourcingDealOrdersProvider>
            </EuroRateProvider>
          </LocaleProvider>
        </Suspense>
      </body>
    </html>
  )
}
