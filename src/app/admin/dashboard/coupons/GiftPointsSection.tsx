'use client'

import { useCallback, useEffect, useState } from 'react'
import { GiftPointQrCode } from '@/components/GiftPointQrCode'

type GiftBatchListItem = {
  id: string
  code: string
  points: number
  quantity: number
  active: boolean
  validFrom: string | null
  validUntil: string | null
  createdAt: string
  usedCount: number
  unusedCount: number
}

type GiftCodeRow = {
  id: string
  token: string
  active: boolean
  claimedAt: string | null
  claimedByEmail: string | null
  claimUrl: string
  nfcUrl: string
}

type GiftBatchDetail = GiftBatchListItem & {
  codes: GiftCodeRow[]
}

type GiftForm = {
  code: string
  points: string
  quantity: string
  extraQuantity: string
  validFrom: string
  validUntil: string
}

const emptyForm: GiftForm = {
  code: '',
  points: '',
  quantity: '1',
  extraQuantity: '',
  validFrom: '',
  validUntil: '',
}

function toLocalDatetime(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function localDatetimeToIso(local: string): string | null {
  if (!local.trim()) return null
  return new Date(local).toISOString()
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

export function AdminGiftPointsSection({
  createRequestKey = 0,
}: {
  /** Növelve: megnyitja a létrehozó modalt (a kupon modal típusváltásából). */
  createRequestKey?: number
}) {
  const [batches, setBatches] = useState<GiftBatchListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<GiftForm>(emptyForm)
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [codes, setCodes] = useState<GiftCodeRow[]>([])
  const [copied, setCopied] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    fetch('/api/admin/gift-points', { credentials: 'include' })
      .then(async (r) => {
        const data = await r.json()
        if (!r.ok) throw new Error(data.error ?? 'Betöltési hiba')
        return data as { batches: GiftBatchListItem[] }
      })
      .then((data) => setBatches(data.batches ?? []))
      .catch((e) => setError(e instanceof Error ? e.message : 'Betöltési hiba'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (createRequestKey > 0) {
      setForm(emptyForm)
      setCodes([])
      setEditingId(null)
      setFormError(null)
      setModalOpen(true)
    }
  }, [createRequestKey])

  const openCreate = () => {
    setForm(emptyForm)
    setCodes([])
    setEditingId(null)
    setFormError(null)
    setModalOpen(true)
  }

  const openEdit = async (id: string) => {
    setFormError(null)
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/gift-points/${id}`, { credentials: 'include' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Betöltési hiba')
      const batch = data.batch as GiftBatchDetail
      setEditingId(batch.id)
      setForm({
        code: batch.code,
        points: String(batch.points),
        quantity: String(batch.quantity),
        extraQuantity: '',
        validFrom: toLocalDatetime(batch.validFrom),
        validUntil: toLocalDatetime(batch.validUntil),
      })
      setCodes(batch.codes ?? [])
      setModalOpen(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Betöltési hiba')
    } finally {
      setSaving(false)
    }
  }

  const handleSubmit = async () => {
    const points = parseInt(form.points, 10)
    const quantity = parseInt(form.quantity, 10)
    if (!form.code.trim()) {
      setFormError('A címke / kód kötelező.')
      return
    }
    if (Number.isNaN(points) || points < 1) {
      setFormError('A pontérték legalább 1.')
      return
    }
    if (!editingId && (Number.isNaN(quantity) || quantity < 1)) {
      setFormError('A darabszám legalább 1.')
      return
    }

    setSaving(true)
    setFormError(null)
    try {
      if (editingId) {
        const extra = form.extraQuantity.trim() ? parseInt(form.extraQuantity, 10) : undefined
        const res = await fetch(`/api/admin/gift-points/${editingId}`, {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code: form.code.trim(),
            validFrom: localDatetimeToIso(form.validFrom),
            validUntil: localDatetimeToIso(form.validUntil),
            ...(extra && extra > 0 ? { extraQuantity: extra } : {}),
          }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          setFormError(data.error || 'Mentés sikertelen.')
          return
        }
        setCodes(data.batch?.codes ?? [])
        setForm((prev) => ({
          ...prev,
          quantity: String(data.batch?.quantity ?? prev.quantity),
          extraQuantity: '',
        }))
        load()
      } else {
        const res = await fetch('/api/admin/gift-points', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code: form.code.trim(),
            points,
            quantity,
            validFrom: localDatetimeToIso(form.validFrom),
            validUntil: localDatetimeToIso(form.validUntil),
          }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          setFormError(data.error || 'Létrehozás sikertelen.')
          return
        }
        const created = data.batch as {
          id: string
          codes: GiftCodeRow[]
        }
        setEditingId(created.id)
        setCodes(created.codes ?? [])
        load()
      }
    } catch {
      setFormError('Hálózati hiba.')
    } finally {
      setSaving(false)
    }
  }

  const deactivate = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/gift-points/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (res.ok) load()
    } catch {
      setError('Deaktiválás sikertelen.')
    }
  }

  const handleCopy = async (value: string, id: string) => {
    const ok = await copyText(value)
    if (ok) {
      setCopied(id)
      setTimeout(() => setCopied(null), 1500)
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-heading font-semibold text-foreground">Ajándékpontok / NFC kódok</h2>
          <p className="text-sm text-muted mt-1">
            Darabszámnyi egyszer használatos kód, egyedi claim URL, QR és NFC-re írható link.
            Aktiváláskor a pontok a tárcába kerülnek (1 pont = 1 Ft, 1 hónap, a termékár 100%-áig).
            25 000 Ft felett, csak ponttal fizetve a szállítási díjat ki kell fizetni. Kuponnal
            összevonható.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          Új ajándékpont
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/50 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-muted">Betöltés…</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[var(--border)] bg-[var(--border)]/30">
              <tr>
                <th className="p-3 font-medium">Címke</th>
                <th className="p-3 font-medium">Pont / db</th>
                <th className="p-3 font-medium">Darab</th>
                <th className="p-3 font-medium">Aktív</th>
                <th className="p-3 font-medium">Műveletek</th>
              </tr>
            </thead>
            <tbody>
              {batches.map((b) => (
                <tr key={b.id} className="border-b border-[var(--border)] hover:bg-[var(--border)]/20">
                  <td className="p-3 font-mono font-medium">{b.code}</td>
                  <td className="p-3 tabular-nums">{b.points.toLocaleString('hu-HU')}</td>
                  <td className="p-3 tabular-nums">
                    {b.usedCount} / {b.quantity} felhasználva
                  </td>
                  <td className={`p-3 font-medium ${b.active ? 'text-green-600' : 'text-amber-600'}`}>
                    {b.active ? 'Igen' : 'Nem'}
                  </td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void openEdit(b.id)}
                        className="text-accent hover:underline text-xs"
                      >
                        Szerkesztés / QR
                      </button>
                      {b.active && (
                        <button
                          type="button"
                          onClick={() => void deactivate(b.id)}
                          className="text-xs px-2 py-1 rounded bg-amber-600/10 text-amber-700 dark:text-amber-400"
                        >
                          Deaktiválás
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && batches.length === 0 && (
        <p className="text-sm text-muted">Még nincs ajándékpont-sorozat.</p>
      )}

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={() => !saving && setModalOpen(false)}
          role="presentation"
        >
          <div
            className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--card-bg)] p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="gift-point-modal-title"
          >
            <h2 id="gift-point-modal-title" className="text-lg font-semibold text-foreground mb-1">
              {editingId ? 'Ajándékpont szerkesztése' : 'Új ajándékpont'}
            </h2>
            <p className="text-sm text-muted mb-4">
              Minden darabhoz egyedi azonosító és <code className="font-mono">/claim/…</code> URL
              készül. A vevő beírhatja a tétel címkéjét (pl. AJANDEK5000) vagy az egyedi tokent a
              profilon / fizetésnél. A QR / NFC ugyanezt a linket írja. Aktiváláskor a kód egyszer
              használatosra válik, a pont 1 hónapig költhető, kuponnal összevonható.
            </p>

            {formError && (
              <div className="mb-4 rounded-lg border border-red-500/50 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-400">
                {formError}
              </div>
            )}

            <div className="space-y-4">
              <label className="block">
                <span className="text-sm font-medium text-foreground">Címke / kód *</span>
                <input
                  type="text"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                  className="mt-1 w-full rounded-lg border border-[var(--border)] bg-background px-3 py-2 font-mono text-foreground"
                  placeholder="PL. AJANDEK5000"
                />
                <span className="mt-1 block text-xs text-muted">
                  Ezt a címkét is be lehet váltani a profilon vagy a fizetésnél (egy fel nem használt tokennel).
                </span>
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="block">
                  <span className="text-sm font-medium text-foreground">Pont darabonként * (1 pont = 1 Ft)</span>
                  <input
                    type="number"
                    min={1}
                    value={form.points}
                    disabled={Boolean(editingId)}
                    onChange={(e) => setForm({ ...form, points: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-[var(--border)] bg-background px-3 py-2 text-foreground disabled:opacity-60"
                    placeholder="5000"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-foreground">
                    {editingId ? 'Generált darabszám' : 'Darabszám (quantity / max_uses) *'}
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={form.quantity}
                    disabled={Boolean(editingId)}
                    onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-[var(--border)] bg-background px-3 py-2 text-foreground disabled:opacity-60"
                    placeholder="10"
                  />
                </label>
              </div>

              {editingId && (
                <label className="block">
                  <span className="text-sm font-medium text-foreground">További darab generálása</span>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={form.extraQuantity}
                    onChange={(e) => setForm({ ...form, extraQuantity: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-[var(--border)] bg-background px-3 py-2 text-foreground"
                    placeholder="Üres = nem generál újat"
                  />
                </label>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="block">
                  <span className="text-sm font-medium text-foreground">Beváltható ettől</span>
                  <input
                    type="datetime-local"
                    value={form.validFrom}
                    onChange={(e) => setForm({ ...form, validFrom: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-[var(--border)] bg-background px-3 py-2 text-foreground"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-foreground">Beváltható eddig</span>
                  <input
                    type="datetime-local"
                    value={form.validUntil}
                    onChange={(e) => setForm({ ...form, validUntil: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-[var(--border)] bg-background px-3 py-2 text-foreground"
                  />
                </label>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                disabled={saving}
                className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-foreground hover:bg-[var(--border)]/30 disabled:opacity-50"
              >
                Bezárás
              </button>
              <button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={saving}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                {saving ? 'Mentés…' : editingId ? 'Mentés' : 'Generálás'}
              </button>
            </div>

            {codes.length > 0 && (
              <div className="mt-6 space-y-3">
                <h3 className="font-medium text-foreground">Egyedi azonosítók, QR és NFC URL</h3>
                <p className="text-xs text-muted">
                  NFC tagre a claim URL írható (URI rekord). Beolvasáskor a /claim oldalra visz.
                </p>
                <ul className="space-y-4">
                  {codes.map((c) => (
                    <li
                      key={c.token}
                      className="flex flex-col sm:flex-row gap-4 rounded-lg border border-[var(--border)] p-3"
                    >
                      <GiftPointQrCode value={c.claimUrl} alt={`QR ${c.token}`} size={120} />
                      <div className="min-w-0 flex-1 space-y-1 text-sm">
                        <p className="font-mono font-semibold text-foreground break-all">{c.token}</p>
                        <p className="text-muted break-all">{c.claimUrl}</p>
                        <p className="text-xs text-muted">NFC URL: {c.nfcUrl}</p>
                        <p className="text-xs">
                          {c.claimedAt
                            ? `Felhasználva${c.claimedByEmail ? `: ${c.claimedByEmail}` : ''}`
                            : c.active
                              ? 'Szabad'
                              : 'Inaktív'}
                        </p>
                        <div className="flex flex-wrap gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => void handleCopy(c.token, `t-${c.token}`)}
                            className="text-xs text-accent hover:underline"
                          >
                            {copied === `t-${c.token}` ? 'Másolva' : 'Token másolása'}
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleCopy(c.claimUrl, `u-${c.token}`)}
                            className="text-xs text-accent hover:underline"
                          >
                            {copied === `u-${c.token}` ? 'Másolva' : 'URL másolása (QR/NFC)'}
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
