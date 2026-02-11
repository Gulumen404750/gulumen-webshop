/**
 * Gulumen AI Assistant – rule-based behavior.
 * Returns translation keys (ai.*) so the UI shows the response in the selected locale.
 * Never asks for card/ID/passwords. Handover to human on: legal threats, aggression, authenticity accusations.
 */

export type AIResponseKey =
  | 'ai.handover'
  | 'ai.noCard'
  | 'ai.payment'
  | 'ai.shipping'
  | 'ai.returns'
  | 'ai.authenticity'
  | 'ai.register'
  | 'ai.complaint'
  | 'ai.productQuestion'
  | 'ai.recommend'
  | 'ai.thanks'
  | 'ai.default'

export function getResponse(
  userMessage: string,
  context?: { productName?: string }
): { textKey: AIResponseKey; escalate?: boolean } {
  const msg = userMessage.toLowerCase().trim()

  // Escalate: legal, aggressive, authenticity accusation
  if (
    /\b(ügyvéd|jogász|per|jogi|fenyeget|súlyosan kifogásol)\b/i.test(msg) ||
    /\b(lawyer|legal|sue|court|threat)\b/i.test(msg) ||
    /\b(anwalt|gericht|klage|droh)\b/i.test(msg) ||
    /\b(hamis|hamisítvány|fake|counterfeit|fälschung)\b/i.test(msg) ||
    /\b(aggressiv|aggressive|fenyegetés|threat)\b/i.test(msg)
  ) {
    return { textKey: 'ai.handover', escalate: true }
  }

  if (
    /\b(kártya|kártyaszám|cvv|jelszó|személyi|pass)\b/i.test(msg) ||
    /\b(card number|cvv|password|id)\b/i.test(msg) ||
    /\b(kartennummer|passwort)\b/i.test(msg)
  ) {
    return { textKey: 'ai.noCard' }
  }

  if (/\b(fizetés|fizetni|kártyás|how to pay|payment|zahlung)\b/i.test(msg)) {
    return { textKey: 'ai.payment' }
  }

  if (/\b(szállítás|feladás|mikor érkezik|shipping|delivery|versand|lieferung)\b/i.test(msg)) {
    return { textKey: 'ai.shipping' }
  }

  if (/\b(visszaküld|visszatérít|refund|return|rückgabe|rückerstattung)\b/i.test(msg)) {
    return { textKey: 'ai.returns' }
  }

  if (/\b(eredeti|autentikus|authenticity|echt|original)\b/i.test(msg)) {
    return { textKey: 'ai.authenticity' }
  }

  if (/\b(regisztrál|kupon|coupon|registrier|anmelden)\b/i.test(msg)) {
    return { textKey: 'ai.register' }
  }

  if (/\b(panasz|reklamáció|complaint|beschwerde|problem|probléma)\b/i.test(msg)) {
    return { textKey: 'ai.complaint' }
  }

  if (/\b(ajánl|javasol|recommend|empfehl|mit vegyek|what to buy)\b/i.test(msg)) {
    return { textKey: 'ai.recommend' }
  }

  if (
    /\b(ár|price|preis|állapot|condition|zustand|raktáron|stock|méret|size|größe)\b/i.test(msg) &&
    context?.productName
  ) {
    return { textKey: 'ai.productQuestion' }
  }

  if (/\b(ár|price|preis|állapot|condition|raktáron|méret|size)\b/i.test(msg)) {
    return { textKey: 'ai.productQuestion' }
  }

  if (/\b(köszönöm|bye|viszontlátásra|thanks|danke|tschüss)\b/i.test(msg)) {
    return { textKey: 'ai.thanks' }
  }

  return { textKey: 'ai.default' }
}
