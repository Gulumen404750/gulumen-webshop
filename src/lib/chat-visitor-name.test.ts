import { describe, expect, it } from 'vitest'
import {
  buildChatVisitorNameBlock,
  normalizeChatDisplayName,
} from './chat-visitor-name'

describe('normalizeChatDisplayName', () => {
  it('returns trimmed preferred names', () => {
    expect(normalizeChatDisplayName('  Anna  ')).toBe('Anna')
    expect(normalizeChatDisplayName('Kovács Anna')).toBe('Kovács Anna')
  })

  it('returns null for empty / too short', () => {
    expect(normalizeChatDisplayName('')).toBeNull()
    expect(normalizeChatDisplayName('  ')).toBeNull()
    expect(normalizeChatDisplayName('A')).toBeNull()
    expect(normalizeChatDisplayName(null)).toBeNull()
    expect(normalizeChatDisplayName(undefined)).toBeNull()
  })
})

describe('buildChatVisitorNameBlock', () => {
  it('is empty without a name (graceful fallback)', () => {
    expect(buildChatVisitorNameBlock(null)).toBe('')
  })

  it('includes greeting guidance when a name exists', () => {
    const block = buildChatVisitorNameBlock('Anna')
    expect(block).toContain('[BEJELENTKEZETT VÁSÁRLÓ MEGSZÓLÍTÁSA]')
    expect(block).toContain('Anna')
    expect(block).toMatch(/Szia, Anna/)
  })
})
