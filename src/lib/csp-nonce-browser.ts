/**
 * CSP nonce a kliens oldali dinamikus scriptekhez (reCAPTCHA, model-viewer).
 * A böngésző a nonce attribútumot elrejtheti; a .nonce property olvasható.
 */
export function readDocumentCspNonce(): string | undefined {
  if (typeof document === 'undefined') return undefined
  const el = document.querySelector('[nonce]') as (HTMLElement & { nonce?: string }) | null
  if (!el) return undefined
  return el.nonce || el.getAttribute('nonce') || undefined
}

export function applyCspNonceToScript(script: HTMLScriptElement): void {
  const nonce = readDocumentCspNonce()
  if (nonce) script.nonce = nonce
}
