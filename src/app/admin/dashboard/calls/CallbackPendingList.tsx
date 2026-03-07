'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

type CallbackItem = {
  id: string
  name: string
  phone: string
  topic: string | null
  preferredTime: string | null
  createdAt: string
  emailSent: boolean | null
  webhookSent: boolean | null
  deliveryStatus: string | null
  note: string | null
}

export function CallbackPendingList({ items }: { items: CallbackItem[] }) {
  const router = useRouter()
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [noteById, setNoteById] = useState<Record<string, string>>({})

  const handleStatus = async (id: string, status: 'done' | 'cancelled') => {
    setUpdatingId(id)
    try {
      const res = await fetch(`/api/admin/callback-request/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          note: noteById[id]?.trim().slice(0, 200) || undefined,
        }),
      })
      if (res.ok) {
        router.refresh()
      } else {
        const data = await res.json().catch(() => ({}))
        alert(data?.error || 'Hiba történt')
      }
    } finally {
      setUpdatingId(null)
    }
  }

  const deliveryWarning = (r: CallbackItem) => {
    const noEmail = r.emailSent === false
    const noWebhook = r.webhookSent === false
    return noEmail && noWebhook
  }

  if (items.length === 0) {
    return <p className="text-muted text-sm">Nincs függő visszahívás.</p>
  }

  return (
    <ul className="space-y-2">
      {items.map((r) => (
        <li
          key={r.id}
          className="rounded-lg border border-[var(--border)] p-3 text-sm"
        >
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {deliveryWarning(r) && (
              <span className="text-amber-600" title="Email és webhook sem ment ki">
                ⚠️
              </span>
            )}
            <span className="font-medium">{r.name}</span>
            <span>·</span>
            <a href={`tel:${r.phone}`} className="text-accent hover:underline">
              {r.phone}
            </a>
            {r.topic && (
              <>
                <span>·</span>
                <span className="text-muted">{r.topic}</span>
              </>
            )}
            {r.preferredTime && (
              <span className="text-muted">({r.preferredTime})</span>
            )}
            <span className="text-muted ml-auto">
              {new Date(r.createdAt).toLocaleString('hu-HU')}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <input
              type="text"
              placeholder="Megjegyzés (max 200)"
              maxLength={200}
              className="max-w-xs rounded border border-[var(--border)] bg-background px-2 py-1 text-sm"
              value={noteById[r.id] ?? r.note ?? ''}
              onChange={(e) =>
                setNoteById((prev) => ({ ...prev, [r.id]: e.target.value }))
              }
            />
            <button
              type="button"
              onClick={() => handleStatus(r.id, 'done')}
              disabled={updatingId === r.id}
              className="rounded bg-green-600 px-2 py-1 text-sm text-white hover:bg-green-700 disabled:opacity-50"
            >
              ✅ Done
            </button>
            <button
              type="button"
              onClick={() => handleStatus(r.id, 'cancelled')}
              disabled={updatingId === r.id}
              className="rounded bg-red-600 px-2 py-1 text-sm text-white hover:bg-red-700 disabled:opacity-50"
            >
              ❌ Cancelled
            </button>
          </div>
        </li>
      ))}
    </ul>
  )
}
