import { cookies } from 'next/headers'
import {
  verifyAdminSessionToken,
  verifyAdminPendingTwoFactorToken,
  ADMIN_COOKIE_NAME,
  ADMIN_2FA_PENDING_COOKIE,
} from '@/lib/admin-session'

export type AdminAuthLevel = 'admin' | 'pending'

/** Admin aláírt session cookie ellenőrzése. API route-okban használd. */
export async function requireAdmin(): Promise<boolean> {
  const cookieStore = await cookies()
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value
  return verifyAdminSessionToken(token)
}

/**
 * Teljes admin session, vagy a login utáni ideiglenes 2FA pending token
 * (első TOTP párosítás / belépési kód). A pending token NEM admin jogosultság.
 */
export async function requireAdminOrPendingTwoFactor(): Promise<AdminAuthLevel | null> {
  const cookieStore = await cookies()
  if (await verifyAdminSessionToken(cookieStore.get(ADMIN_COOKIE_NAME)?.value)) {
    return 'admin'
  }
  if (await verifyAdminPendingTwoFactorToken(cookieStore.get(ADMIN_2FA_PENDING_COOKIE)?.value)) {
    return 'pending'
  }
  return null
}

export function getAdminApiKey(): string | undefined {
  return process.env.ADMIN_API_KEY
}
