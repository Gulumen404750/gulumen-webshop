import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isDbConfigured } from '@/lib/prisma'
import { validateCronSecret } from '@/lib/cron-auth'

/**
 * GET /api/cron/data-retention
 * Napi 1× (pl. Vercel Cron). CRON_SECRET: Authorization: Bearer <CRON_SECRET>.
 * Törlés: CallbackRequest 180 nap, Call 180 nap (teljes sor), transcript 60 nap (nullázás).
 * Napló: DataRetentionLog.
 */
const CALLBACK_RETENTION_DAYS = 180
const CALL_SUMMARY_RETENTION_DAYS = 180
const TRANSCRIPT_RETENTION_DAYS = 60

export async function GET(request: Request) {
  if (!validateCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!isDbConfigured()) {
    return NextResponse.json(
      { error: 'Database not configured' },
      { status: 503 }
    )
  }

  const now = new Date()
  const callbackCutoff = new Date(now)
  callbackCutoff.setDate(callbackCutoff.getDate() - CALLBACK_RETENTION_DAYS)
  const callCutoff = new Date(now)
  callCutoff.setDate(callCutoff.getDate() - CALL_SUMMARY_RETENTION_DAYS)
  const transcriptCutoff = new Date(now)
  transcriptCutoff.setDate(transcriptCutoff.getDate() - TRANSCRIPT_RETENTION_DAYS)

  let deletedCallbacks = 0
  let deletedCallSummaries = 0
  let deletedTranscripts = 0
  let success = true
  let details: string | null = null

  try {
    // 1) CallbackRequest: törlés 180 nap után
    const deletedCB = await prisma.callbackRequest.deleteMany({
      where: { createdAt: { lt: callbackCutoff } },
    })
    deletedCallbacks = deletedCB.count

    // 2) Call transcript nullázás 60 nap után (összes régebbi Call transcriptjét töröljük)
    const callsWithTranscript = await prisma.call.findMany({
      where: {
        timestamp: { lt: transcriptCutoff },
        transcript: { not: null },
      },
      select: { id: true },
    })
    if (callsWithTranscript.length > 0) {
      await prisma.call.updateMany({
        where: {
          timestamp: { lt: transcriptCutoff },
          transcript: { not: null },
        },
        data: { transcript: null },
      })
      deletedTranscripts = callsWithTranscript.length
    }

    // 3) Call sor törlés 180 nap után
    const deletedCalls = await prisma.call.deleteMany({
      where: { timestamp: { lt: callCutoff } },
    })
    deletedCallSummaries = deletedCalls.count
  } catch (e) {
    success = false
    details = e instanceof Error ? e.message : String(e)
    console.error('[cron/data-retention] Error:', e)
  }

  try {
    await prisma.dataRetentionLog.create({
      data: {
        deletedCallbacks,
        deletedCallSummaries,
        deletedTranscripts,
        success,
        details,
      },
    })
  } catch (e) {
    console.error('[cron/data-retention] Log create failed:', e)
  }

  return NextResponse.json({
    ok: success,
    deletedCallbacks,
    deletedCallSummaries,
    deletedTranscripts,
  })
}
