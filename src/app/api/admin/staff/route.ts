import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { requireAdminPermission } from '@/lib/admin-auth'
import { isDbConfigured } from '@/lib/prisma'
import { logAdminAction } from '@/lib/admin-audit'
import {
  ADMIN_ROLES,
  describeRoleAccess,
  isAdminRole,
  parseAdminPassword,
  parseAdminUsername,
  type AdminRole,
} from '@/lib/admin-rbac'
import {
  countActiveOwners,
  createAdminOperator,
  deleteAdminOperator,
  listAdminOperators,
  updateAdminOperator,
} from '@/lib/admin-operators'
import {
  ADMIN_COOKIE_NAME,
  createAdminSessionToken,
  getAdminCookieOptions,
} from '@/lib/admin-session'
import {
  ADMIN_CSRF_COOKIE,
  generateCsrfToken,
  getAdminCsrfCookieOptions,
} from '@/lib/admin-csrf'

function parseRole(raw: unknown): AdminRole | null {
  return isAdminRole(raw) ? raw : null
}

/**
 * GET /api/admin/staff
 * Operátor lista (jelszó hash nélkül).
 */
export async function GET() {
  const gate = await requireAdminPermission('staff:write')
  if (!gate.ok) return gate.response
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }
  const operators = await listAdminOperators()
  const ownerCount = await countActiveOwners()
  return NextResponse.json({
    operators,
    roles: ADMIN_ROLES,
    requireFirstOwner: ownerCount === 0,
    /** Szerepkör → tételes engedély / korlátozás katalógus a staff UI-hoz. */
    roleAccess: Object.fromEntries(
      ADMIN_ROLES.map((role) => [role, describeRoleAccess(role)])
    ),
  })
}

/**
 * POST /api/admin/staff
 * Body: { username, password, role }
 * Első operátor kötelezően owner. Bootstrap sessionből owner létrehozásakor
 * új JWT-t adunk (különben a következő kérés kizárna).
 */
export async function POST(request: Request) {
  const gate = await requireAdminPermission('staff:write')
  if (!gate.ok) return gate.response
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const username = parseAdminUsername(body.username)
  const password = parseAdminPassword(body.password)
  const role = parseRole(body.role)
  if (!username || !password || !role) {
    return NextResponse.json(
      {
        error:
          'Érvénytelen adat. Felhasználónév: 3–32 (a–z 0–9 ._-), jelszó min. 10 karakter, szerep: owner|support|catalog|viewer.',
      },
      { status: 400 }
    )
  }

  try {
    const actor = await createAdminOperator({ username, password, role })
    await logAdminAction({
      action: 'staff_create',
      success: true,
      request,
      actor: gate.actor,
      details: { username: actor.username, role: actor.role, id: actor.id },
    })

    const res = NextResponse.json({
      ok: true,
      operator: actor,
      sessionUpgraded: Boolean(gate.actor.bootstrap && actor.role === 'owner'),
    })

    // Bootstrap → első owner: session átírása erre az ownerre (ne zárjon ki).
    if (gate.actor.bootstrap && actor.role === 'owner') {
      const token = await createAdminSessionToken(actor)
      res.cookies.set(ADMIN_COOKIE_NAME, token, getAdminCookieOptions())
      res.cookies.set(ADMIN_CSRF_COOKIE, generateCsrfToken(), getAdminCsrfCookieOptions())
    }
    return res
  } catch (err) {
    if (err instanceof Error && err.name === 'FIRST_MUST_BE_OWNER') {
      return NextResponse.json(
        {
          error:
            'Az első operátor legyen owner (a te fiókod). Support/catalog csak utána hozható létre — különben kizárod magad az API-kulcsos belépésből.',
        },
        { status: 400 }
      )
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return NextResponse.json({ error: 'Ez a felhasználónév már foglalt.' }, { status: 409 })
    }
    await logAdminAction({
      action: 'staff_create',
      success: false,
      request,
      actor: gate.actor,
      details: { username, role },
    })
    return NextResponse.json({ error: 'Operátor létrehozása sikertelen.' }, { status: 500 })
  }
}

/**
 * PATCH /api/admin/staff
 * Body: { id, role?, active?, password? }
 */
export async function PATCH(request: Request) {
  const gate = await requireAdminPermission('staff:write')
  if (!gate.ok) return gate.response
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const id = typeof body.id === 'string' ? body.id.trim() : ''
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const patch: { role?: AdminRole; active?: boolean; password?: string } = {}
  if (body.role !== undefined) {
    const role = parseRole(body.role)
    if (!role) return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
    patch.role = role
  }
  if (body.active !== undefined) {
    if (typeof body.active !== 'boolean') {
      return NextResponse.json({ error: 'active must be boolean' }, { status: 400 })
    }
    patch.active = body.active
  }
  if (body.password !== undefined) {
    const password = parseAdminPassword(body.password)
    if (!password) {
      return NextResponse.json({ error: 'A jelszó legalább 10 karakter legyen.' }, { status: 400 })
    }
    patch.password = password
  }

  try {
    const actor = await updateAdminOperator(id, patch)
    if (!actor) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    await logAdminAction({
      action: 'staff_update',
      success: true,
      request,
      actor: gate.actor,
      details: { id, role: actor.role, active: patch.active, passwordChanged: Boolean(patch.password) },
    })
    return NextResponse.json({ ok: true, operator: actor })
  } catch (err) {
    if (err instanceof Error && err.name === 'LAST_OWNER') {
      return NextResponse.json(
        { error: 'Az utolsó owner nem minősíthető le és nem tiltható le.' },
        { status: 400 }
      )
    }
    await logAdminAction({
      action: 'staff_update',
      success: false,
      request,
      actor: gate.actor,
      details: { id },
    })
    return NextResponse.json({ error: 'Operátor mentése sikertelen.' }, { status: 500 })
  }
}

/**
 * DELETE /api/admin/staff?id=
 */
export async function DELETE(request: Request) {
  const gate = await requireAdminPermission('staff:write')
  if (!gate.ok) return gate.response
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')?.trim() || ''
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const result = await deleteAdminOperator(id)
  if (result === 'not_found') return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (result === 'last_owner') {
    return NextResponse.json({ error: 'Az utolsó owner nem törölhető.' }, { status: 400 })
  }
  await logAdminAction({
    action: 'staff_delete',
    success: true,
    request,
    actor: gate.actor,
    details: { id },
  })
  return NextResponse.json({ ok: true })
}
