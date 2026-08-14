import DealPopupSettings from './DealPopupSettings'
import TwoFactorSettings from './TwoFactorSettings'
import PasswordSettings from './PasswordSettings'

export default function AdminSettingsPage() {
  const envStatus = [
    { key: 'DATABASE_URL', label: 'Adatbázis', value: process.env.DATABASE_URL ? '✓ beállítva' : '– nincs' },
    { key: 'STRIPE_SECRET_KEY', label: 'Stripe', value: process.env.STRIPE_SECRET_KEY ? '✓ beállítva' : '– nincs' },
    { key: 'ADMIN_API_KEY', label: 'Admin kulcs', value: process.env.ADMIN_API_KEY ? '✓ beállítva' : '– nincs' },
    { key: 'ADMIN_EMAIL', label: 'Admin e-mail (jelszó-reset)', value: process.env.ADMIN_EMAIL ? '✓ beállítva' : '– nincs' },
    { key: 'RESEND_API_KEY', label: 'Resend', value: process.env.RESEND_API_KEY ? '✓ beállítva' : '– nincs' },
    { key: 'NEXT_PUBLIC_APP_URL', label: 'App URL', value: process.env.NEXT_PUBLIC_APP_URL || '–' },
  ]

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-heading font-bold text-foreground">Beállítások</h1>
      <section>
        <h2 className="text-lg font-semibold mb-2">Környezet állapot</h2>
        <p className="text-sm text-muted mb-4">Titkos kulcsok nincsenek nyersen kijelezve.</p>
        <ul className="space-y-2">
          {envStatus.map((e) => (
            <li key={e.key} className="flex items-center gap-4 rounded-lg border border-[var(--border)] px-4 py-2">
              <span className="font-medium w-48">{e.label}</span>
              <span className="text-muted">{e.value}</span>
            </li>
          ))}
        </ul>
      </section>
      <PasswordSettings />
      <TwoFactorSettings />
      <DealPopupSettings />
      <p className="text-sm text-muted">
        Webshop alapadatok, email, support, szállítási infó és feature flag-ek a <code className="rounded bg-[var(--border)] px-1">Setting</code> táblából
        szerkeszthetők lesznek (következő iteráció).
      </p>
    </div>
  )
}
