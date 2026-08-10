/**
 * Chat üzenet tagolás: számozott listák sortörése + egyszerű **félkövér** renderelés.
 */

/** Modellválasz utótagolása: 1. / 2. / 3. tételek külön sorba kerüljenek. */
export function formatChatAssistantText(text: string): string {
  let out = text.replace(/\r\n/g, '\n').trim()
  if (!out) return out

  // "1. " / "2) " stb. előtt sortörés, ha még egy sorban van
  out = out.replace(/([^\n])\s+(?=(\d+)([.)])\s+)/g, '$1\n\n')

  // Dupla üres sorok ne legyenek túlzóak
  out = out.replace(/\n{3,}/g, '\n\n')
  return out.trim()
}

export type ChatTextPart =
  | { type: 'text'; value: string }
  | { type: 'bold'; value: string }
  | { type: 'break' }

/** Egyszerű **félkövér** + sortörés parse (XSS-mentes, React children-hez). */
export function parseChatTextParts(text: string): ChatTextPart[] {
  const normalized = formatChatAssistantText(text)
  const parts: ChatTextPart[] = []
  const lines = normalized.split('\n')

  lines.forEach((line, lineIdx) => {
    if (lineIdx > 0) parts.push({ type: 'break' })
    const re = /\*\*(.+?)\*\*/g
    let last = 0
    let match: RegExpExecArray | null
    while ((match = re.exec(line)) !== null) {
      if (match.index > last) {
        parts.push({ type: 'text', value: line.slice(last, match.index) })
      }
      parts.push({ type: 'bold', value: match[1] })
      last = match.index + match[0].length
    }
    if (last < line.length) {
      parts.push({ type: 'text', value: line.slice(last) })
    } else if (line.length === 0) {
      // üres sor – a break már kirajzolja
    }
  })

  return parts
}
