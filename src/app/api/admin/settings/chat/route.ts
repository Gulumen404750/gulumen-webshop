import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/admin-auth'
import { isDbConfigured } from '@/lib/prisma'
import {
  getChatSettingsFromDb,
  getDefaultChatSettings,
  setChatSettingsInDb,
  type ChatSettings,
} from '@/lib/chat-settings'

export const dynamic = 'force-dynamic'

const chatSettingsSchema = z.object({
  systemPrompt: z.string().min(1),
  fallbackHu: z.string().min(1),
  fallbackEn: z.string().min(1),
  fallbackDe: z.string().min(1),
  fallbackRo: z.string().min(1),
  rateLimitPerMinute: z.number().int().min(1).max(600),
  openaiModel: z.string().min(1),
})

/** GET /api/admin/settings/chat – chat beállítások (default + DB override). */
export async function GET() {
  const ok = await requireAdmin()
  if (!ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!isDbConfigured()) {
    return NextResponse.json({
      config: getDefaultChatSettings(),
      message: 'Adatbázis nincs konfigurálva; az alapértelmezett értékek érvényesek, mentés nem elérhető.',
    })
  }

  try {
    const config = await getChatSettingsFromDb()
    return NextResponse.json({ config })
  } catch (e) {
    console.error('[api/admin/settings/chat] GET', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

/** PATCH /api/admin/settings/chat – chat beállítások mentése. */
export async function PATCH(request: Request) {
  const ok = await requireAdmin()
  if (!ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = chatSettingsSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const config: ChatSettings = parsed.data

  try {
    await setChatSettingsInDb(config)
    const saved = await getChatSettingsFromDb()
    return NextResponse.json({ ok: true, config: saved })
  } catch (e) {
    console.error('[api/admin/settings/chat] PATCH', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
