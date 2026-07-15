import { getTopChatQuestions } from '@/lib/chat-log'
import { isDbConfigured } from '@/lib/prisma'

function formatDate(d: Date): string {
  return d.toLocaleString('hu-HU', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export async function ChatTopQuestions() {
  if (!isDbConfigured()) {
    return (
      <section className="rounded-xl border border-[var(--border)] bg-background p-4">
        <h2 className="font-heading font-semibold text-foreground mb-2">Leggyakoribb kérdések</h2>
        <p className="text-sm text-muted">
          Adatbázis nincs konfigurálva – a kérdésnapló nem érhető el.
        </p>
      </section>
    )
  }

  const questions = await getTopChatQuestions(20)

  return (
    <section className="rounded-xl border border-[var(--border)] bg-background p-4">
      <h2 className="font-heading font-semibold text-foreground mb-1">Leggyakoribb kérdések</h2>
      <p className="text-sm text-muted mb-4">
        Az utolsó chat üzenetek összesítése (anonim, IP hash alapján). Maximum 20 tétel.
      </p>

      {questions.length === 0 ? (
        <p className="text-sm text-muted">Még nincs naplózott kérdés.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-left text-muted">
                <th className="py-2 pr-3 font-medium w-8">#</th>
                <th className="py-2 pr-3 font-medium">Kérdés</th>
                <th className="py-2 pr-3 font-medium w-20 text-right">Darab</th>
                <th className="py-2 font-medium w-36 text-right">Utoljára</th>
              </tr>
            </thead>
            <tbody>
              {questions.map((q, i) => (
                <tr key={`${q.question}-${i}`} className="border-b border-[var(--border)] last:border-0">
                  <td className="py-2.5 pr-3 text-muted tabular-nums">{i + 1}</td>
                  <td className="py-2.5 pr-3 text-foreground">{q.question}</td>
                  <td className="py-2.5 pr-3 text-right font-medium tabular-nums">{q.count}</td>
                  <td className="py-2.5 text-right text-muted whitespace-nowrap">
                    {formatDate(q.lastAskedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
