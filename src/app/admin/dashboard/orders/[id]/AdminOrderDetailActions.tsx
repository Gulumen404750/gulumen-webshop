'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function AdminOrderDetailActions({
  orderId,
  status,
}: {
  orderId: string
  status: string
}) {
  const router = useRouter()
  const [loading, setLoading] = useState<'success' | 'fail' | null>(null)

  const canSuccess = ['payment_pending', 'sourcing_pending'].includes(status)
  const canFail = ['payment_pending', 'sourcing_pending'].includes(status)

  const handleSuccess = async () => {
    setLoading('success')
    try {
      const res = await fetch(`/api/admin/sourcing/${orderId}/success`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        router.refresh()
      } else {
        alert(data?.error || 'Hiba')
      }
    } finally {
      setLoading(null)
    }
  }

  const handleFail = async () => {
    if (!confirm('Sourcing fail – visszautalás / törlés. Biztosan?')) return
    setLoading('fail')
    try {
      const res = await fetch(`/api/admin/sourcing/${orderId}/fail`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        router.refresh()
      } else {
        alert(data?.error || 'Hiba')
      }
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="flex gap-4 pt-4 border-t border-[var(--border)]">
      {canSuccess && (
        <button
          type="button"
          onClick={handleSuccess}
          disabled={!!loading}
          className="rounded-lg bg-green-600 px-4 py-2 text-white font-medium hover:bg-green-700 disabled:opacity-60"
        >
          {loading === 'success' ? 'Folyamatban…' : 'Sourcing sikeres'}
        </button>
      )}
      {canFail && (
        <button
          type="button"
          onClick={handleFail}
          disabled={!!loading}
          className="rounded-lg bg-red-600 px-4 py-2 text-white font-medium hover:bg-red-700 disabled:opacity-60"
        >
          {loading === 'fail' ? 'Folyamatban…' : 'Sourcing sikertelen'}
        </button>
      )}
      {!canSuccess && !canFail && (
        <p className="text-muted text-sm">Ehhez a rendeléshez nem elérhető sourcing akció.</p>
      )}
    </div>
  )
}
