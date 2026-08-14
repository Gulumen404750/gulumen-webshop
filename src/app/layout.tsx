import type { Metadata } from 'next'
// deploy: mobile product grid overflow fix (main → Railway) 2026-08-14
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
import { MobileCartStickyBanner } from '@/components/MobileCartStickyBanner'
import { Footer } from '@/components/Footer'
import { BrowseHeartbeatTracker } from '@/components/BrowseHeartbeatTracker'
import { HreflangLinks } from '@/components/HreflangLinks'
import { NewUserConsentGate } from '@/components/NewUserConsentGate'
import { DealPopup } from '@/components/DealPopup'
import { ThemeChooser } from '@/components/ThemeChooser'
import { AmbientAtmosphere } from '@/components/AmbientAtmosphere'
import { ThemeProvider } from '@/context/ThemeContext'
import { getServerLocale } from '@/lib/locale-server'
import { BASE_URL, BRAND_IMAGE, buildLocalizedMetadata } from '@/lib/site-metadata'
import { THEME_BOOTSTRAP_SCRIPT } from '@/lib/theme'
import { headers } from 'next/headers'
import { CSP_NONCE_HEADER } from '@/lib/admin-security-headers'

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-poppins',
})

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
})

export async function generateMetadata(): Promise<Metadata> {
  const localized = await buildLocalizedMetadata({ pathname: '/' })
  return {
    metadataBase: new URL(BASE_URL),
    applicationName: 'Gulumen',
    icons: {
      icon: [
        { url: '/favicon.ico', sizes: '32x32', type: 'image/x-icon' },
        { url: '/icon.png', sizes: '512x512', type: 'image/png' },
        { url: '/favicon-32.png', sizes: '32x32', type: 'image/png' },
      ],
      apple: [{ url: '/apple-icon.png', sizes: '180x180', type: 'image/png' }],
      shortcut: ['/favicon.ico'],
    },
    verification: {
      google: 'oOhIZ7B_uvSnR9VQyH3oqSVFyBqdUKj0TI3P2RYzoi0',
    },
    ...localized,
    openGraph: {
      ...localized.openGraph,
      images: [
        {
          url: BRAND_IMAGE,
          width: 1200,
          height: 1200,
          alt: 'Gulumen logo',
        },
      ],
    },
  }
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const htmlLang = await getServerLocale()
  const nonce = (await headers()).get(CSP_NONCE_HEADER) ?? undefined

  return (
    <html lang={htmlLang} className={`${poppins.variable} ${inter.variable}`} suppressHydrationWarning>
      <head>
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP_SCRIPT }} />
        <HreflangLinks />
        <link rel="modulepreload" href="https://ajax.googleapis.com/ajax/libs/model-viewer/4.1.0/model-viewer.min.js" />
      </head>
      <body className="relative isolate min-h-screen flex flex-col font-body">
        <WalletErrorGuard />
        <Analytics nonce={nonce} />
        <OrganizationJsonLd />
        <LocaleProvider>
          <ThemeProvider>
          <EuroRateProvider>
          <SourcingDealOrdersProvider>
            <AuthProvider>
              <CatCouponProvider>
                <ProductsProvider>
                <CartProvider>
                  <WishlistProvider>
                  <ToastProvider>
                    <NewUserConsentGate />
                    <ThemeChooser />
                    <AmbientAtmosphere />
                    <Suspense fallback={<div className="h-16 border-b border-[var(--border)] bg-[var(--card-bg)]" aria-hidden />}>
                      <Header />
                    </Suspense>
                    <MobileCartStickyBanner />
                    <BrowseHeartbeatTracker />
                    <main className="flex-1 min-w-0">{children}</main>
                    <Footer />
                    <AIAssistant />
                    {/* Admin: /admin/dashboard/deal-popup – csak ha enabled + van termék */}
                    <DealPopup />
                  </ToastProvider>
                  </WishlistProvider>
                </CartProvider>
                </ProductsProvider>
              </CatCouponProvider>
            </AuthProvider>
          </SourcingDealOrdersProvider>
          </EuroRateProvider>
          </ThemeProvider>
        </LocaleProvider>
      </body>
    </html>
  )
}
