'use client'

import { useCallback, useEffect, useState } from 'react'
import { ADMIN_ROLES, type AdminRole } from '@/lib/admin-rbac'

type OperatorRow = {
  id: string
  username: string
  role: AdminRole
  active: boolean
  createdAt: string
  updatedAt: string
}

const ROLE_LABEL: Record<AdminRole, string> = {
  owner: 'Owner (minden)',
  support: 'Support (PII, rendelés – nincs ár/törlés/export)',
  catalog: 'Katalógus (termék, ár – nincs PII)',
  viewer: 'Megtekintő',
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
      setRequireFirstOwner(Boolean(data.requireFirstOwner))
      if (data.requireFirstOwner) setRole('owner')
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
          'Owner operátor létrehozva — a sessionod erre a fiókra váltott (nem záródtál ki). Írd fel a jelszót. További (support/catalog) operátorokhoz: inkognitó ablakban tesztelj, vagy a belépés parkolja az owner sessiont.'
        )
      } else {
        setMessage(
          'Operátor létrehozva. Teszteléshez használd inkognitó ablakot — ugyanebben a böngészőben a belépés parkolja az owner sessiont (visszaállítható).'
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
          Az első létrehozott operátor kötelezően owner (a te fiókod). Utána a belépéshez kulcs +
          felhasználónév + jelszó kell. Másik operátor tesztelése ugyanebben a böngészőben
          <strong> parkolja</strong> az owner sessiont (nem törli) — vagy használj inkognitó ablakot.
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
                        onChange={(e) => patchOperator(op.id, { role: e.target.value })}
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
            onChange={(e) => setRole(e.target.value as AdminRole)}
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

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      {message && <p className="text-sm text-green-700 dark:text-green-400">{message}</p>}
    </section>
  )
}
