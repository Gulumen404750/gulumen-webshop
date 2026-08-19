import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

describe('points guide accordion + history preview', () => {
  const guide = readFileSync(join(process.cwd(), 'src/components/PointsGuide.tsx'), 'utf-8')
  const history = readFileSync(
    join(process.cwd(), 'src/components/PointHistoryTimeline.tsx'),
    'utf-8'
  )

  it('collapses earn-point categories behind details/summary', () => {
    expect(guide).toContain('<details')
    expect(guide).toContain('<summary')
    expect(guide).toContain('gamification.mechanicsIntro')
    expect(guide).toContain('group-open:rotate-180')
  })

  it('previews the latest three history rows with an expand control', () => {
    expect(history).toContain('POINT_HISTORY_PREVIEW_LIMIT = 3')
    expect(history).toContain('transactions.slice(0, POINT_HISTORY_PREVIEW_LIMIT)')
    expect(history).toContain("t('gamification.historyExpand')")
    expect(history).toContain("t('gamification.historyCollapse')")
    expect(history).toContain('aria-expanded={expanded}')
  })

  it('calls history expand state before the logged-out early return', () => {
    const earlyReturn = history.indexOf('if (!isLoggedIn) return null')
    const useStateIdx = history.indexOf('useState(false)')
    expect(earlyReturn).toBeGreaterThan(0)
    expect(useStateIdx).toBeGreaterThan(0)
    expect(useStateIdx).toBeLessThan(earlyReturn)
  })
})
