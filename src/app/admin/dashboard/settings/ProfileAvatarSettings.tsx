'use client'

import { useCallback, useEffect, useState } from 'react'
import { CdnImageManager } from '@/components/CdnImageManager'
import { ChatAvatar } from '@/components/ChatAvatar'

type ApiResponse = {
  defaults: { id: string; url: string }[]
  extraUrls: string[]
  message?: string
}

export default function ProfileAvatarSettings() {
  const [defaults, setDefaults] = useState<{ id: string; url: string }[]>([])
  const [extraUrls, setExtraUrls] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchConfig = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/settings/avatars', { credentials: 'include' })
      if (!res.ok) throw new Error(res.status === 401 ? 'Nincs jogosultság' : 'Hiba a betöltésnél')
      const data: ApiResponse = await res.json()
      setDefaults(data.defaults ?? [])
      setExtraUrls((data.extraUrls ?? []).filter((url) => typeof url === 'string' && url.trim().length > 0))
      setMessage(data.message ?? null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ismeretlen hiba')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchConfig()
  }, [fetchConfig])

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/settings/avatars', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ extraUrls: extraUrls.filter((url) => url.trim().length > 0) }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Mentés sikertelen')
      }
      await fetchConfig()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Mentés sikertelen')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <p className="text-sm text-muted">Profilképek betöltése…</p>
  }

  return (
    <section className="rounded-xl border border-[var(--border)] bg-[var(--card-bg)] p-4 space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Chat / profil avatarok</h2>
        <p className="mt-1 text-sm text-muted">
          Ezekből az alapképekből választ a vásárló a profilján. A kiválasztott kép a jobb alsó chat
          ablak felhasználói üzenetei mellett jelenik meg. Az AI üzenetek mellett a Gulumen logo
          marad. Extra feltöltéseknél csak a tényleges képek jelennek meg kis bélyegképként; kattintásra
          teljes méretben megnyithatók.
        </p>
      </div>
      <div>
        <p className="text-sm font-medium text-foreground mb-2">Alapkészlet</p>
        <div className="flex flex-wrap gap-2">
          {defaults.map((avatar) => (
            <ChatAvatar key={avatar.id} src={avatar.url} alt="" size={48} />
          ))}
        </div>
      </div>
      <CdnImageManager
        multiple
        previewLayout="thumbnails"
        label="További avatarok (feltöltés)"
        values={extraUrls}
        onChangeMultiple={setExtraUrls}
      />
      {message && <p className="text-sm text-muted">{message}</p>}
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={() => void handleSave()}
        disabled={saving}
        className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:opacity-90 disabled:opacity-60"
      >
        {saving ? 'Mentés…' : 'Extra avatarok mentése'}
      </button>
    </section>
  )
}
