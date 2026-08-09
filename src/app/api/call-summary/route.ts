import { NextResponse } from 'next/server'
import { rateLimit } from '@/lib/rate-limit'
import { isDbConfigured } from '@/lib/prisma'
import { prisma } from '@/lib/prisma'
import { sendCallSummaryNotification } from '@/lib/voice-email'
import { sendTelegramMessage, formatCallSummaryTelegram, formatCallbackRequestTelegram } from '@/lib/telegram'

/**
 * POST /api/call-summary
 * Voice agent (Vapi/Retell) call-ended webhook.
 * Body: call_id, timestamp (ISO), language (hu|en), mode (b2c|b2b), caller_number, consent, transcript, summary, tags[], end_reason?, duration_sec?, last_prompt_key?.
 * Biztonság: VOICE_AGENT_WEBHOOK_SECRET (Authorization: Bearer <secret>).
 * consent=false → transcript nem kerül mentésre.
 * tags tartalmazza "callback_required" → létrehoz egy CallbackRequest follow-up taskot.
 */

function validateWebhookSecret(request: Request): boolean {
  const secret = process.env.VOICE_AGENT_WEBHOOK_SECRET?.trim()
  if (!secret) return false
  const auth = request.headers.get('authorization')
  if (auth?.startsWith('Bearer ')) return auth.slice(7) === secret
  const headerSecret = request.headers.get('x-webhook-secret')
  return headerSecret === secret
}

export async function POST(request: Request) {
  if (!validateWebhookSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const limit = await rateLimit(request)
  if (!limit.ok) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  try {
    const body = await request.json()
    const callId = typeof body?.call_id === 'string' ? body.call_id.trim() : ''
    const timestampRaw = body?.timestamp
    const language = typeof body?.language === 'string' && /^(hu|en)$/.test(body.language) ? body.language : 'hu'
    const mode = typeof body?.mode === 'string' && /^(b2c|b2b)$/.test(body.mode) ? body.mode : 'b2c'
    const callerNumber = typeof body?.caller_number === 'string' ? body.caller_number.trim() || undefined : undefined
    const consent = Boolean(body?.consent)
    const transcript = typeof body?.transcript === 'string' ? body.transcript.trim() : undefined
    const summary = typeof body?.summary === 'string' ? body.summary.trim() : undefined
    const tags = Array.isArray(body?.tags) ? body.tags.filter((t: unknown) => typeof t === 'string') : []
    const endReason = typeof body?.end_reason === 'string' ? body.end_reason.trim() || undefined : undefined
    const durationSec = typeof body?.duration_sec === 'number' && body.duration_sec >= 0 ? body.duration_sec : undefined
    const lastPromptKey = typeof body?.last_prompt_key === 'string' ? body.last_prompt_key.trim() || undefined : undefined

    if (!callId) {
      return NextResponse.json({ error: 'call_id required' }, { status: 400 })
    }

    const timestamp = timestampRaw ? new Date(timestampRaw) : new Date()
    if (Number.isNaN(timestamp.getTime())) {
      return NextResponse.json({ error: 'Invalid timestamp' }, { status: 400 })
    }

    const transcriptToStore = consent ? (transcript ?? null) : null

    if (isDbConfigured()) {
      try {
        await prisma.call.upsert({
          where: { callId },
          create: {
            callId,
            timestamp,
            language,
            mode,
            callerNumber: callerNumber ?? null,
            consent,
            summary: summary ?? null,
            transcript: transcriptToStore,
            tags,
            endReason: endReason ?? null,
            durationSec: durationSec ?? null,
            lastPromptKey: lastPromptKey ?? null,
          },
          update: {
            timestamp,
            language,
            mode,
            callerNumber: callerNumber ?? undefined,
            consent,
            summary: summary ?? undefined,
            transcript: transcriptToStore,
            tags,
            endReason: endReason ?? undefined,
            durationSec: durationSec ?? undefined,
            lastPromptKey: lastPromptKey ?? undefined,
          },
        })
      } catch (err) {
        console.error('[call-summary] DB upsert failed:', err)
        await prisma.voiceApiLog.create({
          data: {
            endpoint: 'call-summary',
            callId,
            consent,
            success: false,
            details: err instanceof Error ? err.message : String(err),
          },
        })
        return NextResponse.json({ error: 'Database error' }, { status: 500 })
      }

      await prisma.voiceApiLog.create({
        data: {
          endpoint: 'call-summary',
          callId,
          consent,
          success: true,
        },
      })

      if (tags.includes('callback_required')) {
        try {
          const createdAt = new Date()
          await prisma.callbackRequest.create({
            data: {
              name: '[Voice] Visszahívás',
              phone: callerNumber || '–',
              topic: summary || `Hívás: ${callId}`,
              preferredTime: undefined,
              status: 'pending',
            },
          })
          await sendTelegramMessage(
            formatCallbackRequestTelegram({
              name: '[Voice] Visszahívás',
              phone: callerNumber || '–',
              topic: summary || `Hívás: ${callId}`,
              preferredTime: undefined,
              createdAt,
            })
          )
        } catch (e) {
          console.warn('[call-summary] CallbackRequest create failed:', e)
        }
      }
    }

    await sendCallSummaryNotification({
      callId,
      timestamp: timestamp.toISOString(),
      language,
      mode,
      callerNumber,
      consent,
      summary,
      transcript: transcriptToStore ?? undefined,
      tags,
    })

    await sendTelegramMessage(
      formatCallSummaryTelegram({
        callId,
        timestamp: timestamp.toISOString(),
        language,
        mode,
        callerNumber,
        summary,
        tags,
      })
    )

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[call-summary] Error:', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
