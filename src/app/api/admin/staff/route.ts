import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { requireAdminPermission } from '@/lib/admin-auth'
import { isDbConfigured } from '@/lib/prisma'
import { logAdminAction } from '@/lib/admin-audit'
import {
  ADMIN_PASSWORD_MIN_LENGTH,
  ADMIN_ROLES,
  isAdminRole,
  parseAdminPassword,
  parseAdminUsername,
} from '@/lib/admin-rbac'
import {
  countActiveOwners,
  createAdminOperator,
  listAdminOperators,
  updateAdminOperator,
} from '@/lib/admin-operators'

/**
 * GET /api/admin/staff – owner: operátor lista.
 */
export async function GET() {
  const auth = await requireAdminPermission('staff:write')
  if (!auth.ok) return auth.response
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }
  const operators = await listAdminOperators()
  return NextResponse.json({ operators })
}

/**
 * POST /api/admin/staff – owner: új operátor.
 * Body: { username, password, role }
 */
export async function POST(request: Request) {
  const auth = await requireAdminPermission('staff:write')
  if (!auth.ok) return auth.response
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }

  const body = await request.json().catch(() => ({}))
  const username = parseAdminUsername(body?.username)
  const password = parseAdminPassword(body?.password)
  const role = isAdminRole(body?.role) ? body.role : null
  if (!username || !password || !role) {
    return NextResponse.json(
      {
        error: `username (3–32), jelszó (min. ${ADMIN_PASSWORD_MIN_LENGTH} karakter) és role (viewer|catalog|ops|owner) kell.`,
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
      actor: auth.actor,
      details: { username: actor.username, role: actor.role },
    })
    return NextResponse.json({ ok: true, operator: actor })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return NextResponse.json({ error: 'Ez a felhasználónév foglalt.' }, { status: 409 })
    }
    throw err
  }
}

/**
 * PATCH /api/admin/staff – owner: szerep / aktív / jelszó.
 * Body: { id, role?, active?, password? }
 */
export async function PATCH(request: Request) {
  const auth = await requireAdminPermission('staff:write')
  if (!auth.ok) return auth.response
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }

  const body = await request.json().catch(() => ({}))
  const id = typeof body?.id === 'string' ? body.id.trim() : ''
  if (!id) return NextResponse.json({ error: 'id kell.' }, { status: 400 })

  const role = body?.role === undefined ? undefined : isAdminRole(body.role) ? body.role : null
  if (body?.role !== undefined && !role) {
    return NextResponse.json({ error: `Érvénytelen role. (${ADMIN_ROLES.join(', ')})` }, { status: 400 })
  }
  const active = typeof body?.active === 'boolean' ? body.active : undefined
  const password = body?.password === undefined ? undefined : parseAdminPassword(body.password)
  if (body?.password !== undefined && !password) {
    return NextResponse.json(
      { error: `A jelszó legalább ${ADMIN_PASSWORD_MIN_LENGTH} karakter legyen.` },
      { status: 400 }
    )
  }

  const demotingOwner =
    (role && role !== 'owner') || active === false
  if (demotingOwner) {
    const otherOwners = await countActiveOwners(id)
    if (otherOwners < 1) {
      return NextResponse.json(
        { error: 'Az utolsó owner fiókot nem lehet visszavonni vagy tiltani.' },
        { status: 400 }
      )
    }
  }

  const updated = await updateAdminOperator(id, { role: role ?? undefined, active, password: password ?? undefined })
  await logAdminAction({
    action: 'staff_update',
    success: true,
    request,
    actor: auth.actor,
    details: { id, role, active },
  })
  return NextResponse.json({ ok: true, operator: updated })
}
