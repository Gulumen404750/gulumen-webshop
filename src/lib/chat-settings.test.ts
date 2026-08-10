import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SYSTEM_PROMPT,
  SYSTEM_PROMPT_REVISION,
  DEFAULT_CHAT_SETTINGS,
  resolveOpenAiModels,
  getDefaultChatSettings,
} from '@/lib/chat-settings'

describe('Gulumen CX handbook / chat settings', () => {
  it('exports a non-empty official system prompt revision', () => {
    expect(SYSTEM_PROMPT_REVISION).toMatch(/^gulumen-cx-handbook-/)
    expect(DEFAULT_SYSTEM_PROMPT.length).toBeGreaterThan(8000)
  })

  it('keeps core Gulumen CX rules in the default prompt', () => {
    const p = DEFAULT_SYSTEM_PROMPT
    expect(p).toContain('Empathy-First')
    expect(p).toContain('TILTÓLISTA')
    expect(p).toContain('25 000')
    expect(p).toContain('ZÉRÓ cross-sell')
    expect(p).toMatch(/PLA/)
    expect(p).toContain('A te otthonod, a mi szívügyünk')
    expect(p).toContain('24 órán belül')
  })

  it('instructs the model about interactive product cards', () => {
    const p = DEFAULT_SYSTEM_PROMPT
    expect(p).toMatch(/termékkárty/i)
    expect(p).toMatch(/nem tudok közvetlenül termékeket mutatni/i)
    expect(p).toMatch(/AJÁNLOTT TERMÉKEK/i)
  })

  it('requires readable numbered lists with light emojis', () => {
    const p = DEFAULT_SYSTEM_PROMPT
    expect(p).toMatch(/FORMÁZÁS/i)
    expect(p).toMatch(/ÚJ SORON/)
    expect(p).toMatch(/emoji/i)
  })

  it('covers optional visitor-name greeting with graceful fallback', () => {
    const p = DEFAULT_SYSTEM_PROMPT
    expect(p).toMatch(/Megszólítás név szerint/i)
    expect(p).toMatch(/NE jelezd, hogy hiányzik a név/)
  })

  it('forbids customer-facing tech jargon guidance', () => {
    expect(DEFAULT_SYSTEM_PROMPT).toContain('3D nyomtatás')
    expect(DEFAULT_SYSTEM_PROMPT).toContain('design stúdió')
    expect(DEFAULT_SYSTEM_PROMPT).toContain('teszttermék')
  })

  it('default chat settings use the handbook prompt', () => {
    const s = getDefaultChatSettings()
    expect(s.systemPrompt).toBe(DEFAULT_SYSTEM_PROMPT)
    expect(s).toEqual(DEFAULT_CHAT_SETTINGS)
  })

  it('resolves OpenAI model fallbacks uniquely', () => {
    expect(resolveOpenAiModels('gpt-4o-mini')).toEqual(['gpt-4o-mini', 'gpt-4o'])
    expect(resolveOpenAiModels('gpt-4o')).toEqual(['gpt-4o', 'gpt-4o-mini'])
  })
})
