import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import {
  parseAdminSessionToken,
  parseAdminPendingTwoFactorToken,
  ADMIN_COOKIE_NAME,
  ADMIN_2FA_PENDING_COOKIE,
} from '@/lib/admin-session'
import {
  type AdminActor,
  type AdminPermission,
  BOOTSTRAP_ADMIN_ACTOR,
  roleHasPermission,
} from '@/lib/admin-rbac'
import {
  countAdminOperators,
  getAdminOperatorById,
  isAdminEmergencyApiKeyLoginEnabled,
} from '@/lib/admin-operators'

export type AdminAuthLevel = 'admin' | 'pending'

export type AdminPermissionGate =
  | { ok: true; actor: AdminActor }
  | { ok: false; response: NextResponse }

/**
 * JWT → actor, DB-szabályokkal:
 * - 0 operátor (vagy tábla hiányzik): bootstrap `sub=admin` session OK.
 * - van operátor: bootstrap / legacy `admin` session elutasítva; aktív operátor kell.
 * - ADMIN_EMERGENCY_API_KEY_LOGIN=1: bootstrap session ismét engedélyezett (lockout mentés).
 */
export async function getAdminActor(): Promise<AdminActor | null> {
  const cookieStore = await cookies()
  const parsed = await parseAdminSessionToken(cookieStore.get(ADMIN_COOKIE_NAME)?.value)
  if (!parsed) return null
  const operatorCount = await countAdminOperators()
  if (operatorCount === 0) {
    if (parsed.bootstrap || parsed.id === 'admin') return BOOTSTRAP_ADMIN_ACTOR
    return parsed
  }
  if (parsed.bootstrap || parsed.id === 'admin') {
    if (isAdminEmergencyApiKeyLoginEnabled()) return BOOTSTRAP_ADMIN_ACTOR
    return null
  }
  return getAdminOperatorById(parsed.id)
}

export async function getPendingAdminActor(): Promise<AdminActor | null> {
  const cookieStore = await cookies()
  return parseAdminPendingTwoFactorToken(cookieStore.get(ADMIN_2FA_PENDING_COOKIE)?.value)
}

/** Admin aláírt session. Truthy actor; `if (!ok)` a régi boolean mintával is működik. */
export async function requireAdmin(): Promise<AdminActor | null> {
  return getAdminActor()
}

/**
 * Teljes admin session, vagy a login utáni ideiglenes 2FA pending token
 * (első TOTP párosítás / belépési kód). A pending token NEM admin jogosultság.
 */
export async function requireAdminOrPendingTwoFactor(): Promise<AdminAuthLevel | null> {
  if (await getAdminActor()) return 'admin'
  if (await getPendingAdminActor()) return 'pending'
  return null
}

export async function requireAdminPermission(
  permission: AdminPermission
): Promise<AdminPermissionGate> {
  const actor = await getAdminActor()
  if (!actor) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    }
  }
  if (!roleHasPermission(actor.role, permission)) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Forbidden', permission }, { status: 403 }),
    }
  }
  return { ok: true, actor }
}

export function getAdminApiKey(): string | undefined {
  return process.env.ADMIN_API_KEY
}
