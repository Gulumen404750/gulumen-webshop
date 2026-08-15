import { NextResponse } from 'next/server'
import { rateLimit } from '@/lib/rate-limit'
import { isResendConfigured, sendMailRequired } from '@/lib/mail'
import {
  getSupportInboxEmail,
  warnIfSupportInboxUnreliable,
} from '@/lib/support-email'

const MAX_MESSAGE = 4000
const MAX_NAME = 120
const MAX_ORDER_REF = 80

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Kapcsolat űrlap → Resend → ügyfélszolgálati inbox (ADMIN_EMAIL / ORDER_SUPPORT_EMAIL).
 * Így a vásárlói üzenetek a postmaster@gulumen.com (ORDER_SUPPORT_EMAIL) inboxba érkeznek.
 */
export async function POST(request: Request) {
  const limit = await rateLimit(request, { maxPerWindow: 8, windowMs: 60_000 })
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Túl sok kérés. Próbáld újra később.' },
      { status: 429 }
    )
  }

  try {
    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Érvénytelen kérés.' }, { status: 400 })
    }

    const name = typeof body.name === 'string' ? body.name.trim() : ''
    const email = typeof body.email === 'string' ? body.email.trim() : ''
    const message = typeof body.message === 'string' ? body.message.trim() : ''
    const orderRef =
      typeof body.orderRef === 'string' ? body.orderRef.trim().slice(0, MAX_ORDER_REF) : ''

    if (!name || name.length > MAX_NAME) {
      return NextResponse.json({ error: 'Add meg a neved.' }, { status: 400 })
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Érvényes e-mail cím szükséges.' }, { status: 400 })
    }
    if (!message || message.length < 10) {
      return NextResponse.json(
        { error: 'Írj egy rövid üzenetet (legalább 10 karakter).' },
        { status: 400 }
      )
    }
    if (message.length > MAX_MESSAGE) {
      return NextResponse.json({ error: 'Az üzenet túl hosszú.' }, { status: 400 })
    }

    if (!isResendConfigured()) {
      return NextResponse.json(
        { error: 'Az üzenetküldés jelenleg nem elérhető. Próbáld később.' },
        { status: 503 }
      )
    }

    const to = getSupportInboxEmail()
    warnIfSupportInboxUnreliable(to, 'contact form')

    const subjectParts = ['[Gulumen] Kapcsolat']
    if (orderRef) subjectParts.push(`– ${orderRef}`)
    subjectParts.push(`– ${name}`)

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Kapcsolat</title></head>
<body style="font-family: sans-serif; max-width: 560px; margin: 0 auto; padding: 16px;">
  <h1>Új üzenet a kapcsolati űrlapról</h1>
  <p><strong>Név:</strong> ${escapeHtml(name)}</p>
  <p><strong>E-mail:</strong> <a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></p>
  ${orderRef ? `<p><strong>Rendelés:</strong> ${escapeHtml(orderRef)}</p>` : ''}
  <p><strong>Üzenet:</strong></p>
  <pre style="white-space: pre-wrap; background: #f8f8f8; padding: 12px; border-radius: 8px;">${escapeHtml(message)}</pre>
  <p style="font-size:12px;color:#666">Válaszolj közvetlenül a feladó (${escapeHtml(email)}) címére.</p>
</body>
</html>
`.trim()

    const text = [
      'Új üzenet a kapcsolati űrlapról',
      `Név: ${name}`,
      `E-mail: ${email}`,
      orderRef ? `Rendelés: ${orderRef}` : null,
      '',
      message,
    ]
      .filter((line) => line !== null)
      .join('\n')

    const result = await sendMailRequired({
      to,
      subject: subjectParts.join(' '),
      html,
      text,
      replyTo: email,
    })

    if (!result.ok) {
      console.error('[contact] send failed', result.error)
      return NextResponse.json(
        { error: 'Az üzenet küldése sikertelen. Próbáld újra később.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      ok: true,
      message: 'Üzeneted megérkezett. Hamarosan válaszolunk.',
    })
  } catch (err) {
    console.error('[contact] error', err)
    return NextResponse.json({ error: 'Szerver hiba.' }, { status: 500 })
  }
}
