/**
 * Singleton Admin rekord – TOTP secret / 2FA állapot.
 */

import { prisma, isDbConfigured } from '@/lib/prisma'
import { ADMIN_RECORD_ID } from '@/lib/admin-session-constants'

export { ADMIN_RECORD_ID }

export type AdminTwoFactorState = {
  isTwoFactorEnabled: boolean
  totpSecret: string | null
}

export async function getAdminTwoFactorState(): Promise<AdminTwoFactorState> {
  if (!isDbConfigured()) {
    return { isTwoFactorEnabled: false, totpSecret: null }
  }
  const row = await prisma.admin.findUnique({
    where: { id: ADMIN_RECORD_ID },
    select: { totpSecret: true, isTwoFactorEnabled: true },
  })
  const totpSecret = row?.totpSecret?.trim() || null
  return {
    totpSecret,
    isTwoFactorEnabled: Boolean(row?.isTwoFactorEnabled && totpSecret),
  }
}

export async function saveAdminTotpSetup(totpSecret: string): Promise<void> {
  await prisma.admin.upsert({
    where: { id: ADMIN_RECORD_ID },
    create: {
      id: ADMIN_RECORD_ID,
      totpSecret,
      isTwoFactorEnabled: false,
    },
    update: {
      totpSecret,
      isTwoFactorEnabled: false,
    },
  })
}

export async function enableAdminTwoFactor(): Promise<void> {
  await prisma.admin.update({
    where: { id: ADMIN_RECORD_ID },
    data: { isTwoFactorEnabled: true },
  })
}
