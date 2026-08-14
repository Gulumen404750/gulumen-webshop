import { describe, expect, it } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

describe('ShopSpaceVideo wiring', () => {
  it('is mounted on the products page behind the listing', () => {
    const page = readFileSync(join(process.cwd(), 'src/app/termekek/page.tsx'), 'utf-8')
    expect(page).toMatch(/from ['"]@\/components\/ShopSpaceVideo['"]/)
    expect(page).toMatch(/<ShopSpaceVideo\s*\/>/)
    expect(page).toMatch(/shop-space-page/)
  })

  it('plays a muted looping mp4 with no audio track intent', () => {
    const src = readFileSync(join(process.cwd(), 'src/components/ShopSpaceVideo.tsx'), 'utf-8')
    expect(src).toMatch(/muted/)
    expect(src).toMatch(/loop/)
    expect(src).toMatch(/playsInline/)
    expect(src).toMatch(/futuristic-space-glowing-lines\.mp4/)
    expect(src).toMatch(/prefers-reduced-motion/)
    expect(src).not.toMatch(/new Audio|volume\s*=\s*[1-9]/)
  })

  it('ships the background video in public/videos', () => {
    expect(
      existsSync(join(process.cwd(), 'public/videos/futuristic-space-glowing-lines.mp4'))
    ).toBe(true)
  })
})
