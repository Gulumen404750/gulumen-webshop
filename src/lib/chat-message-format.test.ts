import { describe, expect, it } from 'vitest'
import { formatChatAssistantText, parseChatTextParts } from './chat-message-format'

describe('formatChatAssistantText', () => {
  it('breaks numbered gift list onto separate lines', () => {
    const raw =
      'Szia! Íme három ötlet: 1. **Evőkanál tartó** - praktikus. 2. **Termék 4** - szép dísz. 3. **Termék 5** - apróság. Melyik tetszik?'
    const formatted = formatChatAssistantText(raw)
    expect(formatted).toContain('\n\n1. ')
    expect(formatted).toContain('\n\n2. ')
    expect(formatted).toContain('\n\n3. ')
  })
})

describe('parseChatTextParts', () => {
  it('parses bold segments and line breaks', () => {
    const parts = parseChatTextParts('Helló!\n1. **Lámpa** – szép')
    expect(parts.some((p) => p.type === 'break')).toBe(true)
    expect(parts).toContainEqual({ type: 'bold', value: 'Lámpa' })
    expect(parts.some((p) => p.type === 'text' && p.value.includes('Helló'))).toBe(true)
  })
})
