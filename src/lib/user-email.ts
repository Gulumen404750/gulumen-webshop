import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

/** E-mail normalizálás: trim + kisbetű. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

/** Felhasználó keresése e-mail alapján (kis/nagybetű független). */
export async function findUserByEmail(email: string) {
  const emailNorm = normalizeEmail(email)
  if (!emailNorm) return null

  const exact = await prisma.user.findUnique({ where: { email: emailNorm } })
  if (exact) return exact

  // Régi soroknál előfordulhat vegyes kis/nagybetűs e-mail.
  return prisma.user.findFirst({
    where: { email: { equals: emailNorm, mode: 'insensitive' } },
  })
}

export function isUniqueEmailConstraintError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002' &&
    Array.isArray(error.meta?.target) &&
    (error.meta.target as string[]).includes('email')
  )
}
