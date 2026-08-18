import QRCode from 'qrcode'

const QR_OPTIONS = {
  errorCorrectionLevel: 'M' as const,
  margin: 1,
  width: 512,
  color: { dark: '#000000', light: '#ffffff' },
}

/**
 * Magas felbontású PNG data URL – window.print() alatt is élesen jelenik meg.
 * 512 px ~ 25 mm címkén > 500 DPI.
 */
export async function generateShippingLabelQrDataUrl(text: string): Promise<string> {
  return QRCode.toDataURL(text, {
    ...QR_OPTIONS,
    type: 'image/png',
  })
}
