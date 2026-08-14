import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { isDbConfigured } from '@/lib/prisma'
import { CallbackPendingList } from './CallbackPendingList'
import { AdminLogoutButton } from '@/components/admin/AdminLogoutButton'

function startOfToday(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

function endReasonIcon(reason: string | null): { icon: string; title: string } {
  if (!reason) return { icon: '', title: '' }
  const map: Record<string, { icon: string; title: string }> = {
    silence_timeout: { icon: '🔇', title: 'Csend timeout (bontva)' },
    non_responsive: { icon: '❌', title: 'Nem válaszolt 2× (bontva)' },
    max_duration_guard: { icon: '⏱️', title: 'Max hossz (8 min, bontva)' },
    normal: { icon: '✓', title: 'Normál befejezés' },
  }
  return map[reason] ?? { icon: '•', title: reason }
}

export default async function AdminCallsDashboardPage() {
  if (!isDbConfigured()) {
    return (
      <div className="min-h-screen bg-[var(--card-bg)] p-6">
        <p className="text-muted">Adatbázis nincs konfigurálva.</p>
      </div>
    )
  }

  const todayStart = startOfToday()

  const [todayCalls, callbackPending, recentCalls] = await Promise.all([
    prisma.call.findMany({
      where: { timestamp: { gte: todayStart } },
      orderBy: { timestamp: 'desc' },
    }),
    prisma.callbackRequest.findMany({
      where: { status: 'pending' },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
    prisma.call.findMany({
      orderBy: { timestamp: 'desc' },
      take: 100,
    }),
  ])

  const tagCounts: Record<string, number> = {}
  for (const c of recentCalls) {
    for (const tag of c.tags) {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1
    }
  }
  const topTags = Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)

  return (
    <div className="min-h-screen bg-[var(--card-bg)] text-foreground p-6">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-heading font-bold">Hívások dashboard</h1>
          <AdminLogoutButton className="text-sm text-muted hover:text-foreground" />
        </div>

        <section className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-[var(--border)] bg-background p-4">
            <h2 className="text-sm font-medium text-muted mb-1">Mai hívások</h2>
            <p className="text-2xl font-semibold">{todayCalls.length}</p>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-background p-4">
            <h2 className="text-sm font-medium text-muted mb-1">Visszahívás függőben</h2>
            <p className="text-2xl font-semibold">{callbackPending.length}</p>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-background p-4">
            <h2 className="text-sm font-medium text-muted mb-1">Top címkék (utóbbi 100 hívás)</h2>
            <p className="text-sm text-muted">{topTags.length ? topTags.map(([t]) => t).join(', ') : '–'}</p>
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">Mai hívások</h2>
          {todayCalls.length === 0 ? (
            <p className="text-muted text-sm">Ma még nem volt hívás.</p>
          ) : (
            <ul className="space-y-2">
              {todayCalls.map((c) => {
                const reason = endReasonIcon(c.endReason)
                return (
                  <li
                    key={c.id}
                    className="rounded-lg border border-[var(--border)] p-3 text-sm"
                  >
                    {reason.icon && (
                      <span title={reason.title} className="mr-1">{reason.icon}</span>
                    )}
                    <span className="font-mono text-muted">{c.callId}</span>
                    <span className="mx-2">·</span>
                    <span>{new Date(c.timestamp).toLocaleString('hu-HU')}</span>
                    {c.durationSec != null && (
                      <span className="ml-2 text-muted">({c.durationSec}s)</span>
                    )}
                    <span className="mx-2">·</span>
                    <span>{c.language}</span>
                    <span className="mx-2">·</span>
                    <span>{c.mode}</span>
                    {c.callerNumber && (
                      <>
                        <span className="mx-2">·</span>
                        <span>{c.callerNumber}</span>
                      </>
                    )}
                    {c.tags.length > 0 && (
                      <span className="ml-2 text-muted">[{c.tags.join(', ')}]</span>
                    )}
                    {c.summary && (
                      <p className="mt-1 text-muted truncate max-w-xl">{c.summary}</p>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">Visszahívás kérések (pending)</h2>
          <CallbackPendingList
            items={callbackPending.map((r) => ({
              id: r.id,
              name: r.name,
              phone: r.phone,
              topic: r.topic,
              preferredTime: r.preferredTime,
              createdAt: r.createdAt.toISOString(),
              emailSent: r.emailSent,
              webhookSent: r.webhookSent,
              deliveryStatus: r.deliveryStatus,
              note: r.note,
            }))}
          />
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">Top témák (címkék)</h2>
          {topTags.length === 0 ? (
            <p className="text-muted text-sm">Még nincs adat.</p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {topTags.map(([tag, count]) => (
                <li
                  key={tag}
                  className="rounded-full bg-[var(--border)] px-3 py-1 text-sm"
                >
                  {tag} <span className="text-muted">×{count}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <p className="text-sm text-muted">
          <Link href="/" className="text-accent hover:underline">
            ← Vissza a főoldalra
          </Link>
        </p>
      </div>
    </div>
  )
}
