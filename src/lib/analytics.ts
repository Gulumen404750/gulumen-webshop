/**
 * Analytics és konverziós események.
 * Állítsd be NEXT_PUBLIC_GA_MEASUREMENT_ID (GA4) vagy használj Plausible scriptet.
 */

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void
    plausible?: (event: string, opts?: { props?: Record<string, string> }) => void
  }
}

const GA_ID = typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID : ''

export function pageView(url: string, title?: string) {
  if (typeof window === 'undefined') return
  if (window.gtag && GA_ID) {
    window.gtag('config', GA_ID, { page_path: url, page_title: title })
  }
  if (window.plausible) {
    window.plausible('pageview', { props: { path: url } })
  }
}

export function trackAddToCart(productId: string, value?: number, currency = 'HUF') {
  if (typeof window === 'undefined') return
  if (window.gtag && GA_ID) {
    window.gtag('event', 'add_to_cart', {
      currency,
      value,
      items: [{ item_id: productId }],
    })
  }
  if (window.plausible) {
    window.plausible('add_to_cart', { props: { product_id: productId } })
  }
}

export function trackBeginCheckout(value?: number, currency = 'HUF') {
  if (typeof window === 'undefined') return
  if (window.gtag && GA_ID) {
    window.gtag('event', 'begin_checkout', { currency, value })
  }
  if (window.plausible) {
    window.plausible('begin_checkout', { props: { value: String(value ?? '') } })
  }
}

export function trackPurchase(orderId: string, value?: number, currency = 'HUF') {
  if (typeof window === 'undefined') return
  if (window.gtag && GA_ID) {
    window.gtag('event', 'purchase', {
      transaction_id: orderId,
      currency,
      value,
    })
  }
  if (window.plausible) {
    window.plausible('purchase', { props: { order_id: orderId, value: String(value ?? '') } })
  }
}
