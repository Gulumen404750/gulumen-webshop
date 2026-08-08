import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/admin-auth'
import { prisma, isDbConfigured } from '@/lib/prisma'
import { sendAdminBulkEmail } from '@/lib/admin-bulk-email'

const MAX_RECIPIENTS = 100

const schema = z.object({
  userIds: z.array(z.string().min(1)).min(1).max(MAX_RECIPIENTS),
  subject: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(8000),
})

/**
 * POST /api/admin/users/email
 * Tömeges e-mail a kijelölt felhasználóknak.
 */
export async function POST(request: Request) {
  const ok = await requireAdmin()
  if (!ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const uniqueIds = [...new Set(parsed.data.userIds)]
  const users = await prisma.user.findMany({
    where: { id: { in: uniqueIds } },
    select: { id: true, email: true, name: true },
  })

  if (users.length === 0) {
    return NextResponse.json({ error: 'Nincs érvényes címzett' }, { status: 400 })
  }

  const result = await sendAdminBulkEmail({
    recipients: users.map((u) => ({ email: u.email, name: u.name })),
    subject: parsed.data.subject,
    body: parsed.data.body,
  })

  return NextResponse.json({
    ok: result.failed === 0,
    requested: uniqueIds.length,
    found: users.length,
    sent: result.sent,
    failed: result.failed,
    errors: result.errors,
  })
}
