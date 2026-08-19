import { describe, expect, it } from 'vitest'
import {
  assistantReplyIgnoresLocale,
  buildChatLanguageLock,
  isCasualChatGreeting,
  resolveChatLocale,
  wrapUserMessageForLocale,
} from './chat-language'

describe('buildChatLanguageLock', () => {
  it('locks German replies when the storefront is DE', () => {
    const block = buildChatLanguageLock('de')
    expect(block).toContain('LANGUAGE LOCK')
    expect(block).toContain('locale: de')
    expect(block).toMatch(/auf Deutsch/i)
    expect(block).toMatch(/kein Ungarisch/i)
    expect(block).toContain('Hallo! Wobei kann ich helfen?')
    expect(block).toMatch(/Szia/)
  })

  it('locks English, Romanian and Hungarian similarly', () => {
    expect(buildChatLanguageLock('en')).toMatch(/English only/i)
    expect(buildChatLanguageLock('ro')).toMatch(/română/i)
    expect(buildChatLanguageLock('hu')).toMatch(/magyarul/i)
  })
})

describe('resolveChatLocale', () => {
  it('prefers the request body locale', () => {
    const request = new Request('https://gulumen.com/api/chat', {
      headers: { cookie: 'gulumen-locale=hu' },
    })
    expect(resolveChatLocale('de', request)).toBe('de')
  })

  it('falls back to the storefront locale cookie', () => {
    const request = new Request('https://gulumen.com/api/chat', {
      headers: { cookie: 'gulumen-locale=de' },
    })
    expect(resolveChatLocale('nope', request)).toBe('de')
  })
})

describe('isCasualChatGreeting', () => {
  it('treats Hy/Hallo as greetings that must follow the UI locale', () => {
    expect(isCasualChatGreeting('Hy')).toBe(true)
    expect(isCasualChatGreeting('Hallo!')).toBe(true)
    expect(isCasualChatGreeting('Lámpát keresek')).toBe(false)
  })
})

describe('assistantReplyIgnoresLocale', () => {
  it('flags Hungarian assistant copy when the UI is German', () => {
    expect(
      assistantReplyIgnoresLocale(
        'Szia! Persze, miben segíthetek neked ma?',
        'de'
      )
    ).toBe(true)
    expect(assistantReplyIgnoresLocale('Hallo! Wobei kann ich helfen?', 'de')).toBe(false)
    expect(assistantReplyIgnoresLocale('Szia! Miben segíthetek?', 'hu')).toBe(false)
  })
})

describe('wrapUserMessageForLocale', () => {
  it('tells the model to keep the UI language even if the shopper wrote Hungarian', () => {
    const wrapped = wrapUserMessageForLocale('Lámpát keresek', 'de')
    expect(wrapped).toContain('locale: de')
    expect(wrapped).toMatch(/auf Deutsch/i)
    expect(wrapped).toContain('Lámpát keresek')
  })
})
