export default function AdminChatPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-heading font-bold text-foreground">Chat / AI beállítások</h1>
      <p className="text-muted">
        A chatbot admin (system prompt, fallback, rate limit) a <code className="rounded bg-[var(--border)] px-1">Setting</code> modell
        alapján készül. Hamarosan elérhető szerkesztő űrlap.
      </p>
    </div>
  )
}
