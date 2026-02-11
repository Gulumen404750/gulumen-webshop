import Link from 'next/link'

export default function RegistrationPage() {
  return (
    <div className="max-w-md mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="font-heading text-2xl font-bold text-foreground mb-6">Regisztráció</h1>
      <p className="text-muted mb-6">
        Regisztrálj, és az első vásárláshoz kuponkódot kapsz. E-mailben értesítünk az akciókról és újdonságokról.
      </p>
      <form className="space-y-4">
        <input
          type="email"
          placeholder="E-mail"
          className="w-full px-4 py-2 rounded-lg border border-[var(--border)] bg-background text-foreground"
        />
        <input
          type="password"
          placeholder="Jelszó"
          className="w-full px-4 py-2 rounded-lg border border-[var(--border)] bg-background text-foreground"
        />
        <button
          type="submit"
          className="w-full py-3 bg-accent text-white font-heading font-semibold rounded-lg hover:opacity-90"
        >
          Regisztráció
        </button>
      </form>
      <p className="mt-4 text-sm text-muted">
        Már van fiókod? <Link href="/profil" className="text-accent hover:underline">Bejelentkezés</Link>
      </p>
    </div>
  )
}
