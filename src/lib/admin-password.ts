/**
 * Admin fiók jelszó: bcrypt hash, házirend, singleton Admin.passwordHash.
 * Az API kulcs továbbra is vészhelyzeti belépés (env); a jelszó DB-ben él, resetelhető.
 */

import bcrypt from 'bcryptjs'
import { prisma, isDbConfigured } from '@/lib/prisma'
import { ADMIN_RECORD_ID } from '@/lib/admin-session-constants'

export const ADMIN_PASSWORD_MIN_LENGTH = 12
export const ADMIN_PASSWORD_MAX_LENGTH = 128
export const ADMIN_PASSWORD_BCRYPT_ROUNDS = 12

export type AdminPasswordValidation = { ok: true } | { ok: false; error: string }

export function validateAdminPassword(password: string): AdminPasswordValidation {
  if (typeof password !== 'string' || password.length < ADMIN_PASSWORD_MIN_LENGTH) {
    return { ok: false, error: 'A jelszó legalább 12 karakter legyen.' }
  }
  if (password.length > ADMIN_PASSWORD_MAX_LENGTH) {
    return { ok: false, error: 'A jelszó legfeljebb 128 karakter lehet.' }
  }
  if (/\s/.test(password)) {
    return { ok: false, error: 'A jelszó ne tartalmazzon szóközt.' }
  }
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return { ok: false, error: 'A jelszó tartalmazzon betűt és számot is.' }
  }
  return { ok: true }
}

export async function hashAdminPassword(password: string): Promise<string> {
  return bcrypt.hash(password, ADMIN_PASSWORD_BCRYPT_ROUNDS)
}

export async function verifyAdminPassword(password: string, passwordHash: string): Promise<boolean> {
  if (!password || !passwordHash) return false
  try {
    return await bcrypt.compare(password, passwordHash)
  } catch {
    return false
  }
}

export type AdminPasswordState = {
  passwordHash: string | null
  passwordSetAt: Date | null
}

export async function getAdminPasswordState(): Promise<AdminPasswordState> {
  if (!isDbConfigured()) {
    return { passwordHash: null, passwordSetAt: null }
  }
  try {
    const row = await prisma.admin.findUnique({
      where: { id: ADMIN_RECORD_ID },
      select: { passwordHash: true, passwordSetAt: true },
    })
    const passwordHash = row?.passwordHash?.trim() || null
    return {
      passwordHash,
      passwordSetAt: row?.passwordSetAt ?? null,
    }
  } catch {
    return { passwordHash: null, passwordSetAt: null }
  }
}

export async function saveAdminPasswordHash(passwordHash: string): Promise<void> {
  const now = new Date()
  await prisma.admin.upsert({
    where: { id: ADMIN_RECORD_ID },
    create: {
      id: ADMIN_RECORD_ID,
      passwordHash,
      passwordSetAt: now,
    },
    update: {
      passwordHash,
      passwordSetAt: now,
      passwordResetTokenHash: null,
      passwordResetExpiresAt: null,
    },
  })
}
