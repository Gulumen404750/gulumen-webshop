/**
 * Owner/bootstrap session parkolása: ha ugyanabban a böngészőben
 * másik operátorként lépsz be (teszt), az előző owner JWT megmarad
 * és egy gombbal visszaállítható — nem vész el a fő admin session.
 */
import { NextResponse } from 'next/server'
import type { AdminActor } from '@/lib/admin-rbac'
import {
  ADMIN_COOKIE_NAME,
  getAdminCookieOptions,
  parseAdminSessionToken,
} from '@/lib/admin-session'
import { ADMIN_SESSION_MAX_AGE_SEC } from '@/lib/admin-session-constants'

export const ADMIN_PARKED_COOKIE_NAME = 'admin_session_parked'

export function getAdminParkedCookieOptions(maxAge = ADMIN_SESSION_MAX_AGE_SEC) {
  return getAdminCookieOptions(maxAge)
}

/** Owner / bootstrap session érdemes parkolni teszt-belépés előtt. */
export function shouldParkAdminSession(
  existing: AdminActor | null,
  next: AdminActor
): boolean {
  if (!existing) return false
  if (existing.id === next.id) return false
  return existing.role === 'owner' || Boolean(existing.bootstrap)
}

/**
 * Ha van érvényes owner/bootstrap süti és más actorra váltunk,
 * tedd a régi tokent a parked cookie-ba (felülírás előtt).
 */
export async function parkExistingOwnerSessionIfNeeded(
  res: NextResponse,
  existingToken: string | undefined | null,
  nextActor: AdminActor
): Promise<boolean> {
  if (!existingToken) return false
  const existing = await parseAdminSessionToken(existingToken)
  if (!shouldParkAdminSession(existing, nextActor)) return false
  res.cookies.set(
    ADMIN_PARKED_COOKIE_NAME,
    existingToken,
    getAdminParkedCookieOptions()
  )
  return true
}

export function clearParkedAdminSessionCookie(res: NextResponse): void {
  res.cookies.set(ADMIN_PARKED_COOKIE_NAME, '', {
    ...getAdminParkedCookieOptions(0),
    maxAge: 0,
  })
}
