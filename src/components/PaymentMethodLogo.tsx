import type { ReactNode } from 'react'
import type { CheckoutPaymentMethod } from '@/lib/checkout-payment-methods'

/**
 * Fizetési mód márkajelei a checkout választóban.
 * Inline SVG, hogy élesek maradjanak bármely méretben (nem raszter).
 * A feliratok a pickerben külön szerepelnek, ezért a logók dekoratívak.
 */
function LogoChip({
  className,
  children,
}: {
  className?: string
  children: ReactNode
}) {
  return (
    <span
      className={`flex h-9 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border shadow-sm ${className ?? 'border-black/10 bg-white'}`}
      aria-hidden
    >
      {children}
    </span>
  )
}

/** Visa szójel + Mastercard körök — a kártyás fizetés ismert márkái. */
function CardBrandMark() {
  return (
    <LogoChip className="border-black/10 bg-white px-0.5">
      <svg viewBox="0 0 54 24" className="h-[18px] w-[42px]" role="img">
        <title>Visa, Mastercard</title>
        <path
          fill="#1A1F71"
          d="M9.112 8.262L5.97 15.758H3.92L2.374 9.775c-.094-.368-.175-.503-.461-.658C1.447 8.864.677 8.627 0 8.479l.046-.217h3.3a.904.904 0 01.894.764l.817 4.338 2.018-5.102zm8.033 5.049c.008-1.979-2.736-2.088-2.717-2.972.006-.269.262-.555.822-.628a3.66 3.66 0 011.913.336l.34-1.59a5.207 5.207 0 00-1.814-.333c-1.917 0-3.266 1.02-3.278 2.479-.012 1.079.963 1.68 1.698 2.04.756.367 1.01.603 1.006.931-.005.504-.602.725-1.16.734-.975.015-1.54-.263-1.992-.473l-.351 1.642c.453.208 1.289.39 2.156.398 2.037 0 3.37-1.006 3.377-2.564m5.061 2.447H24l-1.565-7.496h-1.656a.883.883 0 00-.826.55l-2.909 6.946h2.036l.405-1.12h2.488zm-2.163-2.656l1.02-2.815.588 2.815zm-8.16-4.84l-1.603 7.496H8.34l1.605-7.496z"
        />
        <circle cx="38.2" cy="12" r="7.4" fill="#EB001B" />
        <circle cx="46.2" cy="12" r="7.4" fill="#F79E1B" />
        <path
          fill="#FF5F00"
          d="M42.2 5.77a7.4 7.4 0 0 1 0 12.46 7.4 7.4 0 0 1 0-12.46z"
        />
      </svg>
    </LogoChip>
  )
}

/** Hivatalos kétszínű PayPal P-jel. */
function PayPalMark() {
  return (
    <LogoChip>
      <svg viewBox="0 0 24 24" className="h-6 w-6" role="img">
        <title>PayPal</title>
        <path
          fill="#003087"
          d="M7.016 19.198h-4.2a.562.562 0 0 1-.555-.65L5.093.584A.692.692 0 0 1 5.776 0h7.222c3.417 0 5.904 2.488 5.846 5.5-.006.25-.027.5-.066.747A6.794 6.794 0 0 1 12.071 12H8.743a.69.69 0 0 0-.682.583l-.325 2.056-.013.083-.692 4.39-.015.087z"
        />
        <path
          fill="#009CDE"
          d="M19.79 6.142c-.01.087-.01.175-.023.261a7.76 7.76 0 0 1-7.695 6.598H9.007l-.283 1.795-.013.083-.692 4.39-.134.843-.014.088H6.86l-.497 3.15a.562.562 0 0 0 .555.65h3.612c.34 0 .63-.249.683-.585l.952-6.031a.692.692 0 0 1 .683-.584h2.126a6.793 6.793 0 0 0 6.707-5.752c.306-1.95-.466-3.744-1.89-4.906z"
        />
      </svg>
    </LogoChip>
  )
}

/** Apple Pay: fekete gomb, fehér alma + Pay. */
function ApplePayMark() {
  return (
    <LogoChip className="border-neutral-800 bg-black">
      <svg viewBox="0 0 48 20" className="h-4 w-[38px]" role="img">
        <title>Apple Pay</title>
        <g transform="translate(-0.8,-0.6) scale(0.84)">
          <path
            fill="#fff"
            d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"
          />
        </g>
        <text
          x="18.8"
          y="15.1"
          fill="#fff"
          fontSize="11.2"
          fontWeight={500}
          fontFamily="Helvetica Neue, Helvetica, Arial, sans-serif"
        >
          Pay
        </text>
      </svg>
    </LogoChip>
  )
}

/** Színes Google G + Pay. */
function GooglePayMark() {
  return (
    <LogoChip className="border-black/10 bg-white px-0.5">
      <svg viewBox="0 0 48 20" className="h-4 w-[38px]" role="img">
        <title>Google Pay</title>
        <g transform="translate(1.2,2.2) scale(0.66)">
          <path
            fill="#4285F4"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="#34A853"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="#FBBC05"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
          />
          <path
            fill="#EA4335"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
          />
        </g>
        <text
          x="20.2"
          y="14.6"
          fill="#5F6368"
          fontSize="10.4"
          fontWeight={500}
          fontFamily="Roboto, Helvetica Neue, Helvetica, Arial, sans-serif"
        >
          Pay
        </text>
      </svg>
    </LogoChip>
  )
}

/** Klarna K-jel a márka rózsaszínjén. */
function KlarnaMark() {
  return (
    <LogoChip className="border-[#e89aaf] bg-[#FFB3C7]">
      <svg viewBox="0 0 24 24" className="h-[22px] w-[22px]" role="img">
        <title>Klarna</title>
        <path
          fill="#0A0B09"
          d="M4.592 2v20H0V2h4.592zm11.46 0c0 4.194-1.583 8.105-4.415 11.068l-.278.283L17.702 22h-5.668l-6.893-9.4 1.779-1.332c2.858-2.14 4.535-5.378 4.637-8.924L11.562 2h4.49zM21.5 17a2.5 2.5 0 110 5 2.5 2.5 0 010-5z"
        />
      </svg>
    </LogoChip>
  )
}

const MARKS: Record<CheckoutPaymentMethod, () => ReactNode> = {
  card: CardBrandMark,
  paypal: PayPalMark,
  apple_pay: ApplePayMark,
  google_pay: GooglePayMark,
  klarna: KlarnaMark,
}

export function PaymentMethodLogo({ method }: { method: CheckoutPaymentMethod }) {
  const Mark = MARKS[method]
  return <Mark />
}
