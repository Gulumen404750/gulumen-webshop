import { describe, expect, it } from 'vitest'
import {
  classifyAdminPath,
  decideCanonicalAdminAccess,
  getAdminUrlSlug,
  isAdminLoginPathname,
  isAdminSurfacePath,
  parseAdminPublicBaseCookie,
  parseAdminUrlSlug,
  publicAdminApiPath,
  publicAdminUiPath,
  safeAdminReturnPath,
} from './admin-url'

const SLUG = 'desk-a1b2c3d4'

describe('parseAdminUrlSlug', () => {
  it('accepts a random 8+ char slug', () => {
    expect(parseAdminUrlSlug(SLUG)).toBe(SLUG)
    expect(parseAdminUrlSlug(`/${SLUG}/`)).toBe(SLUG)
  })

  it('rejects short, reserved, or invalid values', () => {
    expect(parseAdminUrlSlug('')).toBeNull()
    expect(parseAdminUrlSlug('admin')).toBeNull()
    expect(parseAdminUrlSlug('dashboard')).toBeNull()
    expect(parseAdminUrlSlug('termekek')).toBeNull()
    expect(parseAdminUrlSlug('abc')).toBeNull()
    expect(parseAdminUrlSlug('ops')).toBeNull()
    expect(parseAdminUrlSlug('Hidden Admin')).toBeNull()
    expect(parseAdminUrlSlug('desk/a1b2')).toBeNull()
  })
})

describe('getAdminUrlSlug', () => {
  it('reads ADMIN_URL_SLUG from env', () => {
    expect(getAdminUrlSlug({ ADMIN_URL_SLUG: SLUG })).toBe(SLUG)
    expect(getAdminUrlSlug({ ADMIN_URL_SLUG: '' })).toBeNull()
    expect(getAdminUrlSlug({ ADMIN_URL_SLUG: 'admin' })).toBeNull()
  })
})

describe('classifyAdminPath', () => {
  it('maps canonical /admin when no slug is configured', () => {
    expect(classifyAdminPath('/admin/login', null)).toEqual({
      kind: 'ui',
      internalPath: '/admin/login',
      publicPath: '/admin/login',
      isCanonical: true,
      isLogin: true,
    })
    expect(classifyAdminPath('/api/admin/login', null)).toMatchObject({
      kind: 'api',
      isLogin: true,
      isCanonical: true,
    })
    expect(classifyAdminPath('/termekek', null).kind).toBe('none')
  })

  it('rewrites the hidden slug to internal /admin paths', () => {
    expect(classifyAdminPath(`/${SLUG}`, SLUG)).toEqual({
      kind: 'ui',
      internalPath: '/admin',
      publicPath: `/${SLUG}`,
      isCanonical: false,
      isLogin: false,
    })
    expect(classifyAdminPath(`/${SLUG}/login`, SLUG)).toMatchObject({
      kind: 'ui',
      internalPath: '/admin/login',
      isLogin: true,
      isCanonical: false,
    })
    expect(classifyAdminPath(`/${SLUG}/dashboard/orders`, SLUG)).toMatchObject({
      kind: 'ui',
      internalPath: '/admin/dashboard/orders',
    })
    expect(classifyAdminPath(`/api/${SLUG}/2fa/verify-login`, SLUG)).toMatchObject({
      kind: 'api',
      internalPath: '/api/admin/2fa/verify-login',
      isLogin: true,
    })
    expect(classifyAdminPath(`/api/${SLUG}/orders`, SLUG)).toMatchObject({
      kind: 'api',
      internalPath: '/api/admin/orders',
      isLogin: false,
    })
  })

  it('does not treat a prefix of the slug as admin', () => {
    expect(classifyAdminPath(`/${SLUG}x/login`, SLUG).kind).toBe('none')
    expect(classifyAdminPath(`/api/${SLUG}x/login`, SLUG).kind).toBe('none')
  })
})

describe('publicAdminUiPath / publicAdminApiPath', () => {
  it('keeps canonical paths when slug is unset', () => {
    expect(publicAdminUiPath('/admin/dashboard', null)).toBe('/admin/dashboard')
    expect(publicAdminApiPath('/api/admin/login', null)).toBe('/api/admin/login')
  })

  it('maps internal paths onto the hidden slug', () => {
    expect(publicAdminUiPath('/admin', SLUG)).toBe(`/${SLUG}`)
    expect(publicAdminUiPath('/admin/login', SLUG)).toBe(`/${SLUG}/login`)
    expect(publicAdminApiPath('/api/admin/login', SLUG)).toBe(`/api/${SLUG}/login`)
  })
})

describe('decideCanonicalAdminAccess', () => {
  const canonicalLogin = classifyAdminPath('/admin/login', SLUG)
  const canonicalApi = classifyAdminPath('/api/admin/login', SLUG)
  const hiddenLogin = classifyAdminPath(`/${SLUG}/login`, SLUG)

  it('hides canonical UI without a session', () => {
    expect(
      decideCanonicalAdminAccess(canonicalLogin, { slug: SLUG, hasSession: false, hasApiKey: false })
    ).toBe('hide')
  })

  it('redirects authenticated canonical UI to the hidden path', () => {
    expect(
      decideCanonicalAdminAccess(canonicalLogin, { slug: SLUG, hasSession: true, hasApiKey: false })
    ).toBe('redirect-public')
  })

  it('hides canonical API without session or machine key', () => {
    expect(
      decideCanonicalAdminAccess(canonicalApi, { slug: SLUG, hasSession: false, hasApiKey: false })
    ).toBe('hide')
  })

  it('allows canonical API with x-admin-key (sourcing capture)', () => {
    expect(
      decideCanonicalAdminAccess(canonicalApi, { slug: SLUG, hasSession: false, hasApiKey: true })
    ).toBe('allow')
  })

  it('allows the hidden slug path itself', () => {
    expect(
      decideCanonicalAdminAccess(hiddenLogin, { slug: SLUG, hasSession: false, hasApiKey: false })
    ).toBe('allow')
  })

  it('leaves /admin public when no slug is set', () => {
    const open = classifyAdminPath('/admin/login', null)
    expect(
      decideCanonicalAdminAccess(open, { slug: null, hasSession: false, hasApiKey: false })
    ).toBe('allow')
  })
})

describe('isAdminSurfacePath / isAdminLoginPathname', () => {
  it('covers hidden slug UI and API', () => {
    expect(isAdminSurfacePath(`/${SLUG}/dashboard`, SLUG)).toBe(true)
    expect(isAdminSurfacePath(`/api/${SLUG}/orders`, SLUG)).toBe(true)
    expect(isAdminSurfacePath('/termekek', SLUG)).toBe(false)
    expect(isAdminLoginPathname(`/${SLUG}/login`, SLUG)).toBe(true)
    expect(isAdminLoginPathname('/admin/login', null)).toBe(true)
    expect(isAdminLoginPathname(`/${SLUG}/login`, null)).toBe(true)
  })
})

describe('safeAdminReturnPath', () => {
  it('rejects open redirects and non-admin paths', () => {
    expect(safeAdminReturnPath('https://evil.example', SLUG)).toBe(`/${SLUG}/dashboard`)
    expect(safeAdminReturnPath('//evil.example', SLUG)).toBe(`/${SLUG}/dashboard`)
    expect(safeAdminReturnPath('/termekek', SLUG)).toBe(`/${SLUG}/dashboard`)
    expect(safeAdminReturnPath(`/${SLUG}/dashboard/orders`, SLUG)).toBe(`/${SLUG}/dashboard/orders`)
    expect(safeAdminReturnPath(`/${SLUG}/dashboard`, null)).toBe(`/${SLUG}/dashboard`)
    expect(safeAdminReturnPath('/admin/dashboard', SLUG)).toBe(`/${SLUG}/dashboard`)
    expect(safeAdminReturnPath('/admin/dashboard', null)).toBe('/admin/dashboard')
  })
})

describe('parseAdminPublicBaseCookie', () => {
  it('accepts /{slug} and rejects canonical /admin', () => {
    expect(parseAdminPublicBaseCookie(`/${SLUG}`)).toBe(`/${SLUG}`)
    expect(parseAdminPublicBaseCookie('/admin')).toBeNull()
    expect(parseAdminPublicBaseCookie('/termekek')).toBeNull()
  })
})
