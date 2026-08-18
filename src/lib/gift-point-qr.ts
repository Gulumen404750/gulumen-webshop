import QRCode from 'qrcode'

const QR_OPTIONS = {
  errorCorrectionLevel: 'M' as const,
  margin: 1,
  width: 320,
  color: { dark: '#111111', light: '#ffffff' },
}

/** NFC-re írható aktiválási URL QR-kódja (PNG data URL). */
export async function generateGiftPointQrDataUrl(claimUrl: string): Promise<string> {
  return QRCode.toDataURL(claimUrl, {
    ...QR_OPTIONS,
    type: 'image/png',
  })
}
