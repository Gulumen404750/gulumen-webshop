import { createHash } from 'crypto'
import { prisma, isDbConfigured } from '@/lib/prisma'

export type TopChatQuestion = {
  question: string
  count: number
  lastAskedAt: Date
  missingProductSearchCount: number
}

/** Admin listában megjelenő maximális kérdésszám. */
export const TOP_CHAT_QUESTIONS_MAX = 100

/** Egy oldalon megjelenő kérdések száma (kliens). */
export const TOP_CHAT_QUESTIONS_PAGE_SIZE = 10

function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  const realIp = request.headers.get('x-real-ip')
  if (forwarded) return forwarded.split(',')[0].trim()
  if (realIp) return realIp
  return 'unknown'
}

/** Anonim IP azonosító – SHA-256, nyers IP nem kerül tárolásra. */
export function hashClientIp(request: Request): string {
  const salt =
    process.env.CHAT_LOG_IP_SALT?.trim() ||
    process.env.SESSION_SECRET?.trim() ||
    'gulumen-chat-log'
  const ip = getClientIp(request)
  return createHash('sha256').update(`${salt}:${ip}`).digest('hex')
}

export function normalizeChatQuestion(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[?!.…]+$/, '')
}

/** Chat kérdés naplózása – hiba esetén csendben elbukik, nem blokkolja a választ. */
export async function logChatQuestion(params: {
  question: string
  locale: string
  ipHash: string
  missingProductSearch?: boolean
}): Promise<void> {
  if (!isDbConfigured()) return

  const question = params.question.trim().slice(0, 2000)
  if (!question) return

  const questionNorm = normalizeChatQuestion(question)
  if (!questionNorm) return

  try {
    await prisma.chatLog.create({
      data: {
        question,
        questionNorm,
        ipHash: params.ipHash,
        locale: params.locale,
        missingProductSearch: !!params.missingProductSearch,
      },
    })
  } catch (e) {
    console.error('[chat-log] create failed', e)
  }
}

/** Leggyakoribb kérdések – questionNorm szerint csoportosítva. */
export async function getTopChatQuestions(limit = TOP_CHAT_QUESTIONS_MAX): Promise<TopChatQuestion[]> {
  if (!isDbConfigured()) return []

  try {
    const grouped = await prisma.chatLog.groupBy({
      by: ['questionNorm'],
      _count: { _all: true },
      _max: { createdAt: true },
    })

    const top = grouped
      .sort((a, b) => b._count._all - a._count._all)
      .slice(0, limit)

    if (top.length === 0) return []

    const topNorms = top.map((g) => g.questionNorm)

    const [samples, missingGrouped] = await Promise.all([
      prisma.chatLog.findMany({
        where: { questionNorm: { in: topNorms } },
        select: { questionNorm: true, question: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.chatLog.groupBy({
        by: ['questionNorm'],
        where: { questionNorm: { in: topNorms }, missingProductSearch: true },
        _count: { _all: true },
      }),
    ])

    const sampleByNorm = new Map<string, string>()
    for (const row of samples) {
      if (!sampleByNorm.has(row.questionNorm)) {
        sampleByNorm.set(row.questionNorm, row.question)
      }
    }

    const missingByNorm = new Map(
      missingGrouped.map((g) => [g.questionNorm, g._count._all])
    )

    return top.map((g) => ({
      question: sampleByNorm.get(g.questionNorm) ?? g.questionNorm,
      count: g._count._all,
      lastAskedAt: g._max.createdAt ?? new Date(0),
      missingProductSearchCount: missingByNorm.get(g.questionNorm) ?? 0,
    }))
  } catch (e) {
    console.error('[chat-log] getTopChatQuestions failed', e)
    return []
  }
}
