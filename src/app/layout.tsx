import type { Metadata } from 'next'
// deploy: marketing consent admin (master → Railway)
import { Suspense } from 'react'
import { Poppins, Inter } from 'next/font/google'
import './globals.css'
import { Header } from '@/components/Header'
import { AIAssistant } from '@/components/AIAssistant'
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
import { Analytics } from '@/components/Analytics'
import { WalletErrorGuard } from '@/components/WalletErrorGuard'
import { CallUsStickyCTA } from '@/components/CallUsStickyCTA'
import { MobileCartStickyBanner } from '@/components/MobileCartStickyBanner'
import { Footer } from '@/components/Footer'
import { BrowseHeartbeatTracker } from '@/components/BrowseHeartbeatTracker'
import { HreflangLinks } from '@/components/HreflangLinks'
import { NewUserConsentGate } from '@/components/NewUserConsentGate'
import { getServerLocale } from '@/lib/locale-server'

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-poppins',
})

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
})

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://gulumen.hu'

export const metadata: Metadata = {
  title: 'Gulumen – Gondosan válogatott, limitált minőségi termékek',
  description: 'Gondosan válogatott, limitált darabszámú minőségi termékek – táskák, ruházat, kiegészítők, kedvező áron.',
  openGraph: {
    title: 'Gulumen – Gondosan válogatott, limitált minőségi termékek',
    description: 'Gondosan válogatott, limitált darabszámú minőségi termékek – táskák, ruházat, kiegészítők, kedvező áron.',
    url: BASE_URL,
    siteName: 'Gulumen',
    type: 'website',
    images: [{ url: `${BASE_URL}/img/logo.png`, width: 512, height: 512, alt: 'Gulumen' }],
    locale: 'hu_HU',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Gulumen – Gondosan válogatott, limitált minőségi termékek',
    description: 'Gondosan válogatott, limitált darabszámú minőségi termékek – táskák, ruházat, kiegészítők, kedvező áron.',
  },
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const htmlLang = await getServerLocale()

  return (
    <html lang={htmlLang} className={`${poppins.variable} ${inter.variable}`} suppressHydrationWarning>
      <head>
        <HreflangLinks />
        <link rel="modulepreload" href="https://ajax.googleapis.com/ajax/libs/model-viewer/4.1.0/model-viewer.min.js" />
      </head>
      <body className="min-h-screen flex flex-col font-body">
        <WalletErrorGuard />
        <Analytics />
        <OrganizationJsonLd />
        <LocaleProvider>
          <EuroRateProvider>
          <SourcingDealOrdersProvider>
            <AuthProvider>
              <CatCouponProvider>
                <ProductsProvider>
                <CartProvider>
                  <WishlistProvider>
                  <ToastProvider>
                    <NewUserConsentGate />
                    <Suspense fallback={<div className="h-16 border-b border-[var(--border)] bg-[var(--card-bg)]" aria-hidden />}>
                      <Header />
                    </Suspense>
                    <MobileCartStickyBanner />
                    <BrowseHeartbeatTracker />
                    <main className="flex-1 min-w-0 overflow-x-hidden">{children}</main>
                    <Footer />
                    <CallUsStickyCTA />
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
      </body>
    </html>
  )
}
