'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

export default function AdminLoginPage() {
  const [key, setKey] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const from = searchParams.get('from') || '/admin/dashboard'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data?.error || 'Bejelentkezés sikertelen.')
        return
      }
      router.push(from)
      router.refresh()
    } catch {
      setError('Hiba történt.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--card-bg)] p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        <h1 className="text-xl font-semibold text-foreground">Admin belépés</h1>
        <div>
          <label htmlFor="admin-key" className="block text-sm font-medium text-foreground mb-1">
            API kulcs
          </label>
          <input
            id="admin-key"
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-background text-foreground"
            placeholder="ADMIN_API_KEY"
            autoComplete="off"
          />
        </div>
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-2 rounded-lg bg-accent text-white font-medium hover:opacity-90 disabled:opacity-60"
        >
          {loading ? 'Belépés…' : 'Belépés'}
        </button>
      </form>
    </div>
  )
}
