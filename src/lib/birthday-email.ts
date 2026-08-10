/**
 * Születésnapi 15%-os kupon e-mail (Resend) – marketing, leiratkozási linkkel.
 */
import {
  ensureUnsubToken,
  marketingUnsubscribeUrl,
} from '@/lib/marketing-consent'
import { sendMailRequired } from '@/lib/mail'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.gulumen.com'

async function marketingFooter(email: string): Promise<{ html: string; text: string }> {
  const token = await ensureUnsubToken(email)
  const url = marketingUnsubscribeUrl(token)
  if (!url) return { html: '', text: '' }
  return {
    html: `<hr style="margin-top:24px;border:none;border-top:1px solid #ddd"/><p style="font-size:12px;color:#666">Ha nem szeretnél több marketing e-mailt kapni, <a href="${url}">iratkozz le itt</a>.</p>`,
    text: `\n\nLeiratkozás: ${url}`,
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export type SendBirthdayCouponEmailParams = {
  to: string
  name: string | null
  percent: number
  couponCode: string
  validUntil: Date
}

export type SendBirthdayCouponEmailResult = { ok: true } | { ok: false; error: string }

export async function sendBirthdayCouponEmail(
  params: SendBirthdayCouponEmailParams
): Promise<SendBirthdayCouponEmailResult> {
  const greeting = params.name?.trim()
    ? `Kedves ${params.name.trim()}!`
    : 'Kedves Vásárlónk!'
  const validUntilHu = params.validUntil.toLocaleDateString('hu-HU', {
    timeZone: 'Europe/Budapest',
  })
  const shopUrl = `${APP_URL.replace(/\/$/, '')}/termekek`

  const footer = await marketingFooter(params.to)

  const subject = `Boldog születésnapot! ${params.percent}% exkluzív Gulumen kupon`
  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;color:#222">
      <p>${escapeHtml(greeting)}</p>
      <p>Boldog születésnapot! 🎉 Itt az ajándékunk a nagy napodra.</p>
      <p>Egy <strong>${params.percent}%-os</strong> exkluzív kupon, amely <strong>${escapeHtml(validUntilHu)}</strong>-ig érvényes. A kódot a profilodon és a fizetés oldalon is megtalálod.</p>
      <p style="font-size:22px;letter-spacing:0.05em;margin:20px 0">
        <code style="background:#f4f4f4;padding:10px 14px;border-radius:8px">${escapeHtml(params.couponCode)}</code>
      </p>
      <p><a href="${shopUrl}" style="display:inline-block;background:#c45c26;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600">Vásárlás indítása</a></p>
      <p style="font-size:13px;color:#666">A kupon egyszer használható fel a webshopban.</p>
      ${footer.html}
    </div>
  `
  const text = [
    greeting,
    '',
    'Boldog születésnapot! Itt az ajándékunk a nagy napodra.',
    `Ajándékunk: ${params.percent}% exkluzív kupon (${params.couponCode}), érvényes: ${validUntilHu}-ig.`,
    'A kódot a profilodon és a fizetés oldalon is megtalálod.',
    `Vásárlás: ${shopUrl}`,
    footer.text,
  ].join('\n')

  const result = await sendMailRequired({
    to: params.to,
    subject,
    html,
    text,
  })
  if (!result.ok) {
    return {
      ok: false,
      error:
        result.error.includes('RESEND_API_KEY')
          ? 'RESEND_API_KEY nincs beállítva – az e-mail nem ment ki (a kupon létrejött).'
          : result.error,
    }
  }
  return { ok: true }
}
