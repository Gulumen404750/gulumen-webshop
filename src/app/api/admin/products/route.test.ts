import { beforeEach, describe, expect, it, vi } from 'vitest'

const requireAdminPermission = vi.fn()
const isDbConfigured = vi.fn()
const findUnique = vi.fn()
const create = vi.fn()
const logAdminAction = vi.fn()
const ingestRemoteImageUrl = vi.fn()

vi.mock('@/lib/admin-auth', () => ({
  requireAdminPermission: (...args: unknown[]) => requireAdminPermission(...args),
}))

vi.mock('@/lib/prisma', () => ({
  isDbConfigured: () => isDbConfigured(),
  prisma: {
    product: {
      findUnique: (...args: unknown[]) => findUnique(...args),
      create: (...args: unknown[]) => create(...args),
    },
  },
}))

vi.mock('@/lib/admin-audit', () => ({
  logAdminAction: (...args: unknown[]) => logAdminAction(...args),
}))

vi.mock('@/lib/revalidate-shop', () => ({
  revalidateShopProducts: vi.fn(),
}))

vi.mock('@/lib/ingest-remote-image', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/ingest-remote-image')>()
  return {
    ...actual,
    ingestRemoteImageUrl: (...args: unknown[]) => ingestRemoteImageUrl(...args),
  }
})

describe('POST /api/admin/products image ingest', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requireAdminPermission.mockResolvedValue({
      ok: true,
      actor: { id: 'admin', username: 'admin', role: 'owner', bootstrap: true },
    })
    isDbConfigured.mockReturnValue(true)
    findUnique.mockResolvedValue(null)
    logAdminAction.mockResolvedValue(undefined)
    create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: 'new-id',
      ...data,
    }))
    ingestRemoteImageUrl.mockImplementation(async (url: string) => {
      return `https://gulumen.b-cdn.net/products/ingested-${url.split('/').pop()?.replace(/\W+/g, '')}.webp`
    })
  })

  it('stores Bunny CDN URLs instead of the pasted hotlink', async () => {
    const { POST } = await import('@/app/api/admin/products/route')
    const res = await POST(
      new Request('http://localhost/api/admin/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: 'rolltop-teszt',
          name: 'Rolltop teszt',
          category: 'hatizsak',
          priceHuf: 12000,
          priceEur: 30,
          image: 'https://cdn.supplier.example/main.jpg',
          images: ['https://cdn.supplier.example/main.jpg', 'https://cdn.supplier.example/side.jpg'],
        }),
      })
    )
    expect(res.status).toBe(200)
    expect(ingestRemoteImageUrl).toHaveBeenCalled()
    const payload = create.mock.calls[0][0] as { data: { image: string; images: string[] } }
    expect(payload.data.image).toMatch(/^https:\/\/gulumen\.b-cdn\.net\//)
    expect(payload.data.images.every((u) => u.startsWith('https://gulumen.b-cdn.net/'))).toBe(true)
    expect(payload.data.image).not.toContain('supplier.example')
  })

  it('returns 400 and does not create the product when ingest fails', async () => {
    const { RemoteImageIngestError } = await import('@/lib/ingest-remote-image')
    ingestRemoteImageUrl.mockRejectedValue(
      new RemoteImageIngestError('A kép nem tölthető le', 'fetch', 'https://cdn.supplier.example/main.jpg')
    )
    const { POST } = await import('@/app/api/admin/products/route')
    const res = await POST(
      new Request('http://localhost/api/admin/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: 'rolltop-teszt',
          name: 'Rolltop teszt',
          category: 'hatizsak',
          priceHuf: 12000,
          priceEur: 30,
          image: 'https://cdn.supplier.example/main.jpg',
        }),
      })
    )
    expect(res.status).toBe(400)
    expect(create).not.toHaveBeenCalled()
    const body = await res.json()
    expect(body.error).toMatch(/nem tölthető le/i)
  })
})
