import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isDbConfigured } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin-auth'

/**
 * PATCH /api/admin/callback-request/:id
 * body: { status: "done" | "cancelled", note?: string }
 * note max 200 char. Admin cookie required.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }

  const { id } = await params
  if (!id) {
    return NextResponse.json({ error: 'id required' }, { status: 400 })
  }

  let body: { status?: string; note?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const status = body?.status === 'done' || body?.status === 'cancelled' ? body.status : undefined
  if (!status) {
    return NextResponse.json(
      { error: 'status required: "done" or "cancelled"' },
      { status: 400 }
    )
  }

  const note =
    typeof body?.note === 'string'
      ? body.note.trim().slice(0, 200)
      : undefined

  try {
    await prisma.callbackRequest.update({
      where: { id },
      data: { status, ...(note !== undefined && { note }) },
    })
    return NextResponse.json({ ok: true, status, note: note ?? null })
  } catch (e) {
    console.error('[admin/callback-request] update failed:', e)
    return NextResponse.json({ error: 'Not found or update failed' }, { status: 404 })
  }
}
