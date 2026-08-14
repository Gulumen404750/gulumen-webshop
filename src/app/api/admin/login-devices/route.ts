import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { isDbConfigured, prisma } from '@/lib/prisma'
import { fingerprintPrefix } from '@/lib/admin-login-fingerprint'

/**
 * GET /api/admin/login-devices
 * Ismert eszközök a beállítások UI-hoz. A teljes fingerprint hash nem megy ki, csak prefix.
 */
export async function GET() {
  const ok = await requireAdmin()
  if (!ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }

  const [devices, countries] = await Promise.all([
    prisma.adminLoginDevice.findMany({
      orderBy: { lastSeenAt: 'desc' },
      take: 25,
      select: {
        id: true,
        fingerprint: true,
        userAgent: true,
        lastCountry: true,
        lastIp: true,
        loginCount: true,
        firstSeenAt: true,
        lastSeenAt: true,
      },
    }),
    prisma.adminLoginCountry.findMany({
      orderBy: { lastSeenAt: 'desc' },
      take: 25,
      select: {
        countryCode: true,
        loginCount: true,
        firstSeenAt: true,
        lastSeenAt: true,
      },
    }),
  ])

  return NextResponse.json({
    devices: devices.map((d) => ({
      id: d.id,
      fingerprintPrefix: fingerprintPrefix(d.fingerprint),
      userAgent: d.userAgent,
      lastCountry: d.lastCountry,
      lastIp: d.lastIp,
      loginCount: d.loginCount,
      firstSeenAt: d.firstSeenAt,
      lastSeenAt: d.lastSeenAt,
    })),
    countries,
  })
}
