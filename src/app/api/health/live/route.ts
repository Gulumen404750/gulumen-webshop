import { NextResponse } from 'next/server'

/**
 * GET /api/health/live – liveness.
 * Csak azt jelzi, hogy a Node.js process fut. DB/Redis NEM kell.
 * Railway healthcheckPath: /api/health/live
 */
export async function GET() {
  return NextResponse.json({ status: 'live', ts: Date.now() })
}
