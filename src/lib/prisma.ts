/**
 * Prisma client singleton. PROD-ban (DATABASE_URL megadva) használjuk, DEV-ban JSON fallback.
 * DB elérhetetlenség esetén az orders modul try/catch + JSON fallback-tal nem dob.
 */
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined }

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

/**
 * Csak azt nézi, hogy a DATABASE_URL env be van-e állítva. Nem teszteli a kapcsolatot.
 * A DB elérhetetlenség ellen a hívók try/catch-tal és fallback-kel (pl. JSON) védik magukat.
 */
export function isDbConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL.trim() !== '')
}

const CONNECTIVITY_CACHE_MS = 60_000
let connectivityCache: { ok: boolean; at: number } | null = null

/**
 * Egyszerű DB elérhetőség ellenőrzés (pl. health check). Cache ~60 mp.
 * Használat: health API, vagy manuális teszt. A normál olvasás/írás try/catch-tal védett.
 */
export async function checkDbConnectivity(): Promise<boolean> {
  if (!isDbConfigured()) return false
  const now = Date.now()
  if (connectivityCache && now - connectivityCache.at < CONNECTIVITY_CACHE_MS) {
    return connectivityCache.ok
  }
  try {
    await prisma.$queryRaw`SELECT 1`
    connectivityCache = { ok: true, at: now }
    return true
  } catch {
    connectivityCache = { ok: false, at: now }
    return false
  }
}
