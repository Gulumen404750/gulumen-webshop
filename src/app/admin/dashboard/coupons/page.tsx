'use client'

import { useCallback, useEffect, useState } from 'react'
import { AdminPromoCouponsSection } from './PromoCouponsSection'

type Coupon = {
  id: string
  code: string
  discountType: string
  discountValue: number
  active: boolean
  validFrom: string | null
  validUntil: string | null
  minOrderHuf: number | null
  maxUses: number | null
  usedCount: number
  source: string | null
}

type ActiveTab = 'all' | 'active' | 'inactive'

type CouponFormData = {
  code: string
  discountType: 'percent' | 'fixed'
  discountValue: string
  validFrom: string
  validUntil: string
  minOrderHuf: string
  maxUses: string
}

const emptyForm: CouponFormData = {
  code: '',
  discountType: 'percent',
  discountValue: '',
  validFrom: '',
  validUntil: '',
  minOrderHuf: '',
  maxUses: '',
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

function couponToForm(c: Coupon): CouponFormData {
  return {
    code: c.code,
    discountType: c.discountType === 'fixed' ? 'fixed' : 'percent',
    discountValue: String(c.discountValue),
    validFrom: toLocalDatetime(c.validFrom),
    validUntil: toLocalDatetime(c.validUntil),
    minOrderHuf: c.minOrderHuf != null ? String(c.minOrderHuf) : '',
    maxUses: c.maxUses != null ? String(c.maxUses) : '',
  }
}

function formatDiscountType(type: string): string {
  return type === 'fixed' ? 'Fix összeg' : 'Százalék'
}

function formatDiscountValue(type: string, value: number): string {
  return type === 'fixed' ? `${value.toLocaleString('hu-HU')} Ft` : `${value}%`
}

function formatValidity(from: string | null, until: string | null): string {
  if (!from && !until) return 'Korlátlan'
  const fmt = (d: string) =>
    new Date(d).toLocaleDateString('hu-HU', { year: 'numeric', month: 'short', day: 'numeric' })
  if (from && until) return `${fmt(from)} – ${fmt(until)}`
  if (from) return `${fmt(from)} –`
  return `– ${fmt(until!)}`
}

function formatUses(used: number, max: number | null): string {
  if (max == null) return `${used} / ∞`
  return `${used} / ${max}`
}

function buildPayload(form: CouponFormData) {
  const discountValue = parseInt(form.discountValue, 10)
  const minOrderHuf = form.minOrderHuf.trim() ? parseInt(form.minOrderHuf, 10) : null
  const maxUses = form.maxUses.trim() ? parseInt(form.maxUses, 10) : null
  return {
    code: form.code.trim(),
    discountType: form.discountType,
    discountValue,
    validFrom: localDatetimeToIso(form.validFrom),
    validUntil: localDatetimeToIso(form.validUntil),
    minOrderHuf,
    maxUses,
  }
}

function validateForm(form: CouponFormData): string | null {
  if (!form.code.trim()) return 'A kuponkód kötelező.'
  const value = parseInt(form.discountValue, 10)
  if (Number.isNaN(value)) return 'Az érték kötelező és szám kell legyen.'
  if (form.discountType === 'percent' && (value < 1 || value > 100)) {
    return 'Százalékos kedvezmény: 1–100 között.'
  }
  if (form.discountType === 'fixed' && value < 1) return 'Fix kedvezmény: legalább 1 Ft.'
  if (form.minOrderHuf.trim()) {
    const min = parseInt(form.minOrderHuf, 10)
    if (Number.isNaN(min) || min < 0) return 'Minimum rendelés érvénytelen.'
  }
  if (form.maxUses.trim()) {
    const max = parseInt(form.maxUses, 10)
    if (Number.isNaN(max) || max < 1) return 'Max. felhasználás: legalább 1.'
  }
  if (form.validFrom && form.validUntil) {
    if (new Date(form.validUntil) <= new Date(form.validFrom)) {
      return 'A lejárat dátuma későbbi kell legyen, mint az érvényesség kezdete.'
    }
  }
  return null
}

type CouponModalProps = {
  mode: 'create' | 'edit'
  form: CouponFormData
  saving: boolean
  formError: string | null
  onChange: (form: CouponFormData) => void
  onClose: () => void
  onSubmit: () => void
}

function CouponModal({ mode, form, saving, formError, onChange, onClose, onSubmit }: CouponModalProps) {
  const set = <K extends keyof CouponFormData>(key: K, value: CouponFormData[K]) => {
    onChange({ ...form, [key]: value })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--card-bg)] p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="coupon-modal-title"
      >
        <h2 id="coupon-modal-title" className="text-lg font-semibold text-foreground mb-4">
          {mode === 'create' ? 'Új kupon' : 'Kupon szerkesztése'}
        </h2>

        {formError && (
          <div className="mb-4 rounded-lg border border-red-500/50 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-400">
            {formError}
          </div>
        )}

        <div className="space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-foreground">Kuponkód *</span>
            <input
              type="text"
              value={form.code}
              onChange={(e) => set('code', e.target.value.toUpperCase())}
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-background px-3 py-2 text-foreground font-mono"
              placeholder="PL. NYAR2026"
            />
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block">
              <span className="text-sm font-medium text-foreground">Típus *</span>
              <select
                value={form.discountType}
                onChange={(e) => set('discountType', e.target.value as 'percent' | 'fixed')}
                className="mt-1 w-full rounded-lg border border-[var(--border)] bg-background px-3 py-2 text-foreground"
              >
                <option value="percent">Százalék (%)</option>
                <option value="fixed">Fix összeg (Ft)</option>
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-medium text-foreground">Érték *</span>
              <input
                type="number"
                min={1}
                max={form.discountType === 'percent' ? 100 : undefined}
                value={form.discountValue}
                onChange={(e) => set('discountValue', e.target.value)}
                className="mt-1 w-full rounded-lg border border-[var(--border)] bg-background px-3 py-2 text-foreground"
                placeholder={form.discountType === 'percent' ? '10' : '1000'}
              />
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block">
              <span className="text-sm font-medium text-foreground">Érvényes ettől</span>
              <input
                type="datetime-local"
                value={form.validFrom}
                onChange={(e) => set('validFrom', e.target.value)}
                className="mt-1 w-full rounded-lg border border-[var(--border)] bg-background px-3 py-2 text-foreground"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-foreground">Érvényes eddig</span>
              <input
                type="datetime-local"
                value={form.validUntil}
                onChange={(e) => set('validUntil', e.target.value)}
                className="mt-1 w-full rounded-lg border border-[var(--border)] bg-background px-3 py-2 text-foreground"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block">
              <span className="text-sm font-medium text-foreground">Min. rendelés (Ft)</span>
              <input
                type="number"
                min={0}
                value={form.minOrderHuf}
                onChange={(e) => set('minOrderHuf', e.target.value)}
                className="mt-1 w-full rounded-lg border border-[var(--border)] bg-background px-3 py-2 text-foreground"
                placeholder="Üres = nincs minimum"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-foreground">Max. felhasználás</span>
              <input
                type="number"
                min={1}
                value={form.maxUses}
                onChange={(e) => set('maxUses', e.target.value)}
                className="mt-1 w-full rounded-lg border border-[var(--border)] bg-background px-3 py-2 text-foreground"
                placeholder="Üres = korlátlan"
              />
            </label>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-foreground hover:bg-[var(--border)]/30 disabled:opacity-50"
          >
            Mégse
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={saving}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {saving ? 'Mentés…' : mode === 'create' ? 'Létrehozás' : 'Mentés'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AdminCouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<ActiveTab>('all')
  const [sourceFilter, setSourceFilter] = useState('')
  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<CouponFormData>(emptyForm)
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const loadCoupons = useCallback(() => {
    setError(null)
    setLoading(true)
    const params = new URLSearchParams()
    if (activeTab === 'active') params.set('active', 'true')
    else if (activeTab === 'inactive') params.set('active', 'false')
    if (sourceFilter) params.set('source', sourceFilter)

    fetch(`/api/admin/coupons?${params}`, { credentials: 'include' })
      .then((r) => {
        if (r.status === 401) {
          setError('Nincs jogosultság. Jelentkezz be: Admin belépés (API kulcs).')
          return { coupons: [] }
        }
        if (r.status === 503) {
          setError('Adatbázis nincs beállítva.')
          return { coupons: [] }
        }
        return r.json()
      })
      .then((data) => {
        if (data.coupons) setCoupons(data.coupons)
      })
      .catch(() => setError('Hálózati hiba. Próbáld újra.'))
      .finally(() => setLoading(false))
  }, [activeTab, sourceFilter])

  useEffect(() => {
    loadCoupons()
  }, [loadCoupons])

  const openCreate = () => {
    setForm(emptyForm)
    setFormError(null)
    setEditingId(null)
    setModalMode('create')
  }

  const openEdit = (coupon: Coupon) => {
    setForm(couponToForm(coupon))
    setFormError(null)
    setEditingId(coupon.id)
    setModalMode('edit')
  }

  const closeModal = () => {
    if (saving) return
    setModalMode(null)
    setEditingId(null)
    setFormError(null)
  }

  const handleSubmit = async () => {
    const validationError = validateForm(form)
    if (validationError) {
      setFormError(validationError)
      return
    }

    setSaving(true)
    setFormError(null)
    const payload = buildPayload(form)

    try {
      const url = modalMode === 'edit' && editingId ? `/api/admin/coupons/${editingId}` : '/api/admin/coupons'
      const method = modalMode === 'edit' ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (res.status === 409) {
          setFormError('Ez a kuponkód már foglalt.')
          return
        }
        if (data.details) {
          setFormError('Érvénytelen adatok. Ellenőrizd a mezőket.')
          return
        }
        setFormError(data.error || 'Mentés sikertelen.')
        return
      }
      setModalMode(null)
      setEditingId(null)
      setFormError(null)
      loadCoupons()
    } catch {
      setFormError('Hálózati hiba.')
    } finally {
      setSaving(false)
    }
  }

  const deactivateCoupon = async (id: string) => {
    setUpdatingId(id)
    try {
      const res = await fetch(`/api/admin/coupons/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (res.ok) loadCoupons()
      else setError('Deaktiválás sikertelen.')
    } catch {
      setError('Hálózati hiba.')
    } finally {
      setUpdatingId(null)
    }
  }

  const activateCoupon = async (id: string) => {
    setUpdatingId(id)
    try {
      const res = await fetch(`/api/admin/coupons/${id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: true }),
      })
      if (res.ok) loadCoupons()
      else setError('Aktiválás sikertelen.')
    } catch {
      setError('Hálózati hiba.')
    } finally {
      setUpdatingId(null)
    }
  }

  const tabs: { id: ActiveTab; label: string }[] = [
    { id: 'all', label: 'Összes' },
    { id: 'active', label: 'Aktív' },
    { id: 'inactive', label: 'Inaktív' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-heading font-bold text-foreground">Kuponok / kedvezmények</h1>
        <button
          type="button"
          onClick={openCreate}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          Új kupon
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-amber-700 dark:text-amber-400">
          <p className="font-medium">Hiba</p>
          <p className="text-sm mt-1">{error}</p>
          {error.includes('Jelentkezz be') && (
            <a href="/admin/login" className="text-sm underline mt-2 inline-block">
              → Admin belépés
            </a>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-accent text-white'
                : 'bg-[var(--border)] text-foreground hover:opacity-80'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-4">
        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
          className="rounded-lg border border-[var(--border)] bg-background px-3 py-2 text-foreground"
        >
          <option value="">Összes forrás</option>
          <option value="admin">Admin</option>
          <option value="gamification">Gamification</option>
          <option value="registration">Regisztráció (DB kód)</option>
          <option value="cat">Macska (DB kód)</option>
        </select>
      </div>

      <AdminPromoCouponsSection />

      {loading ? (
        <p className="text-muted">Betöltés…</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[var(--border)] bg-[var(--border)]/30">
              <tr>
                <th className="p-3 font-medium">Kód</th>
                <th className="p-3 font-medium">Típus</th>
                <th className="p-3 font-medium">Érték</th>
                <th className="p-3 font-medium">Aktív</th>
                <th className="p-3 font-medium">Felhasználások</th>
                <th className="p-3 font-medium">Érvényesség</th>
                <th className="p-3 font-medium">Műveletek</th>
              </tr>
            </thead>
            <tbody>
              {coupons.map((c) => {
                const busy = updatingId === c.id
                const statusColor = c.active ? 'text-green-600' : 'text-amber-600'
                return (
                  <tr key={c.id} className="border-b border-[var(--border)] hover:bg-[var(--border)]/20">
                    <td className="p-3 font-mono font-medium">{c.code}</td>
                    <td className="p-3">{formatDiscountType(c.discountType)}</td>
                    <td className="p-3">{formatDiscountValue(c.discountType, c.discountValue)}</td>
                    <td className={`p-3 font-medium ${statusColor}`}>{c.active ? 'Igen' : 'Nem'}</td>
                    <td className="p-3 tabular-nums">{formatUses(c.usedCount, c.maxUses)}</td>
                    <td className="p-3 text-muted">{formatValidity(c.validFrom, c.validUntil)}</td>
                    <td className="p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openEdit(c)}
                          className="text-accent hover:underline text-xs"
                        >
                          Szerkesztés
                        </button>
                        {c.active ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => deactivateCoupon(c.id)}
                            className="text-xs px-2 py-1 rounded bg-amber-600/10 text-amber-700 dark:text-amber-400 hover:bg-amber-600/20 disabled:opacity-50"
                          >
                            Deaktiválás
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => activateCoupon(c.id)}
                            className="text-xs px-2 py-1 rounded bg-green-600/10 text-green-700 dark:text-green-400 hover:bg-green-600/20 disabled:opacity-50"
                          >
                            Aktiválás
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {!loading && coupons.length === 0 && (
        <p className="text-muted">Nincs kupon ebben a szűrésben.</p>
      )}

      {modalMode && (
        <CouponModal
          mode={modalMode}
          form={form}
          saving={saving}
          formError={formError}
          onChange={setForm}
          onClose={closeModal}
          onSubmit={handleSubmit}
        />
      )}
    </div>
  )
}
