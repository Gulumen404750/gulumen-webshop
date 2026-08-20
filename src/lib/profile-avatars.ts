/**
 * Felhasználói profilképek a chathez: admin által megadott alapkészlet + feltöltött extra képek.
 */
import { isFirstPartyImageUrl } from '@/lib/product-image-urls'
import { isValidImageUrl, normalizeImageUrl } from '@/lib/product-images'
import { prisma, isDbConfigured } from '@/lib/prisma'

export const GULUMEN_CHAT_LOGO_SRC = '/img/logo.png'
export const GULUMEN_CHAT_LOGO_FALLBACK_SRC = '/img/avatars/gulumen-mark.svg'
export const GUEST_AVATAR_SRC = '/img/avatars/guest.svg'
export const PROFILE_AVATAR_SETTING_KEY = 'profile_avatar_catalog'
export const PROFILE_AVATAR_CHANGED_EVENT = 'gulumen-avatar-changed'
export const MAX_ADMIN_AVATAR_EXTRAS = 16

export type ProfileAvatar = {
  id: string
  url: string
  source: 'default' | 'admin'
}

export const DEFAULT_PROFILE_AVATARS: ProfileAvatar[] = [
  { id: 'seed-01', url: '/img/avatars/seed-01.svg', source: 'default' },
  { id: 'seed-02', url: '/img/avatars/seed-02.svg', source: 'default' },
  { id: 'seed-03', url: '/img/avatars/seed-03.svg', source: 'default' },
  { id: 'seed-04', url: '/img/avatars/seed-04.svg', source: 'default' },
  { id: 'seed-05', url: '/img/avatars/seed-05.svg', source: 'default' },
  { id: 'seed-06', url: '/img/avatars/seed-06.svg', source: 'default' },
  { id: 'seed-07', url: '/img/avatars/seed-07.svg', source: 'default' },
  { id: 'seed-08', url: '/img/avatars/seed-08.svg', source: 'default' },
]

/** Stabil, kriptográfia nélküli hash az extra avatar azonosítóhoz. */
export function extraAvatarId(url: string): string {
  let h = 2166136261
  for (let i = 0; i < url.length; i++) {
    h ^= url.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return `extra-${(h >>> 0).toString(16)}`
}

export function isAllowedAdminAvatarUrl(url: unknown): url is string {
  if (typeof url !== 'string') return false
  const normalized = normalizeImageUrl(url)
  if (!normalized || normalized.startsWith('blob:') || normalized.startsWith('data:')) return false
  if (!isValidImageUrl(normalized)) return false
  return isFirstPartyImageUrl(normalized)
}

export function normalizeAdminAvatarUrls(urls: unknown): string[] {
  if (!Array.isArray(urls)) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of urls) {
    if (!isAllowedAdminAvatarUrl(raw)) continue
    const url = normalizeImageUrl(raw)
    if (seen.has(url)) continue
    seen.add(url)
    out.push(url)
    if (out.length >= MAX_ADMIN_AVATAR_EXTRAS) break
  }
  return out
}

export function buildProfileAvatarCatalog(extraUrls: string[] = []): ProfileAvatar[] {
  const extras = normalizeAdminAvatarUrls(extraUrls).map((url) => ({
    id: extraAvatarId(url),
    url,
    source: 'admin' as const,
  }))
  return [...DEFAULT_PROFILE_AVATARS, ...extras]
}

export function resolveProfileAvatar(
  avatarId: string | null | undefined,
  catalog: ProfileAvatar[] = DEFAULT_PROFILE_AVATARS
): ProfileAvatar | null {
  if (!avatarId) return null
  return catalog.find((item) => item.id === avatarId) ?? null
}

export async function getAdminAvatarExtraUrls(): Promise<string[]> {
  if (!isDbConfigured()) return []
  try {
    const row = await prisma.setting.findUnique({ where: { key: PROFILE_AVATAR_SETTING_KEY } })
    if (!row?.value) return []
    const parsed = JSON.parse(row.value) as { extraUrls?: unknown }
    return normalizeAdminAvatarUrls(parsed.extraUrls)
  } catch {
    return []
  }
}

export async function setAdminAvatarExtraUrls(urls: string[]): Promise<string[]> {
  if (!isDbConfigured()) throw new Error('Database not configured')
  const extraUrls = normalizeAdminAvatarUrls(urls)
  const value = JSON.stringify({ extraUrls })
  await prisma.setting.upsert({
    where: { key: PROFILE_AVATAR_SETTING_KEY },
    create: { key: PROFILE_AVATAR_SETTING_KEY, value },
    update: { value },
  })
  return extraUrls
}

export async function getProfileAvatarCatalog(): Promise<ProfileAvatar[]> {
  const extras = await getAdminAvatarExtraUrls()
  return buildProfileAvatarCatalog(extras)
}
