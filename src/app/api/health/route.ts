import { NextResponse } from 'next/server'

/** Railway health check – gyors 200, DB nélkül. */
export async function GET() {
  return NextResponse.json({ ok: true, service: 'gulumen-webshop' })
}
