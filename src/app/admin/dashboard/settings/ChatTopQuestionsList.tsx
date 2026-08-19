'use client'

import { useMemo, useState } from 'react'

export type ChatQuestionRow = {
  question: string
  count: number
  lastAskedAt: string
  missingProductSearchCount: number
}

const PAGE_SIZE = 10

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('hu-HU', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

type Filter = 'all' | 'missing'

type Props = {
  questions: ChatQuestionRow[]
  maxTotal: number
}

export function ChatTopQuestionsList({ questions, maxTotal }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [page, setPage] = useState(0)
  const [filter, setFilter] = useState<Filter>('all')

  const missingTotal = useMemo(
    () => questions.filter((q) => q.missingProductSearchCount > 0).length,
    [questions]
  )

  const filtered = useMemo(() => {
    if (filter === 'missing') return questions.filter((q) => q.missingProductSearchCount > 0)
    return questions
  }, [questions, filter])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))

  const visible = useMemo(() => {
    if (!expanded) return filtered.slice(0, PAGE_SIZE)
    const start = page * PAGE_SIZE
    return filtered.slice(start, start + PAGE_SIZE)
  }, [filtered, expanded, page])

  const globalStartIndex = expanded ? page * PAGE_SIZE : 0

  const handleToggleExpand = () => {
    setExpanded((v) => !v)
    setPage(0)
  }

  const handleFilter = (next: Filter) => {
    setFilter(next)
    setPage(0)
    setExpanded(false)
  }

  if (questions.length === 0) {
    return <p className="text-sm text-muted">Még nincs naplózott kérdés.</p>
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => handleFilter('all')}
          className={`rounded-full border px-3 py-1 text-xs font-medium ${
            filter === 'all'
              ? 'border-accent bg-accent/15 text-foreground'
              : 'border-[var(--border)] text-muted hover:text-foreground'
          }`}
        >
          Összes ({questions.length})
        </button>
        <button
          type="button"
          onClick={() => handleFilter('missing')}
          className={`rounded-full border px-3 py-1 text-xs font-medium ${
            filter === 'missing'
              ? 'border-amber-500/60 bg-amber-500/15 text-amber-800 dark:text-amber-200'
              : 'border-[var(--border)] text-muted hover:text-foreground'
          }`}
        >
          Hiányzó termék keresve ({missingTotal})
        </button>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted">
          Nincs olyan beszélgetés, ahol a keresett termék hiánycikk lett volna.
        </p>
      ) : (
        <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted leading-tight">
          {expanded
            ? `Top ${filtered.length} kérdés (max. ${maxTotal}) – ${PAGE_SIZE} / oldal. Másold a kérdéseket az AI tanításához.`
            : `A ${Math.min(PAGE_SIZE, filtered.length)} leggyakoribb kérdés. Nyisd ki az összes megtekintéséhez (max. ${maxTotal}).`}
        </p>
        {filtered.length > PAGE_SIZE && (
          <button
            type="button"
            onClick={handleToggleExpand}
            className="shrink-0 text-sm font-medium text-accent hover:underline"
          >
            {expanded ? 'Csak a top 10' : `Összes megtekintése (${filtered.length})`}
          </button>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-left text-muted">
              <th className="py-2 pr-3 font-medium w-10">#</th>
              <th className="py-2 pr-3 font-medium">Kérdés</th>
              <th className="py-2 pr-3 font-medium">Jelölés</th>
              <th className="py-2 pr-3 font-medium w-20 text-right">Darab</th>
              <th className="py-2 font-medium w-36 text-right">Utoljára</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((q, i) => (
              <tr
                key={`${q.question}-${globalStartIndex + i}`}
                className="border-b border-[var(--border)] last:border-0"
              >
                <td className="py-2.5 pr-3 text-muted tabular-nums">{globalStartIndex + i + 1}</td>
                <td className="py-2.5 pr-3 text-foreground leading-snug">{q.question}</td>
                <td className="py-2.5 pr-3">
                  {q.missingProductSearchCount > 0 ? (
                    <span
                      className="inline-flex items-center rounded-full border border-amber-500/50 bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:text-amber-200"
                      title={`${q.missingProductSearchCount} alkalommal nem volt pontos találat`}
                    >
                      Hiányzó termék keresve
                    </span>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </td>
                <td className="py-2.5 pr-3 text-right font-medium tabular-nums">{q.count}</td>
                <td className="py-2.5 text-right text-muted whitespace-nowrap">
                  {formatDate(q.lastAskedAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {expanded && totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <p className="text-xs text-muted tabular-nums">
            {globalStartIndex + 1}–{Math.min(globalStartIndex + PAGE_SIZE, filtered.length)} /{' '}
            {filtered.length}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="px-3 py-1.5 text-sm rounded-lg border border-[var(--border)] text-foreground hover:bg-[var(--border)] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Előző 10
            </button>
            <span className="text-xs text-muted tabular-nums">
              {page + 1} / {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              className="px-3 py-1.5 text-sm rounded-lg border border-[var(--border)] text-foreground hover:bg-[var(--border)] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Következő 10
            </button>
          </div>
        </div>
      )}
        </>
      )}
    </div>
  )
}
