/**
 * Bejelentkezett vásárló megszólítási neve a chathez.
 * Ha nincs név / nincs session: null → az AI ne említsen hiányt.
 */
import { getSession, resolveSessionUserId } from '@/lib/auth'
import { prisma, isDbConfigured } from '@/lib/prisma'

export async function resolveChatVisitorDisplayName(
  request: Request
): Promise<string | null> {
  try {
    const session = await getSession(request)
    if (!session) return null
    if (!isDbConfigured()) return null

    const userId = await resolveSessionUserId(session)
    if (!userId) return null

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    })
    return normalizeChatDisplayName(user?.name)
  } catch {
    return null
  }
}

/** Trim + első értelmes megszólítási alak (keresztnév / ahogy megadták). */
export function normalizeChatDisplayName(raw: string | null | undefined): string | null {
  const trimmed = typeof raw === 'string' ? raw.trim().replace(/\s+/g, ' ') : ''
  if (trimmed.length < 2) return null
  if (trimmed.length > 40) return trimmed.slice(0, 40).trim()
  return trimmed
}

/** System prompt blokk – csak ha van név. */
export function buildChatVisitorNameBlock(displayName: string | null): string {
  if (!displayName) return ''
  return `
[BEJELENTKEZETT VÁSÁRLÓ MEGSZÓLÍTÁSA]
A vásárló be van jelentkezve, és a profiljában megadta a megszólítási nevét: „${displayName}”.
- A köszöntésnél és ahol természetes, szólítsd a nevén (pl. „Szia, ${displayName}!”).
- Ne erőltesd minden mondatban; 1–2 alkalom / válasz elég, főleg nyitáskor.
- Ne említsd, hogy „a profilodból olvastam”, és ne kérdezd újra a nevét, ha már tudod.
`.trim()
}
