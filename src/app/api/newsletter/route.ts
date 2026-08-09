import { NextResponse } from 'next/server'
import { rateLimit } from '@/lib/rate-limit'
import { setMarketingOptIn } from '@/lib/marketing-consent'
import { isDbConfigured } from '@/lib/prisma'

/**
 * Hírlevél feliratkozás – MarketingConsent (pending) + double opt-in e-mail.
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

    if (isDbConfigured()) {
      await setMarketingOptIn({
        email,
        optedIn: true,
        source: 'newsletter',
        confirmed: false,
      })
    } else {
      console.info('[newsletter] signup (no DB):', email)
    }

    const apiKey = process.env.RESEND_API_KEY
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://gulumen.hu'
    const confirmUrl = `${appUrl}/api/newsletter/confirm?email=${encodeURIComponent(email.toLowerCase())}`

    if (!apiKey) {
      if (isDbConfigured() && process.env.NODE_ENV !== 'production') {
        const { confirmMarketingOptIn } = await import('@/lib/marketing-consent')
        await confirmMarketingOptIn(email)
      }
      return NextResponse.json({
        ok: true,
        message: 'Feliratkozás rögzítve. Ellenőrizd az e-mail fiókod a megerősítéshez (ha e-mail küldés be van állítva).',
      })
    }

    const res = await fetch(RESEND_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM || process.env.EMAIL_FROM || 'Gulumen <onboarding@resend.dev>',
        to: [email],
        subject: 'Gulumen – Erősítsd meg a hírlevél feliratkozásod',
        html: `<p>Köszönjük a feliratkozást! Kattints a linkre a megerősítéshez (dupla opt-in):</p><p><a href="${confirmUrl}">Megerősítem</a></p><p style="color:#666;font-size:12px;">Ez a megerősítő e-mail nem marketing levél. Ha nem te kérted, hagyd figyelmen kívül.</p>`,
      }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      return NextResponse.json(
        { error: (err as { message?: string })?.message || 'A feliratkozás sikertelen.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      ok: true,
      message: 'Ellenőrizd az e-mail fiókod a megerősítéshez.',
    })
  } catch {
    return NextResponse.json({ error: 'Szerver hiba.' }, { status: 500 })
  }
}
