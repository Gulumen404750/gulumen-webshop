import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { getTopChatQuestions } from '@/lib/chat-log'
import { isDbConfigured } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/** GET /api/admin/chat/questions – leggyakoribb 20 chat kérdés (admin). */
export async function GET() {
  const ok = await requireAdmin()
  if (!ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!isDbConfigured()) {
    return NextResponse.json({ questions: [], message: 'Database not configured' })
  }

  try {
    const questions = await getTopChatQuestions(20)
    return NextResponse.json({
      questions: questions.map((q) => ({
        question: q.question,
        count: q.count,
        lastAskedAt: q.lastAskedAt.toISOString(),
      })),
    })
  } catch (e) {
    console.error('[api/admin/chat/questions] GET', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
