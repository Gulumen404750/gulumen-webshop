'use client'

import { useEffect, useState } from 'react'

type Props = {
  value: string
  alt: string
  src?: string | null
}

/**
 * QR-kód a szállítási címkéhez. Előre generált PNG data URL-t használ,
 * különben kliensen tölti be a qrcode könyvtárat (tömeges nyomtatás).
 */
export function ShippingLabelQrCode({ value, alt, src }: Props) {
  const [imageSrc, setImageSrc] = useState<string | null>(src ?? null)

  useEffect(() => {
    if (src) {
      setImageSrc(src)
      return
    }
    let cancelled = false
    void import('@/lib/shipping-label-qr')
      .then(({ generateShippingLabelQrDataUrl }) => generateShippingLabelQrDataUrl(value))
      .then((url) => {
        if (!cancelled) setImageSrc(url)
      })
      .catch(() => {
        if (!cancelled) setImageSrc(null)
      })
    return () => {
      cancelled = true
    }
  }, [src, value])

  if (!imageSrc) {
    return (
      <div
        className="h-24 w-24 shrink-0 border border-black/30 bg-white print:h-[22mm] print:w-[22mm]"
        aria-hidden
      />
    )
  }

  return (
    // print-stable data URL – Next Image is not used on shipping labels
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={imageSrc}
      alt={alt}
      width={96}
      height={96}
      className="h-24 w-24 shrink-0 border border-black bg-white object-contain print:h-[22mm] print:w-[22mm]"
      style={{ printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }}
    />
  )
}
