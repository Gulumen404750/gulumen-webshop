import { describe, expect, it } from 'vitest'
import {
  buildAdminLoginAlertSubject,
  collectAdminDeviceMaterial,
  decideAdminLoginAlerts,
  extractAdminLoginSignals,
  hashAdminDeviceFingerprint,
  shouldAlertAdminLogin,
} from './admin-login-fingerprint'

function requestWith(headers: Record<string, string>) {
  return new Request('http://localhost/api/admin/login', { headers })
}

describe('admin device fingerprint', () => {
  it('is stable for the same UA, language and client hints', () => {
    const a = extractAdminLoginSignals(
      requestWith({
        'user-agent': 'Mozilla/5.0 Chrome/120',
        'accept-language': 'hu-HU,hu;q=0.9',
        'sec-ch-ua-platform': '"Windows"',
      })
    )
    const b = extractAdminLoginSignals(
      requestWith({
        'user-agent': 'Mozilla/5.0 Chrome/120',
        'accept-language': 'hu-HU,hu;q=0.9',
        'sec-ch-ua-platform': '"Windows"',
      })
    )
    expect(a.fingerprint).toBe(b.fingerprint)
    expect(a.fingerprint).toMatch(/^[a-f0-9]{64}$/)
    expect(a.fingerprint).toBe(
      hashAdminDeviceFingerprint(collectAdminDeviceMaterial(requestWith({
        'user-agent': 'Mozilla/5.0 Chrome/120',
        'accept-language': 'hu-HU,hu;q=0.9',
        'sec-ch-ua-platform': '"Windows"',
      })))
    )
  })

  it('changes when the browser or language changes', () => {
    const chrome = extractAdminLoginSignals(requestWith({ 'user-agent': 'Chrome' }))
    const firefox = extractAdminLoginSignals(requestWith({ 'user-agent': 'Firefox' }))
    const hu = extractAdminLoginSignals(
      requestWith({ 'user-agent': 'Chrome', 'accept-language': 'hu' })
    )
    expect(chrome.fingerprint).not.toBe(firefox.fingerprint)
    expect(chrome.fingerprint).not.toBe(hu.fingerprint)
  })

  it('reads country and IP from request headers', () => {
    const signals = extractAdminLoginSignals(
      requestWith({
        'user-agent': 'Vitest',
        'cf-ipcountry': 'de',
        'x-forwarded-for': '198.51.100.10',
      })
    )
    expect(signals.countryCode).toBe('DE')
    expect(signals.ip).toBe('198.51.100.10')
    expect(signals.userAgent).toBe('Vitest')
  })
})

describe('decideAdminLoginAlerts', () => {
  it('does not alert on the first device and first country (baseline)', () => {
    expect(
      decideAdminLoginAlerts({
        existingDeviceCount: 0,
        existingCountryCount: 0,
        deviceKnown: false,
        countryKnown: false,
        countryCode: 'HU',
      })
    ).toEqual({ newDevice: false, unusualCountry: false })
  })

  it('alerts on a new device after one is already known', () => {
    const decision = decideAdminLoginAlerts({
      existingDeviceCount: 1,
      existingCountryCount: 1,
      deviceKnown: false,
      countryKnown: true,
      countryCode: 'HU',
    })
    expect(decision).toEqual({ newDevice: true, unusualCountry: false })
    expect(shouldAlertAdminLogin(decision)).toBe(true)
  })

  it('alerts on an unusual country after one is already known', () => {
    const decision = decideAdminLoginAlerts({
      existingDeviceCount: 1,
      existingCountryCount: 1,
      deviceKnown: true,
      countryKnown: false,
      countryCode: 'RU',
    })
    expect(decision).toEqual({ newDevice: false, unusualCountry: true })
    expect(buildAdminLoginAlertSubject(decision)).toContain('szokatlan ország')
  })

  it('does not treat a missing country header as unusual', () => {
    expect(
      decideAdminLoginAlerts({
        existingDeviceCount: 2,
        existingCountryCount: 1,
        deviceKnown: true,
        countryKnown: false,
        countryCode: null,
      })
    ).toEqual({ newDevice: false, unusualCountry: false })
  })
})
