import { describe, expect, it } from 'vitest'
import { buildChatLanguageLock } from './chat-language'

describe('buildChatLanguageLock', () => {
  it('locks German replies when the storefront is DE', () => {
    const block = buildChatLanguageLock('de')
    expect(block).toContain('LANGUAGE LOCK')
    expect(block).toContain('locale: de')
    expect(block).toMatch(/auf Deutsch/i)
    expect(block).toMatch(/kein Ungarisch/i)
  })

  it('locks English, Romanian and Hungarian similarly', () => {
    expect(buildChatLanguageLock('en')).toMatch(/English only/i)
    expect(buildChatLanguageLock('ro')).toMatch(/română/i)
    expect(buildChatLanguageLock('hu')).toMatch(/magyarul/i)
  })
})
