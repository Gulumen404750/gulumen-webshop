/**
 * Születésnapi 15% kupon:
 * - azonnal, amikor a user megadja a születési dátumát
 * - és/vagy a napi cron a tényleges születésnapon (ha az idén még nem kapott)
 */
import { randomBytes } from 'crypto'
import { prisma, isDbConfigured } from '@/lib/prisma'
import {
  BIRTHDAY_COUPON_PERCENT,
  BIRTHDAY_COUPON_VALID_DAYS,
  getBirthdayCouponPercentDisplay,
} from '@/lib/coupon-config'
import { sendBirthdayCouponEmail } from '@/lib/birthday-email'

export type BirthdayCouponInfo = {
  code: string
  percent: number
  validUntil: string
  active: boolean
}

export type GrantBirthdayCouponResult =
  | {
      ok: true
      created: boolean
      emailed: boolean
      coupon: BirthdayCouponInfo
      emailError?: string
    }
  | { ok: false; reason: 'no_db' | 'user_not_found' | 'already_sent_this_year' | 'error'; error?: string }

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

async function createUniqueBirthdayCode(percent: number): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = `SZULI-${percent}-${randomCouponSuffix()}`
    const exists = await prisma.coupon.findUnique({ where: { code }, select: { id: true } })
    if (!exists) return code
  }
  return `SZULI-${percent}-${Date.now().toString(36).toUpperCase()}`
}

function toCouponInfo(coupon: {
  code: string
  discountValue: number
  validUntil: Date | null
  active: boolean
}): BirthdayCouponInfo {
  return {
    code: coupon.code,
    percent: coupon.discountValue,
    validUntil: (coupon.validUntil ?? new Date()).toISOString(),
    active: coupon.active,
  }
}

/** Aktív, fel nem használt születésnapi kupon a userhez. */
export async function findActiveBirthdayCoupon(userId: string): Promise<BirthdayCouponInfo | null> {
  if (!isDbConfigured() || !userId) return null
  const now = new Date()
  const rows = await prisma.coupon.findMany({
    where: {
      userId,
      source: 'birthday',
      active: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 5,
  })
  for (const row of rows) {
    if (row.maxUses != null && row.usedCount >= row.maxUses) continue
    if (row.validUntil && row.validUntil < now) continue
    if (row.validFrom && row.validFrom > now) continue
    return toCouponInfo(row)
  }
  return null
}

/**
 * Születésnapi kupon kiadása egy usernek (e-mail + DB kód).
 * Idempotens: ha már van aktív kuponja, azt adja vissza; ha az idén már kapott, skip.
 */
export async function grantBirthdayCouponForUser(
  userId: string,
  options?: { sendEmail?: boolean; now?: Date }
): Promise<GrantBirthdayCouponResult> {
  if (!isDbConfigured()) return { ok: false, reason: 'no_db' }

  const sendEmail = options?.sendEmail !== false
  const now = options?.now ?? new Date()
  const { year } = budapestParts(now)

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      birthDate: true,
      birthdayCouponLastSentYear: true,
    },
  })
  if (!user) return { ok: false, reason: 'user_not_found' }

  const existingActive = await findActiveBirthdayCoupon(userId)
  if (existingActive) {
    return { ok: true, created: false, emailed: false, coupon: existingActive }
  }

  if (user.birthdayCouponLastSentYear != null && user.birthdayCouponLastSentYear >= year) {
    return { ok: false, reason: 'already_sent_this_year' }
  }

  const percent = getBirthdayCouponPercentDisplay()
  const discountValue = Math.round(BIRTHDAY_COUPON_PERCENT * 100)
  const validUntil = new Date(now.getTime() + BIRTHDAY_COUPON_VALID_DAYS * 24 * 60 * 60 * 1000)

  try {
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

    const coupon: BirthdayCouponInfo = {
      code,
      percent,
      validUntil: validUntil.toISOString(),
      active: true,
    }

    let emailed = false
    let emailError: string | undefined
    if (sendEmail) {
      const emailResult = await sendBirthdayCouponEmail({
        to: user.email,
        name: user.name,
        percent,
        couponCode: code,
        validUntil,
      })
      if (emailResult.ok) emailed = true
      else emailError = emailResult.error
    }

    return { ok: true, created: true, emailed, coupon, emailError }
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e)
    console.error('[birthday-coupon] grant failed', userId, e)
    return { ok: false, reason: 'error', error }
  }
}

type BirthdayUserRow = {
  id: string
  email: string
  name: string | null
  birthDate: Date
  birthdayCouponLastSentYear: number | null
}

async function findBirthdayUsers(month: number, day: number, year: number): Promise<BirthdayUserRow[]> {
  const rows = await prisma.$queryRaw<BirthdayUserRow[]>`
    SELECT id, email, name, "birthDate", "birthdayCouponLastSentYear"
    FROM "User"
    WHERE "birthDate" IS NOT NULL
      AND EXTRACT(MONTH FROM "birthDate") = ${month}
      AND EXTRACT(DAY FROM "birthDate") = ${day}
      AND ("birthdayCouponLastSentYear" IS NULL OR "birthdayCouponLastSentYear" < ${year})
  `
  return rows
}

/**
 * Napi feladat: mai születésnaposoknak kupon + e-mail (ha az idén még nem kaptak).
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
  const candidates = await findBirthdayUsers(month, day, year)

  let sent = 0
  let emailed = 0
  let skipped = 0
  const errors: string[] = []

  for (const user of candidates) {
    const result = await grantBirthdayCouponForUser(user.id, { sendEmail: true, now })
    if (result.ok && result.created) {
      sent += 1
      if (result.emailed) emailed += 1
      else if (result.emailError) errors.push(`${user.email}: ${result.emailError}`)
    } else if (!result.ok) {
      if (result.reason === 'already_sent_this_year') skipped += 1
      else {
        skipped += 1
        errors.push(`${user.email}: ${result.error || result.reason}`)
      }
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
