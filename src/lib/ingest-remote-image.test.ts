import { describe, expect, it, vi } from 'vitest'
import {
  assertSafeRemoteImageUrl,
  ingestedImageFilename,
  ingestRemoteImageUrl,
  isBlockedHostname,
  isBlockedIpAddress,
  parseRemoteImageUrl,
  RemoteImageIngestError,
  shouldIngestRemoteImageUrl,
} from './ingest-remote-image'

describe('shouldIngestRemoteImageUrl', () => {
  it('skips local paths, data URLs and own CDN', () => {
    expect(shouldIngestRemoteImageUrl('/uploads/a.webp')).toBe(false)
    expect(shouldIngestRemoteImageUrl('/img/rolltop.png')).toBe(false)
    expect(shouldIngestRemoteImageUrl('data:image/png;base64,aaa')).toBe(false)
    expect(shouldIngestRemoteImageUrl('https://gulumen.b-cdn.net/products/a.webp')).toBe(false)
    expect(shouldIngestRemoteImageUrl('https://www.gulumen.com/uploads/a.webp')).toBe(false)
  })

  it('flags external https hotlinks', () => {
    expect(shouldIngestRemoteImageUrl('https://cdn.supplier.example/foto.jpg')).toBe(true)
    expect(shouldIngestRemoteImageUrl('https://i.imgur.com/abc.png')).toBe(true)
  })
})

describe('SSRF guards', () => {
  it('blocks private and metadata IPs', () => {
    expect(isBlockedIpAddress('127.0.0.1')).toBe(true)
    expect(isBlockedIpAddress('10.0.0.8')).toBe(true)
    expect(isBlockedIpAddress('192.168.1.10')).toBe(true)
    expect(isBlockedIpAddress('172.16.0.1')).toBe(true)
    expect(isBlockedIpAddress('169.254.169.254')).toBe(true)
    expect(isBlockedIpAddress('::1')).toBe(true)
    expect(isBlockedIpAddress('8.8.8.8')).toBe(false)
  })

  it('blocks localhost hostnames and odd ports', () => {
    expect(isBlockedHostname('localhost')).toBe(true)
    expect(isBlockedHostname('metadata.google.internal')).toBe(true)
    expect(() => parseRemoteImageUrl('https://example.com:8443/a.jpg')).toThrow(RemoteImageIngestError)
    expect(() => parseRemoteImageUrl('file:///etc/passwd')).toThrow(RemoteImageIngestError)
  })

  it('rejects DNS that resolves to a private IP', async () => {
    await expect(
      assertSafeRemoteImageUrl('https://evil.example/a.jpg', async () => ['127.0.0.1'])
    ).rejects.toMatchObject({ code: 'ssrf' })
  })

  it('allows public DNS results', async () => {
    const url = await assertSafeRemoteImageUrl('https://cdn.example/a.jpg', async () => ['93.184.216.34'])
    expect(url.hostname).toBe('cdn.example')
  })
})

describe('ingestRemoteImageUrl', () => {
  it('uses slug + source hash for the WebP filename', () => {
    const name = ingestedImageFilename('https://cdn.example/foto.jpg', 'Rolltop Fekete')
    expect(name.startsWith('rolltop-fekete-')).toBe(true)
    expect(name.endsWith('.webp')).toBe(true)
  })

  it('downloads, optimizes and persists a remote image', async () => {
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64'
    )
    const persist = vi.fn(async () => ({
      url: 'https://gulumen.b-cdn.net/products/x.webp',
      storage: 'bunny' as const,
    }))
    const fetchFn = vi.fn(async () => {
      return new Response(png, {
        status: 200,
        headers: { 'Content-Type': 'image/png' },
      })
    }) as unknown as typeof fetch

    const url = await ingestRemoteImageUrl(
      'https://cdn.example/foto.png',
      { slug: 'rolltop' },
      {
        lookup: async () => ['93.184.216.34'],
        fetchFn,
        persist,
      }
    )

    expect(url).toBe('https://gulumen.b-cdn.net/products/x.webp')
    expect(persist).toHaveBeenCalledTimes(1)
    const [filename, body] = persist.mock.calls[0] as unknown as [string, Buffer]
    expect(filename).toMatch(/^rolltop-[a-f0-9]+\.webp$/)
    expect(body.length).toBeGreaterThan(0)
  })

  it('follows a redirect only to another safe URL', async () => {
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64'
    )
    const fetchFn = vi.fn(async (input: RequestInfo | URL) => {
      const href = String(input)
      if (href.includes('start')) {
        return new Response(null, {
          status: 302,
          headers: { Location: 'https://cdn.example/final.png' },
        })
      }
      return new Response(png, { status: 200, headers: { 'Content-Type': 'image/png' } })
    }) as unknown as typeof fetch

    const persist = vi.fn(async () => ({
      url: 'https://gulumen.b-cdn.net/products/final.webp',
      storage: 'bunny' as const,
    }))

    const url = await ingestRemoteImageUrl(
      'https://cdn.example/start.png',
      { slug: 'p' },
      {
        lookup: async () => ['93.184.216.34'],
        fetchFn,
        persist,
      }
    )
    expect(url).toContain('gulumen.b-cdn.net')
    expect(fetchFn).toHaveBeenCalledTimes(2)
  })

  it('refuses redirect to localhost', async () => {
    const fetchFn = vi.fn(async () => {
      return new Response(null, {
        status: 302,
        headers: { Location: 'http://127.0.0.1/secret.png' },
      })
    }) as unknown as typeof fetch

    await expect(
      ingestRemoteImageUrl(
        'https://cdn.example/start.png',
        { slug: 'p' },
        {
          lookup: async () => ['93.184.216.34'],
          fetchFn,
        }
      )
    ).rejects.toMatchObject({ code: 'ssrf' })
  })
})
