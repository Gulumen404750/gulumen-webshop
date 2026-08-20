'use client'

import { useCallback, useEffect, useState } from 'react'
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

export function ProfileAvatarPicker() {
  const { t } = useLocale()
  const { isLoggedIn } = useAuth()
  const [avatars, setAvatars] = useState<CatalogItem[]>([])
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
                typeof (a as CatalogItem).url === 'string'
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
    <form
      onSubmit={save}
      className="mb-6 rounded-xl border border-[var(--border)] bg-[var(--card-bg)] p-4 space-y-3"
    >
      <div>
        <p className="text-sm font-medium text-foreground">{t('profile.avatarLabel')}</p>
        <p className="mt-1 text-xs text-muted leading-relaxed">{t('profile.avatarHint')}</p>
      </div>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t('profile.avatarLabel')}>
        {avatars.map((avatar, index) => {
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
              className={`rounded-full p-0.5 transition-shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                checked ? 'ring-2 ring-accent ring-offset-2 ring-offset-[var(--card-bg)]' : ''
              }`}
              aria-label={t('profile.avatarOption', { n: String(index + 1) })}
            >
              <ChatAvatar src={avatar.url} alt="" size={48} />
            </button>
          )
        })}
      </div>
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
        disabled={saving || selectedId === savedId}
        className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:opacity-90 disabled:opacity-60"
      >
        {saving ? t('profile.avatarSaving') : t('profile.avatarSave')}
      </button>
    </form>
  )
}
