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
  /**
   * marketing (alapértelmezett): csak marketingOptIn=true címzettek.
   * transactional: max 50, nem marketing szűrés (pl. egyedi rendszerüzenet).
   */
  purpose: z.enum(['marketing', 'transactional']).optional().default('marketing'),
})

/**
 * POST /api/admin/users/email
 * Tömeges e-mail – marketing célból ALAPÉRTELMEZETTEN csak feliratkozottak.
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

  const { purpose } = parsed.data
  const uniqueIds = [...new Set(parsed.data.userIds)]

  if (purpose === 'transactional' && uniqueIds.length > 50) {
    return NextResponse.json(
      { error: 'Tranzakciós küldéshez legfeljebb 50 címzett engedélyezett.' },
      { status: 400 }
    )
  }

  const users = await prisma.user.findMany({
    where: { id: { in: uniqueIds } },
    select: { id: true, email: true, name: true, marketingOptIn: true },
  })

  const skipped: { email: string; reason: string }[] = []
  const recipients = []

  for (const u of users) {
    if (purpose === 'marketing' && !u.marketingOptIn) {
      skipped.push({
        email: u.email,
        reason: 'Nincs marketing hozzájárulás – kihagyva (GDPR védelem)',
      })
      continue
    }
    recipients.push({ email: u.email, name: u.name })
  }

  if (recipients.length === 0) {
    return NextResponse.json(
      {
        error:
          purpose === 'marketing'
            ? 'Nincs feliratkozott címzett a kijelöltek között. Marketing e-mailt csak hozzájárulással küldünk.'
            : 'Nincs érvényes címzett',
        skipped,
      },
      { status: 400 }
    )
  }

  const result = await sendAdminBulkEmail({
    recipients,
    subject: parsed.data.subject,
    body: parsed.data.body,
    purpose,
  })

  return NextResponse.json({
    ok: result.failed === 0,
    requested: uniqueIds.length,
    found: users.length,
    sent: result.sent,
    failed: result.failed,
    skipped,
    errors: result.errors,
  })
}
