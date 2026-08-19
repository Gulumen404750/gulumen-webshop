import { NextResponse } from 'next/server'
import { requireAdminPermission } from '@/lib/admin-auth'
import { getTopChatQuestions, TOP_CHAT_QUESTIONS_MAX } from '@/lib/chat-log'
import { isDbConfigured } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/** GET /api/admin/chat/questions – leggyakoribb chat kérdések (admin, max. 100). */
export async function GET() {
  const gate = await requireAdminPermission('settings:write')
  if (!gate.ok) return gate.response

  if (!isDbConfigured()) {
    return NextResponse.json({ questions: [], message: 'Database not configured' })
  }

  try {
    const questions = await getTopChatQuestions(TOP_CHAT_QUESTIONS_MAX)
    return NextResponse.json({
      total: questions.length,
      maxTotal: TOP_CHAT_QUESTIONS_MAX,
      pageSize: 10,
        questions: questions.map((q) => ({
        question: q.question,
        count: q.count,
        lastAskedAt: q.lastAskedAt.toISOString(),
        missingProductSearchCount: q.missingProductSearchCount,
      })),
    })
  } catch (e) {
    console.error('[api/admin/chat/questions] GET', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
