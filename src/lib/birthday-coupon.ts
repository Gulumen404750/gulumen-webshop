/**
 * Születésnapi 15% kupon: napi cron – marketingOptIn user, egyedi kód, 7 nap.
 */
import { randomBytes } from 'crypto'
import { prisma, isDbConfigured } from '@/lib/prisma'
import {
  BIRTHDAY_COUPON_PERCENT,
  BIRTHDAY_COUPON_VALID_DAYS,
  getBirthdayCouponPercentDisplay,
} from '@/lib/coupon-config'
import { sendBirthdayCouponEmail } from '@/lib/birthday-email'

export type BirthdayCouponRunResult = {
  ok: true
  year: number
  month: number
  day: number
  candidates: number
  sent: number
  emailed: number
  skipped: number
  errors: string[]
}

function budapestParts(now = new Date()): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Budapest',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value || 0)
  return { year: get('year'), month: get('month'), day: get('day') }
}

function randomCouponSuffix(): string {
  return randomBytes(3).toString('hex').toUpperCase()
}

type BirthdayUserRow = {
  id: string
  email: string
  name: string | null
  birthDate: Date
  birthdayCouponLastSentYear: number | null
}

async function findBirthdayUsers(month: number, day: number, year: number): Promise<BirthdayUserRow[]> {
  // Postgres EXTRACT a tárolt dátum hónap/napját nézi (birthDate dél UTC-re normalizálva).
  const rows = await prisma.$queryRaw<BirthdayUserRow[]>`
    SELECT id, email, name, "birthDate", "birthdayCouponLastSentYear"
    FROM "User"
    WHERE "marketingOptIn" = true
      AND "birthDate" IS NOT NULL
      AND EXTRACT(MONTH FROM "birthDate") = ${month}
      AND EXTRACT(DAY FROM "birthDate") = ${day}
      AND ("birthdayCouponLastSentYear" IS NULL OR "birthdayCouponLastSentYear" < ${year})
  `
  return rows
}

async function createUniqueBirthdayCode(percent: number): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = `SZULI-${percent}-${randomCouponSuffix()}`
    const exists = await prisma.coupon.findUnique({ where: { code }, select: { id: true } })
    if (!exists) return code
  }
  return `SZULI-${percent}-${Date.now().toString(36).toUpperCase()}`
}

/**
 * Napi feladat: mai születésnapos feliratkozottaknak 15% kupon + e-mail.
 */
export async function runBirthdayCouponJob(now = new Date()): Promise<BirthdayCouponRunResult> {
  if (!isDbConfigured()) {
    return {
      ok: true,
      year: 0,
      month: 0,
      day: 0,
      candidates: 0,
      sent: 0,
      emailed: 0,
      skipped: 0,
      errors: ['Database not configured'],
    }
  }

  const { year, month, day } = budapestParts(now)
  const percent = getBirthdayCouponPercentDisplay()
  const discountValue = Math.round(BIRTHDAY_COUPON_PERCENT * 100)
  const candidates = await findBirthdayUsers(month, day, year)

  let sent = 0
  let emailed = 0
  let skipped = 0
  const errors: string[] = []

  for (const user of candidates) {
    try {
      const validUntil = new Date(now.getTime() + BIRTHDAY_COUPON_VALID_DAYS * 24 * 60 * 60 * 1000)
      const code = await createUniqueBirthdayCode(percent)

      await prisma.$transaction(async (tx) => {
        await tx.coupon.create({
          data: {
            code,
            discountType: 'percent',
            discountValue,
            active: true,
            maxUses: 1,
            userId: user.id,
            source: 'birthday',
            validFrom: now,
            validUntil,
          },
        })
        await tx.user.update({
          where: { id: user.id },
          data: { birthdayCouponLastSentYear: year },
        })
      })

      sent += 1

      const emailResult = await sendBirthdayCouponEmail({
        to: user.email,
        name: user.name,
        percent,
        couponCode: code,
        validUntil,
      })
      if (emailResult.ok) emailed += 1
      else errors.push(`${user.email}: ${emailResult.error}`)
    } catch (e) {
      skipped += 1
      const msg = e instanceof Error ? e.message : String(e)
      errors.push(`${user.email}: ${msg}`)
      console.error('[birthday-coupon] failed for', user.email, e)
    }
  }

  return {
    ok: true,
    year,
    month,
    day,
    candidates: candidates.length,
    sent,
    emailed,
    skipped,
    errors,
  }
}

/** Születési dátum parse YYYY-MM-DD → Date (dél UTC), vagy null. */
export function parseBirthDateInput(value: unknown): Date | null | 'invalid' {
  if (value === null || value === undefined || value === '') return null
  if (typeof value !== 'string') return 'invalid'
  const trimmed = value.trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return 'invalid'
  const [y, m, d] = trimmed.split('-').map(Number)
  if (!y || !m || !d || m > 12 || d > 31) return 'invalid'
  const date = new Date(Date.UTC(y, m - 1, d, 12, 0, 0))
  if (
    date.getUTCFullYear() !== y ||
    date.getUTCMonth() !== m - 1 ||
    date.getUTCDate() !== d
  ) {
    return 'invalid'
  }
  const now = new Date()
  if (date.getTime() > now.getTime()) return 'invalid'
  // Ésszerű alsó határ (pl. 1900)
  if (y < 1900) return 'invalid'
  return date
}

export function formatBirthDateForInput(date: Date | null | undefined): string {
  if (!date) return ''
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d = String(date.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function ageFromBirthDate(date: Date, now = new Date()): number {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Budapest',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value || 0)
  const ty = get('year')
  const tm = get('month')
  const td = get('day')
  const by = date.getUTCFullYear()
  const bm = date.getUTCMonth() + 1
  const bd = date.getUTCDate()
  let age = ty - by
  if (tm < bm || (tm === bm && td < bd)) age -= 1
  return Math.max(0, age)
}
