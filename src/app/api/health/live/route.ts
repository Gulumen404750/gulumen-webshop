import { NextResponse } from 'next/server'

/** Ne cache-elje / ne prerenderelje – Railway liveness mindig a futó processztől jöjjön. */
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/health/live – liveness.
 * Csak azt jelzi, hogy a Node.js process fut. DB/Redis NEM kell.
 * Railway healthcheckPath: /api/health/live
 */
export async function GET() {
  return NextResponse.json({ status: 'live', ts: Date.now() })
}
