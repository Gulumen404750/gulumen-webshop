/**
 * Timing-safe string összehasonlítás secret / token ellenőrzéshez.
 * Hosszeltérésnél false (Node timingSafeEqual csak azonos hosszra hívható).
 */

import { timingSafeEqual } from 'crypto'

export function secureCompare(
  provided: string | null | undefined,
  expected: string | null | undefined
): boolean {
  if (typeof provided !== 'string' || typeof expected !== 'string') return false
  if (provided.length === 0 || expected.length === 0) return false

  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}
