import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { isMasterAdminActor, requireAdminPermission } from '@/lib/admin-auth'
import { isDbConfigured } from '@/lib/prisma'
import { logAdminAction } from '@/lib/admin-audit'
import {
  ADMIN_ROLES,
  describeRoleAccess,
  isAdminRole,
  parseAdminPassword,
  parseAdminUsername,
  type AdminActor,
  type AdminRole,
} from '@/lib/admin-rbac'
import {
  countActiveOwners,
  createAdminOperator,
  deleteAdminOperator,
  listAdminOperators,
  updateAdminOperator,
} from '@/lib/admin-operators'

function parseRole(raw: unknown): AdminRole | null {
  return isAdminRole(raw) ? raw : null
}

async function deleteStaffOperator(
  request: Request,
  actor: AdminActor,
  rawId: unknown
): Promise<NextResponse> {
  const id = typeof rawId === 'string' ? rawId.trim() : ''
  if (!id) {
    return NextResponse.json({ error: 'id required' }, { status: 400 })
  }

  const allowLastOwnerOverride = isMasterAdminActor(actor)

  try {
    const result = await deleteAdminOperator(id, { allowLastOwnerOverride })
    if (result === 'not_found') {
      return NextResponse.json({ error: 'Az operátor nem található.' }, { status: 404 })
    }
    if (result === 'last_owner') {
      return NextResponse.json(
        {
          error:
            'Az utolsó aktív owner nem törölhető. Hozz létre másik owner fiókot, vagy lépj be a főadmin API-kulcs + 2FA útvonalon (/admin/login).',
          code: 'last_owner',
        },
        { status: 400 }
      )
    }
    await logAdminAction({
      action: 'staff_delete',
      success: true,
      request,
      actor,
      details: { id, masterOverride: allowLastOwnerOverride },
    })
    return NextResponse.json({ ok: true, deletedId: id })
  } catch (err) {
    await logAdminAction({
      action: 'staff_delete',
      success: false,
      request,
      actor,
      details: { id, error: err instanceof Error ? err.message : 'unknown' },
    })
    return NextResponse.json({ error: 'Operátor törlése sikertelen.' }, { status: 500 })
  }
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
  const masterSession = isMasterAdminActor(gate.actor)
  return NextResponse.json({
    operators,
    roles: ADMIN_ROLES,
    requireFirstOwner: ownerCount === 0,
    ownerCount,
    /** ADMIN_API_KEY + 2FA bootstrap: last-owner korlát felülírható. */
    masterSession,
    /** Szerepkör → tételes engedély / korlátozás katalógus a staff UI-hoz. */
    roleAccess: Object.fromEntries(
      ADMIN_ROLES.map((role) => [role, describeRoleAccess(role)])
    ),
  })
}

/**
 * POST /api/admin/staff
 * Body create: { username, password, role }
 * Body delete: { action: 'delete', id }  — CSRF-biztos (a querystringes DELETE helyett)
 * Első operátor kötelezően owner. A gyári főadmin (ADMIN_API_KEY) session
 * soha nem íródik át DB-owner JWT-re — master jog megmarad.
 */
export async function POST(request: Request) {
  const gate = await requireAdminPermission('staff:write')
  if (!gate.ok) return gate.response
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>

  // Törlés: POST { action: 'delete', id } — a böngészős DELETE + querystring
  // CSRF / rewrite alatt megbízhatatlan volt (confirm után sem történt törlés).
  if (body.action === 'delete') {
    return deleteStaffOperator(request, gate.actor, body.id)
  }

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

    // A gyári főadmin (ADMIN_API_KEY) session soha nem íródik át DB-ownerre —
    // master jog megmarad; az új fiók /operator/login-nel lép be.
    return NextResponse.json({
      ok: true,
      operator: actor,
      sessionUpgraded: false,
      masterSessionPreserved: isMasterAdminActor(gate.actor),
    })
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

  const allowLastOwnerOverride = isMasterAdminActor(gate.actor)

  try {
    const actor = await updateAdminOperator(id, patch, { allowLastOwnerOverride })
    if (!actor) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    await logAdminAction({
      action: 'staff_update',
      success: true,
      request,
      actor: gate.actor,
      details: {
        id,
        role: actor.role,
        active: patch.active,
        passwordChanged: Boolean(patch.password),
        masterOverride: allowLastOwnerOverride,
      },
    })
    return NextResponse.json({ ok: true, operator: actor })
  } catch (err) {
    if (err instanceof Error && err.name === 'LAST_OWNER') {
      return NextResponse.json(
        {
          error:
            'Az utolsó owner nem minősíthető le és nem tiltható le. A főadmin API-kulcs + 2FA session felülírhatja.',
          code: 'last_owner',
        },
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
 * DELETE /api/admin/staff?id=  vagy body: { id }
 * Preferáld a POST { action: 'delete', id } útvonalat a UI-ból.
 */
export async function DELETE(request: Request) {
  const gate = await requireAdminPermission('staff:write')
  if (!gate.ok) return gate.response
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }

  const { searchParams } = new URL(request.url)
  let id = searchParams.get('id')?.trim() || ''
  if (!id) {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    id = typeof body.id === 'string' ? body.id.trim() : ''
  }
  return deleteStaffOperator(request, gate.actor, id)
}
