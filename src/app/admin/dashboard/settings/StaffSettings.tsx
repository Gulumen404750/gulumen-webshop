'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import '@/lib/admin-fetch'
import {
  OPERATOR_ROLES,
  describeRoleAccess,
  isOperatorRole,
  type AdminRole,
  type OperatorRole,
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
  owner: 'Owner (csak gyári főadmin – nem adható)',
  support: 'Support (PII, rendelés – nincs ár/törlés/export)',
  catalog: 'Katalógus (termék, ár – nincs PII)',
  viewer: 'Megtekintő',
}

const DEFAULT_OPERATOR_ROLE: OperatorRole = 'support'

function RolePermissionPreview({ role }: { role: AdminRole }) {
  const access = useMemo(() => describeRoleAccess(role), [role])
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--card-bg)]/40 p-3 space-y-3">
      <div>
        <h3 className="text-sm font-semibold">
          Jogosultságok — {ROLE_LABEL[role]}
        </h3>
        <p className="text-xs text-muted mt-0.5">
          A kiválasztott operátori szerepkör pontosan ezeket a funkciókat éri el. A főadmin
          (`ADMIN_API_KEY` + 2FA) jogosultságait másodlagos felhasználó soha nem kaphatja meg.
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
  const [role, setRole] = useState<OperatorRole>(DEFAULT_OPERATOR_ROLE)
  const [ownerCount, setOwnerCount] = useState(0)
  const [masterSession, setMasterSession] = useState(false)
  const [busy, setBusy] = useState(false)
  const [forbidden, setForbidden] = useState(false)
  const [previewRole, setPreviewRole] = useState<AdminRole>(DEFAULT_OPERATOR_ROLE)

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
      setOwnerCount(typeof data.ownerCount === 'number' ? data.ownerCount : 0)
      setMasterSession(Boolean(data.masterSession))
      setRole(DEFAULT_OPERATOR_ROLE)
      setPreviewRole(DEFAULT_OPERATOR_ROLE)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ismeretlen hiba')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  function canDeleteOperator(op: OperatorRow): boolean {
    // Gyári főadmin (ADMIN_API_KEY + 2FA): bármely operátor törölhető, last-owner sem blokkol.
    if (masterSession) return true
    if (op.role === 'owner' && op.active && ownerCount <= 1) return false
    return true
  }

  async function createOperator(e: React.FormEvent) {
    e.preventDefault()
    if (!isOperatorRole(role)) {
      setError('Owner / főadmin szerep nem adható operátornak.')
      return
    }
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
      setRole(DEFAULT_OPERATOR_ROLE)
      if (data.masterSessionPreserved || masterSession) {
        setMessage(
          'Operátor létrehozva. A főadmin (API-kulcs) sessioned érintetlen maradt. Tesztelés: /operator/login — külön süti, párhuzamos session.'
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
    if (body.role === 'owner') {
      setError('Owner / főadmin szerep nem adható operátornak.')
      setMessage(null)
      return
    }
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
      if (typeof body.role === 'string' && isOperatorRole(body.role)) {
        setPreviewRole(body.role)
      }
      setMessage('Operátor frissítve.')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Hiba')
    } finally {
      setBusy(false)
    }
  }

  async function removeOperator(op: OperatorRow) {
    if (!canDeleteOperator(op)) {
      setError(
        'Az utolsó aktív owner nem törölhető ebből a sessionből. Lépj be a főadmin API-kulcs + 2FA útvonalon (/admin/login).'
      )
      setMessage(null)
      return
    }
    if (!confirm(`Biztosan törlöd az operátort: ${op.username}?`)) return
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      // POST + JSON body — a querystringes DELETE CSRF/rewrite alatt nem mindig futott le.
      const res = await fetch('/api/admin/staff', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', id: op.id }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(
          typeof data.error === 'string' ? data.error : 'Törlés sikertelen'
        )
      }
      // Azonnali UI: lista frissítés a DB törlés után, majd szerver-lista egyeztetés.
      setOperators((prev) => prev.filter((row) => row.id !== op.id))
      if (op.role === 'owner' && op.active) {
        setOwnerCount((c) => Math.max(0, c - 1))
      }
      setMessage(`Operátor törölve: ${op.username}`)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Hiba')
      await load()
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
          A főadmin hozzáférés kizárólag <code>/admin/login</code> (vagy rejtett slug) +{' '}
          <strong>ADMIN_API_KEY + 2FA</strong> útvonalon érhető el — owner szerep operátornak soha
          nem adható. Másodlagos fiókok: <code>/operator/login</code> (felhasználónév + jelszó),
          választható szerepek: support, catalog, viewer. Külön süti; párhuzamos session lehetséges.
          {masterSession && (
            <>
              {' '}
              Most <strong>master session</strong>ben vagy: bármely operátor azonnal módosítható /
              törölhető.
            </>
          )}
        </p>
      </div>

      {error && (
        <p
          className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300"
          role="alert"
        >
          {error}
        </p>
      )}
      {message && (
        <p className="rounded-lg border border-green-500/30 bg-green-500/10 px-3 py-2 text-sm text-green-800 dark:text-green-300">
          {message}
        </p>
      )}

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
                    Nincs operátor – egykulcsos főadmin fallback aktív.
                  </td>
                </tr>
              ) : (
                operators.map((op) => {
                  const deletable = canDeleteOperator(op)
                  const legacyOwner = op.role === 'owner'
                  return (
                    <tr key={op.id} className="border-b border-[var(--border)]/60">
                      <td className="py-2 pr-3 font-mono">{op.username}</td>
                      <td className="py-2 pr-3">
                        <select
                          value={legacyOwner ? '' : op.role}
                          disabled={busy}
                          onChange={(e) => {
                            const next = e.target.value as OperatorRole
                            if (!isOperatorRole(next)) return
                            setPreviewRole(next)
                            void patchOperator(op.id, { role: next })
                          }}
                          onFocus={() => setPreviewRole(isOperatorRole(op.role) ? op.role : 'support')}
                          className="rounded border border-[var(--border)] bg-background px-2 py-1"
                        >
                          {legacyOwner && (
                            <option value="" disabled>
                              Owner (legacy – válassz operátori szerepet)
                            </option>
                          )}
                          {OPERATOR_ROLES.map((r) => (
                            <option key={r} value={r}>
                              {ROLE_LABEL[r]}
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
                            setPreviewRole(isOperatorRole(op.role) ? op.role : 'support')
                          }}
                          className="text-sm underline mr-3"
                        >
                          Jogok
                        </button>
                        <button
                          type="button"
                          disabled={busy || !deletable}
                          title={
                            deletable
                              ? `Törlés: ${op.username}`
                              : 'Az utolsó aktív owner csak a főadmin API-kulcs sessionből törölhető'
                          }
                          onClick={() => void removeOperator(op)}
                          className="text-sm text-red-600 dark:text-red-400 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          Törlés
                        </button>
                      </td>
                    </tr>
                  )
                })
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
              const next = e.target.value as OperatorRole
              if (!isOperatorRole(next)) return
              setRole(next)
              setPreviewRole(next)
            }}
            className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-background"
          >
            {OPERATOR_ROLES.map((r) => (
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
    </section>
  )
}
