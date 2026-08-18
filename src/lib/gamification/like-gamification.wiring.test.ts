import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

describe('unlike writes a dismiss blacklist', () => {
  it('upserts ProductDismiss on unlike and never auto-creates a dismissed like', () => {
    const src = readFileSync(join(process.cwd(), 'src/lib/gamification/like-gamification.ts'), 'utf-8')
    expect(src).toMatch(/tx\.productDismiss\.upsert/)
    expect(src).toMatch(/tx\.productDismiss\.deleteMany/)
    expect(src).toMatch(/if \(dismissed\) return/)
  })

  it('wishlist GET returns dismissedIds for client sync', () => {
    const src = readFileSync(join(process.cwd(), 'src/app/api/me/wishlist/route.ts'), 'utf-8')
    expect(src).toMatch(/dismissedIds/)
    expect(src).toMatch(/getDismissedProductIdsByUser/)
  })

  it('like POST honors the desired liked flag', () => {
    const src = readFileSync(join(process.cwd(), 'src/app/api/products/[id]/like/route.ts'), 'utf-8')
    expect(src).toMatch(/desiredLiked/)
  })
})
