/** Admin lista: e-mail maszkolás (GDPR adattakarékosság). */

export function maskEmail(email: string): string {
  const trimmed = email.trim()
  const at = trimmed.lastIndexOf('@')
  if (at <= 0 || at === trimmed.length - 1) return '***'
  const local = trimmed.slice(0, at)
  const domain = trimmed.slice(at + 1)
  const keep = local.slice(0, 1)
  return `${keep}***@${domain}`
}
