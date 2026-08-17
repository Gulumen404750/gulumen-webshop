'use client'

import { useState } from 'react'

type Props = {
  json: unknown
  filename?: string
}

export function AdminOrderProductionJson({ json, filename = 'gyartasi-recept.json' }: Props) {
  const [copied, setCopied] = useState(false)
  const text = JSON.stringify(json, null, 2)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      setCopied(false)
    }
  }

  const download = () => {
    const blob = new Blob([text], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2 print:hidden">
        <button
          type="button"
          onClick={() => void copy()}
          className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm hover:bg-[var(--border)]/40"
        >
          {copied ? 'Másolva' : 'JSON másolása'}
        </button>
        <button
          type="button"
          onClick={download}
          className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm hover:bg-[var(--border)]/40"
        >
          JSON letöltése
        </button>
      </div>
      <pre className="overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--border)]/20 p-3 text-xs font-mono text-foreground whitespace-pre">
        {text}
      </pre>
    </div>
  )
}
