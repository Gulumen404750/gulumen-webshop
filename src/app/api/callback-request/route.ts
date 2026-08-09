import { NextResponse } from 'next/server'
import { rateLimit } from '@/lib/rate-limit'
import { isDbConfigured } from '@/lib/prisma'
import { prisma } from '@/lib/prisma'
import { sendCallbackRequestNotification } from '@/lib/voice-email'
import { sendTelegramMessage, formatCallbackRequestTelegram } from '@/lib/telegram'

/**
 * Visszahívás kérés a "Hívj minket" modalból.
 * Mentés: adatbázis (CallbackRequest) + email + webhook. DB nélkül legalább email VAGY webhook kötelező.
 * Válasz: { ok, stored: "db"|"fallback", emailSent, webhookSent }.
 */

function hasEmailConfig(): boolean {
  return Boolean(
    process.env.ADMIN_EMAIL?.trim() && process.env.RESEND_API_KEY?.trim()
  )
}

function hasWebhookConfig(): boolean {
  return Boolean(process.env.CALLBACK_WEBHOOK_URL?.trim())
}

export async function POST(request: Request) {
  const limit = await rateLimit(request)
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Túl sok kérés. Próbáld újra később.' },
      { status: 429 }
    )
  }

  try {
    const body = await request.json()
    const name = typeof body?.name === 'string' ? body.name.trim() : ''
    const phone = typeof body?.phone === 'string' ? body.phone.trim() : ''
    const topic = typeof body?.topic === 'string' ? body.topic.trim() : ''
    const preferredTime =
      typeof body?.preferredTime === 'string' ? body.preferredTime.trim() : ''

    if (!name || name.length < 2) {
      return NextResponse.json(
        { error: 'Érvényes név szükséges (min. 2 karakter).' },
        { status: 400 }
      )
    }
    if (!phone || phone.length < 6) {
      return NextResponse.json(
        { error: 'Érvényes telefonszám szükséges.' },
        { status: 400 }
      )
    }

    const payload = {
      name,
      phone,
      topic: topic || undefined,
      preferredTime: preferredTime || undefined,
    }
    const createdAt = new Date()

    // A1: DB nincs → legalább egy fallback kötelező
    if (!isDbConfigured()) {
      if (!hasEmailConfig() && !hasWebhookConfig()) {
        return NextResponse.json(
          {
            error:
              'Callback rendszer nincs konfigurálva (DB/email/webhook).',
          },
          { status: 500 }
        )
      }
      const emailResult = await sendCallbackRequestNotification(payload)
      const emailSent = emailResult.ok
      if (!emailSent) {
        console.warn('[callback-request] emailSent=false (fallback path)', payload)
      }
      let webhookSent = false
      const webhookUrl = process.env.CALLBACK_WEBHOOK_URL?.trim()
      if (webhookUrl) {
        try {
          const res = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...payload, createdAt: createdAt.toISOString() }),
          })
          webhookSent = res.ok
          if (!res.ok) {
            console.warn('[callback-request] Webhook failed:', res.status, await res.text())
          }
        } catch (err) {
          console.warn('[callback-request] Webhook error:', err)
        }
      }
      await sendTelegramMessage(
        formatCallbackRequestTelegram({ ...payload, createdAt })
      )
      return NextResponse.json({
        ok: true,
        stored: 'fallback',
        emailSent,
        webhookSent,
      })
    }

    // DB van: create, majd email + webhook, majd update delivery mezők
    let callbackId: string | null = null
    try {
      const created = await prisma.callbackRequest.create({
        data: {
          name: payload.name,
          phone: payload.phone,
          topic: payload.topic ?? undefined,
          preferredTime: payload.preferredTime ?? undefined,
          status: 'pending',
        },
      })
      callbackId = created.id
    } catch (err) {
      console.error('[callback-request] DB create failed:', err)
      return NextResponse.json({ error: 'Szerver hiba.' }, { status: 500 })
    }

    const emailResult = await sendCallbackRequestNotification(payload)
    const emailSent = emailResult.ok
    if (!emailSent) {
      console.warn('[callback-request] emailSent=false', payload)
    }

    let webhookSent = false
    const webhookUrl = process.env.CALLBACK_WEBHOOK_URL?.trim()
    if (webhookUrl) {
      try {
        const res = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, createdAt: createdAt.toISOString() }),
        })
        webhookSent = res.ok
        if (!res.ok) {
          console.warn('[callback-request] Webhook failed:', res.status, await res.text())
        }
      } catch (err) {
        console.warn('[callback-request] Webhook error:', err)
      }
    }

    const deliveryStatus: 'ok' | 'partial' | 'failed' =
      emailSent && webhookSent
        ? 'ok'
        : emailSent || webhookSent
          ? 'partial'
          : 'failed'

    if (callbackId) {
      try {
        await prisma.callbackRequest.update({
          where: { id: callbackId },
          data: {
            emailSent,
            webhookSent,
            deliveryStatus,
          },
        })
      } catch (e) {
        console.warn('[callback-request] DB update delivery status failed:', e)
      }
    }

    await sendTelegramMessage(
      formatCallbackRequestTelegram({ ...payload, createdAt })
    )

    return NextResponse.json({
      ok: true,
      stored: 'db',
      emailSent,
      webhookSent,
    })
  } catch {
    return NextResponse.json({ error: 'Szerver hiba.' }, { status: 500 })
  }
}
