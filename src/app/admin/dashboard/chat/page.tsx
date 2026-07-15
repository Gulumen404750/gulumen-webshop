import ChatSettingsForm from '../settings/ChatSettingsForm'

export default function AdminChatPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-heading font-bold text-foreground">Chat / AI beállítások</h1>
      <p className="text-muted text-sm">
        System prompt, nyelvi fallback szövegek, rate limit és OpenAI modell. A chat API a{' '}
        <code className="rounded bg-[var(--border)] px-1">Setting</code> táblából olvassa; mentés
        nélkül az eredeti hardcoded alapértékek érvényesek.
      </p>
      <ChatSettingsForm />
    </div>
  )
}
