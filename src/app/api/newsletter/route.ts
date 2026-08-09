import { NextResponse } from 'next/server'
import { rateLimit } from '@/lib/rate-limit'

/**
 * Hírlevél feliratkozás. Resend integrációhoz állítsd be RESEND_API_KEY és
 * RESEND_NEWSLETTER_LIST_ID (vagy használj egy list_id-t).
 * Dupla opt-in: küldj egy megerősítő e-mailt (Resend template).
 */

const RESEND_API = 'https://api.resend.com/emails'

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
    const email = typeof body?.email === 'string' ? body.email.trim() : ''
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Érvényes e-mail cím szükséges.' }, { status: 400 })
    }

    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) {
      // Nincs Resend: csak logoljuk / mentjük későbbi integrációhoz
      console.info('[newsletter] signup:', email)
      return NextResponse.json({ ok: true, message: 'Feliratkozás rögzítve.' })
    }

    const res = await fetch(RESEND_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM || 'Gulumen <onboarding@resend.dev>',
        to: [email],
        subject: 'Gulumen – Erősítsd meg a hírlevél feliratkozásod',
        html: `<p>Köszönjük a feliratkozást! Kattints a linkre a megerősítéshez (dupla opt-in):</p><p><a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://gulumen.hu'}/api/newsletter/confirm?email=${encodeURIComponent(email)}">Megerősítem</a></p>`,
      }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      return NextResponse.json(
        { error: err?.message || 'A feliratkozás sikertelen.' },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true, message: 'Ellenőrizd az e-mail fiókod a megerősítéshez.' })
  } catch {
    return NextResponse.json({ error: 'Szerver hiba.' }, { status: 500 })
  }
}
