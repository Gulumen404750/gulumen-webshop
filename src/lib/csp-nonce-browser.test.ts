import { afterEach, describe, expect, it, vi } from 'vitest'
import { applyCspNonceToScript, readDocumentCspNonce } from './csp-nonce-browser'

describe('csp nonce browser helper', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('reads nonce from a document element', () => {
    vi.stubGlobal('document', {
      querySelector: () => ({ nonce: 'abc123', getAttribute: () => null }),
    })
    expect(readDocumentCspNonce()).toBe('abc123')
  })

  it('copies the document nonce onto a dynamically inserted script', () => {
    vi.stubGlobal('document', {
      querySelector: () => ({ nonce: 'n1', getAttribute: () => null }),
    })
    const script = { nonce: '' } as HTMLScriptElement
    applyCspNonceToScript(script)
    expect(script.nonce).toBe('n1')
  })
})
