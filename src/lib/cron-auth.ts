import { NextResponse } from 'next/server'
import { secureCompare } from '@/lib/secure-compare'

/**
 * Cron végpontok auth – csak CRON_SECRET Bearer tokennel hívhatók.
 * Publikus hívás esetén azonnal 401, tranzakció/worker nem indul.
 */
export function assertCronAuthorized(request: Request): NextResponse | null {
  const secret = process.env.CRON_SECRET?.trim()
  if (!secret) {
    console.warn('[cron-auth] CRON_SECRET not configured – cron endpoints disabled')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const auth = request.headers.get('authorization')?.trim()
  if (!auth || !secureCompare(auth, `Bearer ${secret}`)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return null
}
