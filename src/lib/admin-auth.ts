import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import {
  parseAdminSessionToken,
  parseAdminPendingTwoFactorToken,
  ADMIN_COOKIE_NAME,
  ADMIN_2FA_PENDING_COOKIE,
} from '@/lib/admin-session'
import { OPERATOR_COOKIE_NAME } from '@/lib/admin-session-constants'
import {
  type AdminActor,
  type AdminPermission,
  BOOTSTRAP_ADMIN_ACTOR,
  roleHasPermission,
} from '@/lib/admin-rbac'
import { getAdminOperatorById } from '@/lib/admin-operators'

export type AdminAuthLevel = 'admin' | 'pending'

export type AdminPermissionGate =
  | { ok: true; actor: AdminActor }
  | { ok: false; response: NextResponse }

/**
 * JWT → actor, DB-szabályokkal + unbreakable owner fallback:
 * - Ha van érvényes `operator_authorized` (másodlagos fiók), az az aktív session
 *   (owner süti érintetlenül megmarad a böngészőben).
 * - Egyébként `admin_authorized`: bootstrap / owner session soha nem kerül elutasításra
 *   (API-kulcs + 2FA lockout-mentés SQL nélkül).
 */
export async function getAdminActor(): Promise<AdminActor | null> {
  const cookieStore = await cookies()

  const operatorParsed = await parseAdminSessionToken(
    cookieStore.get(OPERATOR_COOKIE_NAME)?.value
  )
  if (operatorParsed && !operatorParsed.bootstrap && operatorParsed.id !== 'admin') {
    const live = await getAdminOperatorById(operatorParsed.id)
    if (live) return live
  }

  const ownerParsed = await parseAdminSessionToken(cookieStore.get(ADMIN_COOKIE_NAME)?.value)
  if (ownerParsed) {
    if (ownerParsed.bootstrap || ownerParsed.id === 'admin') return BOOTSTRAP_ADMIN_ACTOR
    if (ownerParsed.role === 'owner') {
      const live = await getAdminOperatorById(ownerParsed.id)
      return live ?? ownerParsed
    }
    return getAdminOperatorById(ownerParsed.id)
  }

  return null
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

/** Csak owner (vagy bootstrap owner) – pl. approval döntés. */
export async function requireOwner(): Promise<AdminPermissionGate> {
  const actor = await getAdminActor()
  if (!actor) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    }
  }
  if (actor.role !== 'owner') {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Forbidden', permission: 'owner' }, { status: 403 }),
    }
  }
  return { ok: true, actor }
}

export function getAdminApiKey(): string | undefined {
  return process.env.ADMIN_API_KEY
}

export function isOwnerActor(actor: AdminActor): boolean {
  return actor.role === 'owner' || Boolean(actor.bootstrap)
}

/**
 * Gyári főadmin (ADMIN_API_KEY + 2FA bootstrap): minden DB-szabály felett áll.
 * Másodlagos / DB owner soha nem master — last-owner korlát rájuk érvényes marad.
 */
export function isMasterAdminActor(actor: AdminActor): boolean {
  return Boolean(actor.bootstrap) || actor.id === 'admin'
}
