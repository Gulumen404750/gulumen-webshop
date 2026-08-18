'use client'

import { useEffect, useState } from 'react'

type Props = {
  value: string
  alt: string
  size?: number
}

/** QR a claim / NFC URL-hez. Kliensen a qrcode csomagból. */
export function GiftPointQrCode({ value, alt, size = 144 }: Props) {
  const [src, setSrc] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void import('@/lib/gift-point-qr')
      .then(({ generateGiftPointQrDataUrl }) => generateGiftPointQrDataUrl(value))
      .then((url) => {
        if (!cancelled) setSrc(url)
      })
      .catch(() => {
        if (!cancelled) setSrc(null)
      })
    return () => {
      cancelled = true
    }
  }, [value])

  if (!src) {
    return (
      <div
        className="shrink-0 border border-[var(--border)] bg-white"
        style={{ width: size, height: size }}
        aria-hidden
      />
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      className="shrink-0 border border-[var(--border)] bg-white object-contain"
    />
  )
}
