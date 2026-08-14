/**
 * Singleton Admin rekord – TOTP secret / 2FA állapot.
 *
 * Újrapárosítás közben az aktív totpSecret és isTwoFactorEnabled érintetlen marad;
 * az új secret pendingTotpSecret-ben vár, amíg a verify-setup meg nem erősíti.
 */

import { prisma, isDbConfigured } from '@/lib/prisma'
import { ADMIN_RECORD_ID } from '@/lib/admin-session-constants'

export { ADMIN_RECORD_ID }

export type AdminTwoFactorState = {
  isTwoFactorEnabled: boolean
  totpSecret: string | null
  pendingTotpSecret: string | null
}

export async function getAdminTwoFactorState(): Promise<AdminTwoFactorState> {
  if (!isDbConfigured()) {
    return { isTwoFactorEnabled: false, totpSecret: null, pendingTotpSecret: null }
  }
  const row = await prisma.admin.findUnique({
    where: { id: ADMIN_RECORD_ID },
    select: { totpSecret: true, pendingTotpSecret: true, isTwoFactorEnabled: true },
  })
  const totpSecret = row?.totpSecret?.trim() || null
  const pendingTotpSecret = row?.pendingTotpSecret?.trim() || null
  return {
    totpSecret,
    pendingTotpSecret,
    isTwoFactorEnabled: Boolean(row?.isTwoFactorEnabled && totpSecret),
  }
}

/**
 * Első bekapcsolás: totpSecret + isTwoFactorEnabled=false.
 * Újrapárosítás (2FA már aktív): csak pendingTotpSecret, az aktív secret és a flag marad.
 */
export async function saveAdminTotpSetup(totpSecret: string): Promise<void> {
  const state = await getAdminTwoFactorState()
  if (state.isTwoFactorEnabled) {
    await prisma.admin.update({
      where: { id: ADMIN_RECORD_ID },
      data: { pendingTotpSecret: totpSecret },
    })
    return
  }
  await prisma.admin.upsert({
    where: { id: ADMIN_RECORD_ID },
    create: {
      id: ADMIN_RECORD_ID,
      totpSecret,
      pendingTotpSecret: null,
      isTwoFactorEnabled: false,
    },
    update: {
      totpSecret,
      pendingTotpSecret: null,
      isTwoFactorEnabled: false,
    },
  })
}

/**
 * verify-setup: pending → aktív (pending törlése), vagy első bekapcsoláskor csak a flag.
 * 2FA mindig bekapcsolva marad / lesz.
 */
export async function confirmAdminTotpSetup(): Promise<void> {
  const state = await getAdminTwoFactorState()
  if (state.pendingTotpSecret) {
    await prisma.admin.update({
      where: { id: ADMIN_RECORD_ID },
      data: {
        totpSecret: state.pendingTotpSecret,
        pendingTotpSecret: null,
        isTwoFactorEnabled: true,
      },
    })
    return
  }
  await prisma.admin.update({
    where: { id: ADMIN_RECORD_ID },
    data: { isTwoFactorEnabled: true },
  })
}
