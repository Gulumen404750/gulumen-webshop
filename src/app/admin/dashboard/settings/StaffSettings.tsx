'use client'

import { useCallback, useEffect, useState } from 'react'
import { ADMIN_ROLES, type AdminRole } from '@/lib/admin-rbac'

type Operator = {
  id: string
  username: string
  role: AdminRole
  active: boolean
  createdAt: string
}

export default function StaffSettings() {
  const [operators, setOperators] = useState<Operator[]>([])
  const [error, setError] = useState<string | null>(null)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<AdminRole>('ops')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/staff', { credentials: 'include' })
    if (res.status === 403 || res.status === 401) {
      setOperators([])
      return
    }
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(data.error || 'Lista betöltése sikertelen')
      return
    }
    setOperators(data.operators || [])
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function create(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/staff', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, role }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Létrehozás sikertelen')
      setUsername('')
      setPassword('')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Hiba')
    } finally {
      setBusy(false)
    }
  }

  async function setActive(id: string, active: boolean) {
    setError(null)
    const res = await fetch('/api/admin/staff', {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, active }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(data.error || 'Módosítás sikertelen')
      return
    }
    await load()
  }

  if (operators.length === 0 && !error) {
    return null
  }

  return (
    <section className="rounded-xl border border-[var(--border)] bg-background p-4 space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Munkatársak (RBAC)</h2>
        <p className="text-sm text-muted mt-1">
          viewer: olvasás PII nélkül · catalog: termék · ops: rendelés + ügyféladat · owner: minden.
        </p>
      </div>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      <ul className="text-sm space-y-2">
        {operators.map((op) => (
          <li key={op.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-[var(--border)] px-3 py-2">
            <span className="font-medium">{op.username}</span>
            <span className="text-muted">{op.role}</span>
            <span className={op.active ? 'text-green-700 dark:text-green-400' : 'text-amber-700'}>
              {op.active ? 'aktív' : 'tiltva'}
            </span>
            <button
              type="button"
              className="ml-auto text-xs underline"
              onClick={() => void setActive(op.id, !op.active)}
            >
              {op.active ? 'Tiltás' : 'Engedélyezés'}
            </button>
          </li>
        ))}
      </ul>
      <form onSubmit={create} className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs mb-1" htmlFor="staff-username">Felhasználónév</label>
          <input
            id="staff-username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-36 px-2 py-1.5 rounded-lg border border-[var(--border)] bg-background text-sm"
          />
        </div>
        <div>
          <label className="block text-xs mb-1" htmlFor="staff-password">Jelszó</label>
          <input
            id="staff-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-40 px-2 py-1.5 rounded-lg border border-[var(--border)] bg-background text-sm"
          />
        </div>
        <div>
          <label className="block text-xs mb-1" htmlFor="staff-role">Szerep</label>
          <select
            id="staff-role"
            value={role}
            onChange={(e) => setRole(e.target.value as AdminRole)}
            className="px-2 py-1.5 rounded-lg border border-[var(--border)] bg-background text-sm"
          >
            {ADMIN_ROLES.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-accent px-3 py-1.5 text-sm text-white disabled:opacity-60"
        >
          {busy ? 'Mentés…' : 'Új munkatárs'}
        </button>
      </form>
    </section>
  )
}
