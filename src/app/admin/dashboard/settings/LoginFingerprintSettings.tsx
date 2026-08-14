'use client'

import { useCallback, useEffect, useState } from 'react'

type DeviceRow = {
  id: string
  fingerprintPrefix: string
  userAgent: string | null
  lastCountry: string | null
  lastIp: string | null
  loginCount: number
  firstSeenAt: string
  lastSeenAt: string
}

type CountryRow = {
  countryCode: string
  loginCount: number
  lastSeenAt: string
}

function formatWhen(value: string) {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleString('hu-HU')
}

export default function LoginFingerprintSettings() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [devices, setDevices] = useState<DeviceRow[]>([])
  const [countries, setCountries] = useState<CountryRow[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/login-devices', { credentials: 'include' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || 'A lista betöltése sikertelen.')
      }
      setDevices(Array.isArray(data.devices) ? data.devices : [])
      setCountries(Array.isArray(data.countries) ? data.countries : [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ismeretlen hiba')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <section className="rounded-xl border border-[var(--border)] bg-background p-4 space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Eszköz / geo riasztás</h2>
        <p className="text-sm text-muted mt-1">
          Sikeres belépéskor rögzítjük a böngésző ujjlenyomatát és a CDN országkódját. Új eszköz vagy
          szokatlan ország esetén e-mail megy az <code>ADMIN_EMAIL</code> címre. Az első belépés a
          baseline, arra nincs riasztás.
        </p>
      </div>

      {loading && <p className="text-sm text-muted">Betöltés…</p>}
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {!loading && !error && (
        <>
          <div>
            <h3 className="text-sm font-semibold mb-2">Ismert eszközök</h3>
            {devices.length === 0 ? (
              <p className="text-sm text-muted">Még nincs rögzített belépés.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {devices.map((d) => (
                  <li
                    key={d.id}
                    className="rounded-lg border border-[var(--border)] px-3 py-2 space-y-0.5"
                  >
                    <p className="font-mono text-xs text-muted">{d.fingerprintPrefix}…</p>
                    <p className="break-all">{d.userAgent || 'User-Agent nélkül'}</p>
                    <p className="text-muted">
                      {d.lastCountry || 'ország ismeretlen'} · {d.lastIp || 'IP ismeretlen'} ·{' '}
                      {d.loginCount} belépés · utoljára {formatWhen(d.lastSeenAt)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <h3 className="text-sm font-semibold mb-2">Látott országok</h3>
            {countries.length === 0 ? (
              <p className="text-sm text-muted">
                Nincs geo header (helyi / proxy nélkül csak az eszköz-riasztás él).
              </p>
            ) : (
              <ul className="flex flex-wrap gap-2 text-sm">
                {countries.map((c) => (
                  <li
                    key={c.countryCode}
                    className="rounded-lg border border-[var(--border)] px-3 py-1"
                    title={`utoljára ${formatWhen(c.lastSeenAt)}`}
                  >
                    {c.countryCode} × {c.loginCount}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </section>
  )
}
