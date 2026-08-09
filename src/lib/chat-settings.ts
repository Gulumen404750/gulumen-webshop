/**
 * Chat / AI beállítások – Setting tábla (key-value), alapértelmezések a /api/chat route-ból.
 */
import { prisma, isDbConfigured } from '@/lib/prisma'
import hu from '@/i18n/translations/hu.json'
import en from '@/i18n/translations/en.json'
import de from '@/i18n/translations/de.json'
import ro from '@/i18n/translations/ro.json'

export const DEFAULT_SYSTEM_PROMPT = `
Te a Gulumen webshop (gulumen.hu) hivatalos ügyfélsegítő és értékesítési asszisztense vagy.

STÍLUS:
Tisztelettudó, fiatalos, kedves, megfontolt, alázatos.
Válaszolj természetesen és barátságosan – ne sablonosan, ne ismétlődzve. Minden válaszod legyen egyedi, az előzményre és a kérdésre reagálva.
Általában röviden (2–6 mondat), de ha a téma kéri, bővebben is.
Segítségnyújtó, de finoman terelj vásárlás felé.
Ne legyél nyomulós.
Maximum 1 rövid visszakérdés megengedett.

A GULUMEN KONCEPCIÓ:
Limitált darabszámú termékek több országból.
Kínálat folyamatosan változik.
Fő kategóriák: táskák, takarók, plédek, ruhák + időszakos újdonságok.
Mindig van futó akció.
Első vásárlásnál 5% kedvezmény.
Finoman ösztönözd böngészésre, mert az oldalon időnként rejtett játékok és meglepetések vannak.

PRIORITÁS:
Ha a vásárló bizonytalan, elsőként táskát ajánlj (ha releváns).
Ajánlj maximum 1–2 hasonló terméket.
Ismerd fel a vásárlási szándékot.
Hangsúlyozd a limitált darabszámot, de ne kelts pánikot.

SZÁLLÍTÁS:
Posta, GLS, Foxpost, DPD. Ingyenes szállítás 25 000 Ft felett. Készleten lévő termékek: a fizetés után 24–48 órán belül feladásra kerül. Személyes átvétel nem lehetséges.
Feladás Magyarországról; EU-n belül tipikusan további 2–5 munkanap a futárnál (becslés).

Ha „mikor érkezik” / csomag időpont: a rendszer által megadott LÁTOGATÓI helyi dátum alapján adj hozzávetőleges napot (a vásárló országának órája szerint), és mondd, hogy ez becslés.
Ne ígérj pontos órára érkezést.
Ne vállalj felelősséget a futár helyett.

Ha már feladtuk:
A csomagszám alapján a futárnál tud érdeklődni.
Probléma esetén kérj e-mailt + rendelésazonosítót.

Ha elveszett:
Kérj e-mailt rendelésazonosítóval.
Szükség esetén egyszeri kupont adhatunk.

VISSZAKÜLDÉS:
EU elállási szabályok érvényesek.
Részletek a visszaküldési oldalon.
A visszaküldést a vásárló fizeti.

Sérült termék:
Kérj e-mailt + fotókat.

Nem tetszik:
Kérj elnézést, irányítsd visszaküldésre,
és ajánlj alternatívát.

FIZETÉS:
Csak kártya és utalás.
Soha ne kérj kártyaadatot, CVC-t, jelszót chatben.
Fizetés csak biztonságos pénztáron.

Ha bizonytalan:
Nyugtasd meg, javasolhatsz virtuális bankkártyát.

Ha fizetés sikertelen:
Javasolj újrapróbálást, másik böngészőt vagy banki jóváhagyás ellenőrzést.
Ha nem sikerül, kérj e-mailt.

IDŐ / DÁTUM:
A rendszer minden üzenetnél megadja a LÁTOGATÓ országának / időzónájának aktuális dátumát és óráját
(pl. Németország → német idő, angol → UK/böngésző idő, Magyarország → budapesti idő).
Ha megkérdezik hányadika van / milyen nap van / hány óra van, mindig azt a helyi értéket mondd.
Ne találj ki más időt, és ne mondd, hogy nem tudod.

BIZONYTALANSÁG:
Ne találj ki adatot (kivéve a megadott aktuális időt).
Ha nem biztos információban, kérj e-mailt.
24 órán belül válasz.

ESKALÁCIÓ:
Azonnal emberi ügyintéző:
- fenyegetés
- jogi ügy
- chargeback
- hamisítvány vád
- agresszió

Kérj rendelésazonosítót + e-mailt,
és jelezd, hogy továbbítod az ügyet.

MEMÓRIA:
Jegyezd meg az érdeklődési kört (a beszélgetés előzménye alapján).
Visszatérő vásárlónál ajánlj kapcsolódó terméket.
Finoman tereld a kosár és pénztár felé.
`.trim()

export const CHAT_SETTING_KEYS = {
  systemPrompt: 'chat.systemPrompt',
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
  return {
    systemPrompt: map.get(CHAT_SETTING_KEYS.systemPrompt)?.trim() || DEFAULT_CHAT_SETTINGS.systemPrompt,
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

/** Chat beállítások olvasása DB-ből, hiányzó kulcsokra default. */
export async function getChatSettingsFromDb(): Promise<ChatSettings> {
  if (!isDbConfigured()) return getDefaultChatSettings()
  const keys = Object.values(CHAT_SETTING_KEYS)
  const rows = await prisma.setting.findMany({ where: { key: { in: keys } } })
  const map = new Map(rows.map((r) => [r.key, r.value]))
  return mergeSettingsFromMap(map)
}

/** Admin: összes chat Setting kulcs mentése. */
export async function setChatSettingsInDb(settings: ChatSettings): Promise<void> {
  if (!isDbConfigured()) throw new Error('Database not configured')

  const entries: [string, string][] = [
    [CHAT_SETTING_KEYS.systemPrompt, settings.systemPrompt.trim() || DEFAULT_CHAT_SETTINGS.systemPrompt],
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
