/**
 * Telegram értesítések (pl. call summary). TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID.
 */

export async function sendTelegramMessage(text: string): Promise<{ ok: boolean; error?: string }> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim()
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim()
  if (!token || !chatId) {
    console.info('[telegram] TELEGRAM_BOT_TOKEN vagy TELEGRAM_CHAT_ID nincs megadva')
    return { ok: true }
  }
  const url = `https://api.telegram.org/bot${token}/sendMessage`
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: text.slice(0, 4096),
        disable_web_page_preview: true,
      }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok || !data?.ok) {
      console.error('[telegram] Send failed:', data)
      return { ok: false, error: data?.description || res.statusText }
    }
    return { ok: true }
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e)
    console.error('[telegram] Error:', err)
    return { ok: false, error: err }
  }
}

export function formatCallSummaryTelegram(payload: {
  callId: string
  timestamp: string
  language: string
  mode: string
  callerNumber?: string
  summary?: string
  tags: string[]
}): string {
  const lines = [
    '📞 *Hívás összefoglaló*',
    `ID: ${payload.callId}`,
    `Idő: ${payload.timestamp}`,
    `Nyelv: ${payload.language} | Mód: ${payload.mode}`,
  ]
  if (payload.callerNumber) lines.push(`Hívó: ${payload.callerNumber}`)
  if (payload.tags?.length) lines.push(`Címkék: ${payload.tags.join(', ')}`)
  if (payload.summary) lines.push(`\n${payload.summary}`)
  return lines.join('\n').replace(/\*/g, '')
}

/** Callback kérés értesítés (HU, adminnak). */
export function formatCallbackRequestTelegram(payload: {
  name: string
  phone: string
  topic?: string
  preferredTime?: string
  createdAt: Date
}): string {
  const timeStr = payload.createdAt.toLocaleString('hu-HU')
  const lines = [
    '📲 Új visszahívás kérés',
    `Név: ${payload.name}`,
    `Tel: ${payload.phone}`,
    `Téma: ${payload.topic ?? '–'}`,
    `Idő: ${timeStr}`,
    'Admin panel → Hívások',
  ]
  return lines.join('\n')
}
