import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

describe('points guide accordion + history preview', () => {
  const guide = readFileSync(join(process.cwd(), 'src/components/PointsGuide.tsx'), 'utf-8')
  const history = readFileSync(
    join(process.cwd(), 'src/components/PointHistoryTimeline.tsx'),
    'utf-8'
  )

  it('keeps earn-point categories collapsed until a button tap', () => {
    expect(guide).toContain("useState<string | null>(null)")
    expect(guide).toContain('aria-expanded={open}')
    expect(guide).toContain("t('gamification.mechanicsIntro')")
    expect(guide).toContain("t('gamification.mechanicsMore')")
    expect(guide).toContain("t('gamification.mechanicsLess')")
    expect(guide).toContain('setOpenId')
    expect(guide).not.toContain('<details')
    expect(guide).not.toContain('<summary')
  })

  it('previews the latest three history rows with an expand control', () => {
    expect(history).toContain('POINT_HISTORY_PREVIEW_LIMIT = 3')
    expect(history).toContain('transactions.slice(0, POINT_HISTORY_PREVIEW_LIMIT)')
    expect(history).toContain("t('gamification.historyExpand'")
    expect(history).toContain("t('gamification.historyCollapse')")
    expect(history).toContain('aria-expanded={expanded}')
    expect(history).toContain('aria-controls="point-history-list"')
  })

  it('calls history expand state before the logged-out early return', () => {
    const earlyReturn = history.indexOf('if (!isLoggedIn) return null')
    const useStateIdx = history.indexOf('useState(false)')
    expect(earlyReturn).toBeGreaterThan(0)
    expect(useStateIdx).toBeGreaterThan(0)
    expect(useStateIdx).toBeLessThan(earlyReturn)
  })
})
