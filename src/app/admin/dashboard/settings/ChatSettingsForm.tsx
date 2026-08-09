'use client'

import { useCallback, useEffect, useState } from 'react'
import type { ChatSettings } from '@/lib/chat-settings'

type ApiResponse = {
  config: ChatSettings
  message?: string
}

export default function ChatSettingsForm() {
  const [config, setConfig] = useState<ChatSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchConfig = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/settings/chat', { credentials: 'include' })
      if (!res.ok) throw new Error(res.status === 401 ? 'Nincs jogosultság' : 'Hiba a betöltésnél')
      const data: ApiResponse = await res.json()
      setConfig(data.config)
      setMessage(data.message ?? null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ismeretlen hiba')
      setConfig(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchConfig()
  }, [fetchConfig])

  const handleSave = async () => {
    if (!config) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/settings/chat', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Mentés sikertelen')
      }
      const data = await res.json()
      if (data.config) setConfig(data.config)
      setMessage(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Mentés sikertelen')
    } finally {
      setSaving(false)
    }
  }

  const set = <K extends keyof ChatSettings>(key: K, value: ChatSettings[K]) => {
    if (!config) return
    setConfig({ ...config, [key]: value })
  }

  if (loading) {
    return (
      <section className="rounded-xl border border-[var(--border)] bg-[var(--card-bg)] p-6">
        <p className="text-sm text-muted">Betöltés…</p>
      </section>
    )
  }

  if (error && !config) {
    return (
      <section className="rounded-xl border border-[var(--border)] bg-[var(--card-bg)] p-6">
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        {error.includes('jogosultság') && (
          <a href="/admin/login" className="text-sm underline mt-2 inline-block">
            → Admin belépés
          </a>
        )}
      </section>
    )
  }

  const noDb = Boolean(message?.includes('nincs konfigurálva'))
  const c = config!

  return (
    <section className="rounded-xl border border-[var(--border)] bg-[var(--card-bg)] p-6 space-y-6">
      {message && <p className="text-sm text-amber-600 dark:text-amber-400">{message}</p>}

      <div>
        <label className="block text-sm font-medium mb-1">System prompt</label>
        <p className="text-xs text-muted mb-2">
          Az OpenAI modell rendszerüzenete. Alapértelmezés: a /api/chat route eredeti promptja.
        </p>
        <textarea
          value={c.systemPrompt}
          onChange={(e) => set('systemPrompt', e.target.value)}
          className="w-full rounded-lg border border-[var(--border)] bg-background px-3 py-2 text-foreground font-mono text-sm min-h-[280px]"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Fallback (magyar)</label>
          <textarea
            value={c.fallbackHu}
            onChange={(e) => set('fallbackHu', e.target.value)}
            className="w-full rounded-lg border border-[var(--border)] bg-background px-3 py-2 text-foreground text-sm min-h-[80px]"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Fallback (angol)</label>
          <textarea
            value={c.fallbackEn}
            onChange={(e) => set('fallbackEn', e.target.value)}
            className="w-full rounded-lg border border-[var(--border)] bg-background px-3 py-2 text-foreground text-sm min-h-[80px]"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Fallback (német)</label>
          <textarea
            value={c.fallbackDe}
            onChange={(e) => set('fallbackDe', e.target.value)}
            className="w-full rounded-lg border border-[var(--border)] bg-background px-3 py-2 text-foreground text-sm min-h-[80px]"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Fallback (román)</label>
          <textarea
            value={c.fallbackRo}
            onChange={(e) => set('fallbackRo', e.target.value)}
            className="w-full rounded-lg border border-[var(--border)] bg-background px-3 py-2 text-foreground text-sm min-h-[80px]"
          />
        </div>
      </div>

      <p className="text-xs text-muted">
        Fallback szövegek: OpenAI hiba vagy hiányzó API kulcs esetén, ha nincs specifikus szabály-alapú válasz.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl">
        <div>
          <label className="block text-sm font-medium mb-1">Rate limit (kérés / perc / IP)</label>
          <input
            type="number"
            min={1}
            max={600}
            value={c.rateLimitPerMinute}
            onChange={(e) => set('rateLimitPerMinute', parseInt(e.target.value, 10) || 1)}
            className="w-full rounded-lg border border-[var(--border)] bg-background px-3 py-2 text-foreground"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">OpenAI modell</label>
          <input
            type="text"
            value={c.openaiModel}
            onChange={(e) => set('openaiModel', e.target.value)}
            className="w-full rounded-lg border border-[var(--border)] bg-background px-3 py-2 text-foreground font-mono text-sm"
            placeholder="gpt-4o-mini"
          />
        </div>
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || noDb}
          className="px-4 py-2 rounded-lg bg-accent text-white font-medium hover:opacity-90 disabled:opacity-60"
        >
          {saving ? 'Mentés…' : noDb ? 'Mentés (DB kell)' : 'Mentés'}
        </button>
      </div>
    </section>
  )
}
