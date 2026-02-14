import type { Metadata } from 'next'
import { Poppins, Inter } from 'next/font/google'
import './globals.css'
import { Header } from '@/components/Header'
import { AIAssistant } from '@/components/AIAssistant'
import { DealPopup } from '@/components/DealPopup'
import { LocaleProvider } from '@/context/LocaleContext'
import { SourcingDealOrdersProvider } from '@/context/SourcingDealOrdersContext'
import { AuthProvider } from '@/context/AuthContext'
import { CatCouponProvider } from '@/context/CatCouponContext'
import { CartProvider } from '@/context/CartContext'
import { WishlistProvider } from '@/context/WishlistContext'
import { ToastProvider } from '@/context/ToastContext'
import { EuroRateProvider } from '@/context/EuroRateContext'
import { OrganizationJsonLd } from '@/components/OrganizationJsonLd'
import { Analytics } from '@/components/Analytics'
import { WalletErrorGuard } from '@/components/WalletErrorGuard'

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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="hu" className={`${poppins.variable} ${inter.variable}`} suppressHydrationWarning>
      <body className="min-h-screen flex flex-col font-body">
        <WalletErrorGuard />
        <Analytics />
        <OrganizationJsonLd />
        <LocaleProvider>
          <EuroRateProvider>
          <SourcingDealOrdersProvider>
            <AuthProvider>
              <CatCouponProvider>
                <CartProvider>
                  <WishlistProvider>
                  <ToastProvider>
                    <Header />
                    <main className="flex-1">{children}</main>
                    <DealPopup />
                    <AIAssistant />
                  </ToastProvider>
                  </WishlistProvider>
                </CartProvider>
              </CatCouponProvider>
            </AuthProvider>
          </SourcingDealOrdersProvider>
          </EuroRateProvider>
        </LocaleProvider>
      </body>
    </html>
  )
}
