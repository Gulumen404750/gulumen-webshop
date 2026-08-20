'use client'

import { useCallback, useEffect, useId, useMemo, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useLocale } from '@/context/LocaleContext'
import { ChatAvatar } from '@/components/ChatAvatar'
import {
  GUEST_AVATAR_SRC,
  PROFILE_AVATAR_CHANGED_EVENT,
  type ProfileAvatar,
} from '@/lib/profile-avatars'
import { localeNoticeText, type LocaleNotice } from '@/lib/locale-notice'

type CatalogItem = Pick<ProfileAvatar, 'id' | 'url'>

function hasAvatarImage(item: CatalogItem): boolean {
  const url = item.url.trim()
  return url.length > 0 && !url.includes('placeholder')
}

export function ProfileAvatarPicker() {
  const { t } = useLocale()
  const { isLoggedIn } = useAuth()
  const panelId = useId()
  const [open, setOpen] = useState(false)
  const [avatars, setAvatars] = useState<CatalogItem[]>([])
  const [brokenIds, setBrokenIds] = useState<Set<string>>(() => new Set())
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [savedId, setSavedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<LocaleNotice | null>(null)
  const [savedMsg, setSavedMsg] = useState(false)

  useEffect(() => {
    if (!isLoggedIn) return
    let cancelled = false
    setLoading(true)
    Promise.all([
      fetch('/api/profile-avatars', { credentials: 'include' }).then((r) => r.json().catch(() => ({}))),
      fetch('/api/me/profile', { credentials: 'include' }).then((r) => r.json().catch(() => ({}))),
    ])
      .then(([catalog, profile]) => {
        if (cancelled) return
        const list = Array.isArray(catalog?.avatars)
          ? catalog.avatars.filter(
              (a: unknown): a is CatalogItem =>
                !!a &&
                typeof a === 'object' &&
                typeof (a as CatalogItem).id === 'string' &&
                typeof (a as CatalogItem).url === 'string' &&
                hasAvatarImage(a as CatalogItem)
            )
          : []
        setAvatars(list)
        const id = typeof profile?.user?.avatarId === 'string' ? profile.user.avatarId : null
        setSelectedId(id)
        setSavedId(id)
      })
      .catch(() => {
        if (!cancelled) setError({ key: 'common.loadError' })
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [isLoggedIn])

  const visibleAvatars = useMemo(
    () => avatars.filter((avatar) => hasAvatarImage(avatar) && !brokenIds.has(avatar.id)),
    [avatars, brokenIds]
  )

  const selectedAvatar = visibleAvatars.find((avatar) => avatar.id === selectedId) ?? null

  const markBroken = useCallback((id: string) => {
    setBrokenIds((prev) => {
      if (prev.has(id)) return prev
      const next = new Set(prev)
      next.add(id)
      return next
    })
  }, [])

  const save = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      setSaving(true)
      setError(null)
      setSavedMsg(false)
      try {
        const res = await fetch('/api/me/profile', {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ avatarId: selectedId }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          setError({ key: 'common.saveError' })
          return
        }
        const id = typeof data.user?.avatarId === 'string' ? data.user.avatarId : null
        const url = typeof data.user?.avatarUrl === 'string' ? data.user.avatarUrl : GUEST_AVATAR_SRC
        setSelectedId(id)
        setSavedId(id)
        setSavedMsg(true)
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent(PROFILE_AVATAR_CHANGED_EVENT, { detail: { avatarUrl: url } })
          )
        }
      } catch {
        setError({ key: 'common.saveError' })
      } finally {
        setSaving(false)
      }
    },
    [selectedId]
  )

  if (!isLoggedIn || loading) return null

  return (
    <section className="mb-6 rounded-xl border border-[var(--border)] bg-[var(--card-bg)]">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-[var(--border)]/20"
      >
        {selectedAvatar ? (
          <ChatAvatar
            src={selectedAvatar.url}
            alt=""
            size={28}
            hideOnError
            onLoadError={() => markBroken(selectedAvatar.id)}
          />
        ) : null}
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-foreground">{t('profile.avatarSectionTitle')}</span>
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-muted transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden
        />
        <span className="sr-only">{open ? t('profile.avatarCollapse') : t('profile.avatarExpand')}</span>
      </button>

      {open && (
        <form id={panelId} onSubmit={save} className="space-y-3 border-t border-[var(--border)] px-4 py-3">
          <p className="text-xs text-muted leading-relaxed">{t('profile.avatarHint')}</p>
          {visibleAvatars.length > 0 ? (
            <div
              className="grid grid-cols-6 gap-1.5 sm:grid-cols-8 md:grid-cols-10"
              role="radiogroup"
              aria-label={t('profile.avatarSectionTitle')}
            >
              {visibleAvatars.map((avatar, index) => {
                const checked = selectedId === avatar.id
                return (
                  <button
                    key={avatar.id}
                    type="button"
                    role="radio"
                    aria-checked={checked}
                    onClick={() => {
                      setSelectedId(avatar.id)
                      setSavedMsg(false)
                    }}
                    className={`mx-auto rounded-full p-0.5 transition-shadow empty:hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                      checked ? 'ring-2 ring-accent ring-offset-2 ring-offset-[var(--card-bg)]' : ''
                    }`}
                    aria-label={t('profile.avatarOption', { n: String(index + 1) })}
                  >
                    <ChatAvatar
                      src={avatar.url}
                      alt=""
                      size={32}
                      hideOnError
                      onLoadError={() => markBroken(avatar.id)}
                    />
                  </button>
                )
              })}
            </div>
          ) : (
            <p className="text-xs text-muted">{t('profile.avatarEmpty')}</p>
          )}
          {error && (
            <p className="text-sm text-red-600 dark:text-red-400" role="alert">
              {localeNoticeText(t, error)}
            </p>
          )}
          {savedMsg && (
            <p className="text-sm text-green-700 dark:text-green-400" role="status">
              {t('profile.avatarSaved')}
            </p>
          )}
          <button
            type="submit"
            disabled={saving || selectedId === savedId || visibleAvatars.length === 0}
            className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:opacity-90 disabled:opacity-60"
          >
            {saving ? t('profile.avatarSaving') : t('profile.avatarSave')}
          </button>
        </form>
      )}
    </section>
  )
}
