import { NextResponse } from 'next/server'
import { prisma, isDbConfigured } from '@/lib/prisma'

/** Railway health check – Prisma DB ping; 503 ha a DB nem elérhető. */
export async function GET() {
  if (!isDbConfigured()) {
    return NextResponse.json({ status: 'degraded', db: false }, { status: 503 })
  }

  try {
    await prisma.$queryRaw`SELECT 1`
    return NextResponse.json({ status: 'ok', db: true })
  } catch {
    return NextResponse.json({ status: 'degraded', db: false }, { status: 503 })
  }
}
