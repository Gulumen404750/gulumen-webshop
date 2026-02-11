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
import { ToastProvider } from '@/context/ToastContext'

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-poppins',
})

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
})

export const metadata: Metadata = {
  title: 'Gulumen – Minőségi termékek, meglepően jó áron',
  description: 'Árverésekből, kedvezményesen – táskák, ruházat, elektronika, kiegészítők.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="hu" className={`${poppins.variable} ${inter.variable}`} suppressHydrationWarning>
      <body className="min-h-screen flex flex-col font-body">
        <LocaleProvider>
          <SourcingDealOrdersProvider>
            <AuthProvider>
              <CatCouponProvider>
                <CartProvider>
                  <ToastProvider>
                    <Header />
                    <main className="flex-1">{children}</main>
                    <DealPopup />
                    <AIAssistant />
                  </ToastProvider>
                </CartProvider>
              </CatCouponProvider>
            </AuthProvider>
          </SourcingDealOrdersProvider>
        </LocaleProvider>
      </body>
    </html>
  )
}
