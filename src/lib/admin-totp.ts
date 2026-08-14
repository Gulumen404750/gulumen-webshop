/**
 * Google Authenticator TOTP (otplib) – secret, URI, QR, ellenőrzés.
 */

import { generate, generateSecret, generateURI, verify } from 'otplib'
import QRCode from 'qrcode'

export const TOTP_ISSUER = 'Gulumen'
export const TOTP_LABEL = 'admin'
/** ±1 TOTP periódus (30 mp) – óraeltérés / késleltetés. */
const EPOCH_TOLERANCE_SEC = 30

export function generateTotpSecret(): string {
  return generateSecret({ length: 20 })
}

export function buildTotpAuthUrl(secret: string): string {
  return generateURI({
    issuer: TOTP_ISSUER,
    label: TOTP_LABEL,
    secret,
  })
}

export async function totpQrDataUrl(otpauthUrl: string): Promise<string> {
  return QRCode.toDataURL(otpauthUrl, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 240,
  })
}

export function normalizeTotpCode(code: unknown): string | null {
  if (typeof code !== 'string') return null
  const digits = code.replace(/\s+/g, '').trim()
  if (!/^\d{6}$/.test(digits)) return null
  return digits
}

export async function verifyTotpCode(secret: string, token: string): Promise<boolean> {
  const result = await verify({
    secret,
    token,
    epochTolerance: EPOCH_TOLERANCE_SEC,
  })
  return result.valid === true
}

export async function generateTotpCode(secret: string): Promise<string> {
  return generate({ secret })
}
