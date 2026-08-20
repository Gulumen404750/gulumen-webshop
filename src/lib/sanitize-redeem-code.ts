/** A kupon / ajándékpont példa soha ne legyen a mező value-ja. */
export function sanitizeRedeemCode(raw: string, placeholder = ''): string {
  const next = raw.toUpperCase()
  if (!next.trim()) return ''
  if (placeholder && next === placeholder.toUpperCase()) return ''
  return next
}
