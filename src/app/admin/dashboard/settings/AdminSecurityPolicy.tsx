'use client'

/**
 * Üzemeltetői összefoglaló a belső szabályzathoz.
 * A teljes szöveg: docs/ADMIN-BIZTONSAGI-SZABALYZAT.md
 */
export default function AdminSecurityPolicy() {
  return (
    <section className="rounded-xl border border-[var(--border)] bg-background p-4 space-y-3">
      <div>
        <h2 className="text-lg font-semibold">Admin biztonsági szabályzat</h2>
        <p className="text-sm text-muted mt-1">
          Belső üzemeltetési irányelv. A teljes dokumentum a kódbázisban:{' '}
          <code className="rounded bg-[var(--border)] px-1">docs/ADMIN-BIZTONSAGI-SZABALYZAT.md</code>
          {' '}· nyilvános bejelentés:{' '}
          <code className="rounded bg-[var(--border)] px-1">SECURITY.md</code>
        </p>
      </div>
      <ul className="text-sm list-disc pl-5 space-y-1.5 text-foreground">
        <li>
          Az <code>ADMIN_API_KEY</code> nem kerülhet gitbe, chatbe, screenshotba. Éles kulcs ≠ fejlesztői kulcs.
        </li>
        <li>Élesben a Google Authenticator 2FA kötelező (lentebb párosítható).</li>
        <li>
          Élesben az <code>ADMIN_ALLOWED_IPS</code> ki van töltve (iroda/VPN). Üres lista productionben = 403 (lockout); dev-ben nyitva marad.
        </li>
        <li>
          Kulcs- vagy <code>JWT_SECRET</code>-csere kilépteti a sessionöket. Szivárgásnál mindkettőt cseréld.
        </li>
        <li>
          Rendelés-export és vásárlói adatok csak admin gépen maradnak. Tömeges ár / törlés ellenőrzés után.
        </li>
      </ul>
    </section>
  )
}
