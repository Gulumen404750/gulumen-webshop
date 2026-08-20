import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

describe('chat locale + missing-product wiring', () => {
  const chatRoute = readFileSync(join(process.cwd(), 'src/app/api/chat/route.ts'), 'utf-8')
  const assistant = readFileSync(join(process.cwd(), 'src/components/AIAssistant.tsx'), 'utf-8')
  const search = readFileSync(join(process.cwd(), 'src/lib/chat-product-search.ts'), 'utf-8')
  const schema = readFileSync(join(process.cwd(), 'prisma/schema.prisma'), 'utf-8')
  const log = readFileSync(join(process.cwd(), 'src/lib/chat-log.ts'), 'utf-8')
  const adminList = readFileSync(
    join(process.cwd(), 'src/app/admin/dashboard/settings/ChatTopQuestionsList.tsx'),
    'utf-8'
  )

  it('puts a locale language lock first and last around the OpenAI turn', () => {
    expect(chatRoute).toContain("from '@/lib/chat-language'")
    expect(chatRoute).toContain('buildChatLanguageLock(locale)')
    expect(chatRoute).toContain('wrapUserMessageForLocale(message, locale)')
    expect(chatRoute).toContain('resolveChatLocale(body?.locale, request)')
    expect(chatRoute).toContain('assistantReplyIgnoresLocale')
    expect(chatRoute).toContain('isCasualChatGreeting')
    expect(chatRoute).toMatch(/role: 'system',\s*content: languageLock/)
  })

  it('resets the on-site chat when the storefront locale changes', () => {
    expect(assistant).toContain('chatGenerationRef')
    expect(assistant).toMatch(/localeRef\.current === locale/)
    expect(assistant).toMatch(/setMessages\(\[\]\)/)
  })

  it('does not pad specific product searches with unrelated popular items', () => {
    expect(search).toContain('missingExactMatch')
    expect(search).toContain("matchKind: popular.length > 0 ? 'alternatives' : 'none'")
    expect(search).not.toMatch(/mergeUnique\(dbHits, popular\)/)
  })

  it('logs missing catalog matches and shows an admin badge/filter', () => {
    expect(schema).toContain('missingProductSearch Boolean')
    expect(log).toContain('missingProductSearch: !!params.missingProductSearch')
    expect(log).toContain('missingProductSearchCount')
    expect(adminList).toContain('Hiányzó termék keresve')
    expect(adminList).toContain('Termékeresés – Nincs készleten')
    expect(adminList).toContain("filter === 'missing'")
    expect(chatRoute).toContain('missingProductSearch: search.missingExactMatch')
    expect(assistant).toContain("t('ai.alternativeBadge')")
    expect(assistant).toContain("t('ai.alternativesNote')")
  })
})
