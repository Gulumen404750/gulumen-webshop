'use client'

import { useCallback, useEffect, useState } from 'react'
import '@/lib/admin-fetch'

type PendingApproval = {
  id: string
  type: string
  status: string
  payload: {
    kind?: 'bulk_delete' | 'bulk_price'
    resource: string
    ids: string[]
    mode?: string
  }
  requestedByUsername: string | null
  requestedByRole: string | null
  expiresAt: string
  secondsRemaining: number
}

function actionLabel(a: PendingApproval): string {
  if (a.payload.kind === 'bulk_price' || a.type.startsWith('bulk_price')) {
    const mode = a.payload.mode === 'fixed' ? 'fix ár' : 'százalék'
    return `tömeges ármódosítás (${mode})`
  }
  return 'tömeges törlés'
}

/**
 * Owner dashboard alert: függő bulk-delete / bulk-price kérelmek (5 perc ablak).
 */
export function AdminApprovalAlerts({ enabled }: { enabled: boolean }) {
  const [approvals, setApprovals] = useState<PendingApproval[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!enabled) return
    try {
      const res = await fetch('/api/admin/approvals', { credentials: 'include' })
      if (!res.ok) return
      const data = await res.json().catch(() => ({}))
      setApprovals(Array.isArray(data.approvals) ? data.approvals : [])
    } catch {
      /* poll silence */
    }
  }, [enabled])

  useEffect(() => {
    if (!enabled) return
    void load()
    const t = setInterval(() => void load(), 15_000)
    return () => clearInterval(t)
  }, [enabled, load])

  async function act(id: string, action: 'approve' | 'reject') {
    setBusyId(id)
    setError(null)
    try {
      const res = await fetch(`/api/admin/approvals/${id}/${action}`, {
        method: 'POST',
        credentials: 'include',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data?.error || 'Művelet sikertelen')
        await load()
        return
      }
      await load()
    } catch {
      setError('Hálózati hiba')
    } finally {
      setBusyId(null)
    }
  }

  if (!enabled || approvals.length === 0) return null

  return (
    <div className="mb-4 space-y-2">
      {error && (
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      )}
      {approvals.map((a) => (
        <div
          key={a.id}
          className="rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-3 text-sm text-foreground flex flex-wrap items-center justify-between gap-3"
          role="alert"
        >
          <div>
            <p className="font-medium text-red-800 dark:text-red-200">
              Sürgős: {actionLabel(a)} jóváhagyás ({a.payload.ids.length} {a.payload.resource})
            </p>
            <p className="text-muted mt-0.5">
              Kérte: {a.requestedByUsername || '—'}
              {a.requestedByRole ? ` (${a.requestedByRole})` : ''} · hátralévő:{' '}
              {Math.max(0, a.secondsRemaining)} mp · 5 perc után automatikus elutasítás
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busyId === a.id}
              onClick={() => void act(a.id, 'approve')}
              className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
            >
              Jóváhagyás
            </button>
            <button
              type="button"
              disabled={busyId === a.id}
              onClick={() => void act(a.id, 'reject')}
              className="rounded-lg border border-[var(--border)] bg-background px-3 py-1.5 text-sm font-medium hover:bg-[var(--border)]/30 disabled:opacity-60"
            >
              Elutasítás
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
