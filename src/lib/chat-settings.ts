/**
 * Chat / AI beállítások – Setting tábla (key-value), alapértelmezések a /api/chat route-ból.
 */
import { prisma, isDbConfigured } from '@/lib/prisma'
import hu from '@/i18n/translations/hu.json'
import en from '@/i18n/translations/en.json'
import de from '@/i18n/translations/de.json'
import ro from '@/i18n/translations/ro.json'
import {
  DEFAULT_SYSTEM_PROMPT,
  SYSTEM_PROMPT_REVISION,
} from '@/lib/gulumen-cx-handbook'

export { DEFAULT_SYSTEM_PROMPT, SYSTEM_PROMPT_REVISION }

export const CHAT_SETTING_KEYS = {
  systemPrompt: 'chat.systemPrompt',
  systemPromptRevision: 'chat.systemPromptRevision',
  fallbackHu: 'chat.fallbackHu',
  fallbackEn: 'chat.fallbackEn',
  fallbackDe: 'chat.fallbackDe',
  fallbackRo: 'chat.fallbackRo',
  rateLimitPerMinute: 'chat.rateLimitPerMinute',
  openaiModel: 'chat.openaiModel',
} as const

export type ChatSettings = {
  systemPrompt: string
  fallbackHu: string
  fallbackEn: string
  fallbackDe: string
  fallbackRo: string
  rateLimitPerMinute: number
  openaiModel: string
}

export const DEFAULT_CHAT_SETTINGS: ChatSettings = {
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
  fallbackHu: hu.ai.default,
  fallbackEn: en.ai.default,
  fallbackDe: de.ai.default,
  fallbackRo: ro.ai.default,
  rateLimitPerMinute: 60,
  openaiModel: 'gpt-4o-mini',
}

function parseRateLimit(value: string | undefined): number {
  const n = parseInt(value ?? '', 10)
  if (Number.isNaN(n) || n < 1) return DEFAULT_CHAT_SETTINGS.rateLimitPerMinute
  return Math.min(n, 600)
}

function mergeSettingsFromMap(map: Map<string, string>): ChatSettings {
  const storedRevision = map.get(CHAT_SETTING_KEYS.systemPromptRevision)?.trim() ?? ''
  const useCodePrompt = storedRevision !== SYSTEM_PROMPT_REVISION
  return {
    systemPrompt: useCodePrompt
      ? DEFAULT_CHAT_SETTINGS.systemPrompt
      : map.get(CHAT_SETTING_KEYS.systemPrompt)?.trim() || DEFAULT_CHAT_SETTINGS.systemPrompt,
    fallbackHu: map.get(CHAT_SETTING_KEYS.fallbackHu)?.trim() || DEFAULT_CHAT_SETTINGS.fallbackHu,
    fallbackEn: map.get(CHAT_SETTING_KEYS.fallbackEn)?.trim() || DEFAULT_CHAT_SETTINGS.fallbackEn,
    fallbackDe: map.get(CHAT_SETTING_KEYS.fallbackDe)?.trim() || DEFAULT_CHAT_SETTINGS.fallbackDe,
    fallbackRo: map.get(CHAT_SETTING_KEYS.fallbackRo)?.trim() || DEFAULT_CHAT_SETTINGS.fallbackRo,
    rateLimitPerMinute: parseRateLimit(map.get(CHAT_SETTING_KEYS.rateLimitPerMinute)),
    openaiModel:
      map.get(CHAT_SETTING_KEYS.openaiModel)?.trim() || DEFAULT_CHAT_SETTINGS.openaiModel,
  }
}

/** Szinkron alapértelmezések (admin GET DB nélkül). */
export function getDefaultChatSettings(): ChatSettings {
  return { ...DEFAULT_CHAT_SETTINGS }
}

/**
 * Ha a kódbeli SYSTEM_PROMPT_REVISION újabb, mint a DB-ben tárolt,
 * felülírja a chat.systemPrompt-ot a hivatalos kézikönyvvel (éles deploy után azonnal).
 * Admin később újra menthet; a mentés a jelenlegi revisiont is elmenti.
 */
async function ensureSystemPromptRevisionSynced(map: Map<string, string>): Promise<void> {
  const storedRevision = map.get(CHAT_SETTING_KEYS.systemPromptRevision)?.trim() ?? ''
  if (storedRevision === SYSTEM_PROMPT_REVISION) return

  await prisma.$transaction([
    prisma.setting.upsert({
      where: { key: CHAT_SETTING_KEYS.systemPrompt },
      create: { key: CHAT_SETTING_KEYS.systemPrompt, value: DEFAULT_SYSTEM_PROMPT },
      update: { value: DEFAULT_SYSTEM_PROMPT },
    }),
    prisma.setting.upsert({
      where: { key: CHAT_SETTING_KEYS.systemPromptRevision },
      create: { key: CHAT_SETTING_KEYS.systemPromptRevision, value: SYSTEM_PROMPT_REVISION },
      update: { value: SYSTEM_PROMPT_REVISION },
    }),
  ])
}

/** Chat beállítások olvasása DB-ből, hiányzó kulcsokra default. */
export async function getChatSettingsFromDb(): Promise<ChatSettings> {
  if (!isDbConfigured()) return getDefaultChatSettings()
  const keys = Object.values(CHAT_SETTING_KEYS)
  const rows = await prisma.setting.findMany({ where: { key: { in: keys } } })
  const map = new Map(rows.map((r) => [r.key, r.value]))

  const storedRevision = map.get(CHAT_SETTING_KEYS.systemPromptRevision)?.trim() ?? ''
  if (storedRevision !== SYSTEM_PROMPT_REVISION) {
    try {
      await ensureSystemPromptRevisionSynced(map)
      map.set(CHAT_SETTING_KEYS.systemPrompt, DEFAULT_SYSTEM_PROMPT)
      map.set(CHAT_SETTING_KEYS.systemPromptRevision, SYSTEM_PROMPT_REVISION)
    } catch {
      // DB írás sikertelen (pl. csak olvasható) – akkor is a kódbeli promptot adjuk vissza.
      return {
        ...mergeSettingsFromMap(map),
        systemPrompt: DEFAULT_SYSTEM_PROMPT,
      }
    }
  }

  return mergeSettingsFromMap(map)
}

/** Admin: összes chat Setting kulcs mentése. */
export async function setChatSettingsInDb(settings: ChatSettings): Promise<void> {
  if (!isDbConfigured()) throw new Error('Database not configured')

  const prompt = settings.systemPrompt.trim() || DEFAULT_CHAT_SETTINGS.systemPrompt
  const entries: [string, string][] = [
    [CHAT_SETTING_KEYS.systemPrompt, prompt],
    [CHAT_SETTING_KEYS.systemPromptRevision, SYSTEM_PROMPT_REVISION],
    [CHAT_SETTING_KEYS.fallbackHu, settings.fallbackHu.trim() || DEFAULT_CHAT_SETTINGS.fallbackHu],
    [CHAT_SETTING_KEYS.fallbackEn, settings.fallbackEn.trim() || DEFAULT_CHAT_SETTINGS.fallbackEn],
    [CHAT_SETTING_KEYS.fallbackDe, settings.fallbackDe.trim() || DEFAULT_CHAT_SETTINGS.fallbackDe],
    [CHAT_SETTING_KEYS.fallbackRo, settings.fallbackRo.trim() || DEFAULT_CHAT_SETTINGS.fallbackRo],
    [
      CHAT_SETTING_KEYS.rateLimitPerMinute,
      String(Math.min(600, Math.max(1, settings.rateLimitPerMinute))),
    ],
    [CHAT_SETTING_KEYS.openaiModel, settings.openaiModel.trim() || DEFAULT_CHAT_SETTINGS.openaiModel],
  ]

  await prisma.$transaction(
    entries.map(([key, value]) =>
      prisma.setting.upsert({
        where: { key },
        create: { key, value },
        update: { value },
      })
    )
  )
}

export function getChatFallbackForLocale(
  settings: ChatSettings,
  locale: 'hu' | 'en' | 'de' | 'ro'
): string {
  switch (locale) {
    case 'en':
      return settings.fallbackEn
    case 'de':
      return settings.fallbackDe
    case 'ro':
      return settings.fallbackRo
    default:
      return settings.fallbackHu
  }
}

/** OpenAI model lista: beállított modell + eredeti backup (gpt-4o). */
export function resolveOpenAiModels(primaryModel: string): string[] {
  const primary = primaryModel.trim() || DEFAULT_CHAT_SETTINGS.openaiModel
  const fallbacks = ['gpt-4o-mini', 'gpt-4o']
  const models = [primary, ...fallbacks.filter((m) => m !== primary)]
  return [...new Set(models)]
}
