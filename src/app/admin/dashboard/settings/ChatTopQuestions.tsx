import { getTopChatQuestions, TOP_CHAT_QUESTIONS_MAX } from '@/lib/chat-log'
import { isDbConfigured } from '@/lib/prisma'
import { ChatTopQuestionsList } from './ChatTopQuestionsList'

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

  const questions = await getTopChatQuestions(TOP_CHAT_QUESTIONS_MAX)

  return (
    <section className="rounded-xl border border-[var(--border)] bg-background p-4">
      <h2 className="font-heading font-semibold text-foreground mb-1">Leggyakoribb kérdések</h2>
      <p className="text-sm text-muted mb-4 leading-tight">
        Az utolsó chat üzenetek összesítése (anonim). Alapból a top 10 látszik; kinyitva a teljes
        lista (legfeljebb {TOP_CHAT_QUESTIONS_MAX}) lapozható 10-esével – ezek alapján taníthatod az
        AI-t a válaszokra.
      </p>

      <ChatTopQuestionsList
        maxTotal={TOP_CHAT_QUESTIONS_MAX}
        questions={questions.map((q) => ({
          question: q.question,
          count: q.count,
          lastAskedAt: q.lastAskedAt.toISOString(),
        }))}
      />
    </section>
  )
}
