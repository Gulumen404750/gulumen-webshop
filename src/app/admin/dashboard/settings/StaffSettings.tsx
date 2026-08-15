'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ADMIN_ROLES,
  describeRoleAccess,
  type AdminRole,
} from '@/lib/admin-rbac'

type OperatorRow = {
  id: string
  username: string
  role: AdminRole
  active: boolean
  createdAt: string
  updatedAt: string
}

const ROLE_LABEL: Record<AdminRole, string> = {
  owner: 'Owner (főadmin – minden)',
  support: 'Support (PII, rendelés – nincs ár/törlés/export)',
  catalog: 'Katalógus (termék, ár – nincs PII)',
  viewer: 'Megtekintő',
}

function RolePermissionPreview({ role }: { role: AdminRole }) {
  const access = useMemo(() => describeRoleAccess(role), [role])
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--card-bg)]/40 p-3 space-y-3">
      <div>
        <h3 className="text-sm font-semibold">
          Jogosultságok — {ROLE_LABEL[role]}
        </h3>
        <p className="text-xs text-muted mt-0.5">
          A kiválasztott szerepkör pontosan ezeket a funkciókat éri el. A főadmin
          (`owner` / API-kulcs útvonal) jogosultságait más soha nem kaphatja meg.
        </p>
      </div>
      <ul className="grid gap-1.5 sm:grid-cols-2 text-sm">
        {access.permissions.map((entry) => (
          <li
            key={entry.permission}
            className={`flex gap-2 items-start rounded px-2 py-1 ${
              entry.granted
                ? 'bg-green-500/10 text-foreground'
                : 'bg-transparent text-muted line-through decoration-muted/60'
            }`}
          >
            <span className="shrink-0 font-mono text-xs mt-0.5" aria-hidden>
              {entry.granted ? '✓' : '✗'}
            </span>
            <span>
              <span className="font-medium">{entry.label}</span>
              <span className="block text-[11px] font-mono opacity-70">{entry.permission}</span>
            </span>
          </li>
        ))}
      </ul>
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted mb-1">
          Korlátozások
        </h4>
        <ul className="list-disc pl-5 text-sm text-muted space-y-1">
          {access.limitations.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </div>
    </div>
  )
}

export default function StaffSettings() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [operators, setOperators] = useState<OperatorRow[]>([])
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<AdminRole>('owner')
  const [requireFirstOwner, setRequireFirstOwner] = useState(true)
  const [busy, setBusy] = useState(false)
  const [forbidden, setForbidden] = useState(false)
  const [previewRole, setPreviewRole] = useState<AdminRole>('owner')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/staff', { credentials: 'include' })
      const data = await res.json().catch(() => ({}))
      if (res.status === 403) {
        setForbidden(true)
        setOperators([])
        return
      }
      if (!res.ok) {
        throw new Error(data.error || 'Lista lekérdezése sikertelen')
      }
      setForbidden(false)
      setOperators(Array.isArray(data.operators) ? data.operators : [])
      const needOwner = Boolean(data.requireFirstOwner)
      setRequireFirstOwner(needOwner)
      if (needOwner) {
        setRole('owner')
        setPreviewRole('owner')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ismeretlen hiba')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function createOperator(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setMessage(null)
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
      if (data.sessionUpgraded) {
        setMessage(
          'Owner operátor létrehozva — a sessionod erre a fiókra váltott (nem záródtál ki). Írd fel a jelszót. További (support/catalog) operátorokhoz: inkognitó ablakban tesztelj; az operátor belépés külön sütibe kerül, az owner session megmarad.'
        )
      } else {
        setMessage(
          'Operátor létrehozva. Teszteléshez használd az /operator/login oldalt (külön süti) — az owner session nem íródik felül.'
        )
      }
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Hiba')
    } finally {
      setBusy(false)
    }
  }

  async function patchOperator(id: string, body: Record<string, unknown>) {
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      const res = await fetch('/api/admin/staff', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...body }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Mentés sikertelen')
      if (typeof body.role === 'string') {
        setPreviewRole(body.role as AdminRole)
      }
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Hiba')
    } finally {
      setBusy(false)
    }
  }

  async function removeOperator(id: string) {
    if (!confirm('Törlöd ezt az operátort?')) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/staff?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Törlés sikertelen')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Hiba')
    } finally {
      setBusy(false)
    }
  }

  if (forbidden) return null

  return (
    <section className="rounded-xl border border-[var(--border)] bg-background p-4 space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Operátorok (RBAC)</h2>
        <p className="text-sm text-muted mt-1">
          Amíg nincs aktív <strong>owner</strong> operátor, az API kulcs + 2FA elég (bootstrap).
          Az első létrehozott operátor kötelezően owner. A főadmin belépés (
          <code>/admin/login</code> vagy rejtett slug, API kulcs + 2FA) mindig működik —
          unbreakable fallback. Másodlagos fiókok: <code>/operator/login</code> (felhasználónév +
          jelszó) — külön süti, nem írja felül az owner sessiont; párhuzamosan is bent lehetnek.
        </p>
        {requireFirstOwner && (
          <p className="text-sm text-amber-700 dark:text-amber-300 mt-2">
            Most hozz létre egy <strong>owner</strong> fiókot magadnak ismert jelszóval — ezután
            adhatsz support/catalog jogosultságot másoknak.
          </p>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-muted">Betöltés…</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted border-b border-[var(--border)]">
                <th className="py-2 pr-3">Felhasználó</th>
                <th className="py-2 pr-3">Szerep</th>
                <th className="py-2 pr-3">Aktív</th>
                <th className="py-2">Művelet</th>
              </tr>
            </thead>
            <tbody>
              {operators.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-3 text-muted">
                    Nincs operátor – egykulcsos fallback aktív.
                  </td>
                </tr>
              ) : (
                operators.map((op) => (
                  <tr key={op.id} className="border-b border-[var(--border)]/60">
                    <td className="py-2 pr-3 font-mono">{op.username}</td>
                    <td className="py-2 pr-3">
                      <select
                        value={op.role}
                        disabled={busy}
                        onChange={(e) => {
                          const next = e.target.value as AdminRole
                          setPreviewRole(next)
                          void patchOperator(op.id, { role: next })
                        }}
                        onFocus={() => setPreviewRole(op.role)}
                        className="rounded border border-[var(--border)] bg-background px-2 py-1"
                      >
                        {ADMIN_ROLES.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2 pr-3">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => patchOperator(op.id, { active: !op.active })}
                        className="text-sm underline"
                      >
                        {op.active ? 'igen' : 'nem'}
                      </button>
                    </td>
                    <td className="py-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          setPreviewRole(op.role)
                        }}
                        className="text-sm underline mr-3"
                      >
                        Jogok
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => removeOperator(op.id)}
                        className="text-sm text-red-600 dark:text-red-400"
                      >
                        Törlés
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      <form onSubmit={createOperator} className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="staff-username">
            Új felhasználónév
          </label>
          <input
            id="staff-username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-background"
            autoComplete="off"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="staff-password">
            Jelszó (min. 10)
          </label>
          <input
            id="staff-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-background"
            autoComplete="new-password"
            required
            minLength={10}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="staff-role">
            Szerep
          </label>
          <select
            id="staff-role"
            value={role}
            onChange={(e) => {
              const next = e.target.value as AdminRole
              setRole(next)
              setPreviewRole(next)
            }}
            className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-background"
          >
            {ADMIN_ROLES.filter((r) => !requireFirstOwner || r === 'owner').map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <button
            type="submit"
            disabled={busy}
            className="px-4 py-2 rounded-lg bg-accent text-white font-medium disabled:opacity-60"
          >
            {busy ? 'Mentés…' : 'Operátor hozzáadása'}
          </button>
        </div>
      </form>

      <RolePermissionPreview role={previewRole} />

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      {message && <p className="text-sm text-green-700 dark:text-green-400">{message}</p>}
    </section>
  )
}
