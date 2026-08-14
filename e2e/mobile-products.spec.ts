import { test, expect } from '@playwright/test'
import { dismissDealPopup, prepareHungarianPage } from './helpers'

const IPHONE = { width: 390, height: 844 }

test.describe('mobile product visibility', () => {
  test.use({ viewport: IPHONE })

  test('shop grid shows product cards in the mobile viewport', async ({ page }) => {
    await prepareHungarianPage(page)
    await page.goto('/termekek')
    await dismissDealPopup(page)

    const card = page.locator('main article').first()
    await expect(card).toBeVisible()

    const box = await card.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.width).toBeGreaterThan(200)
    expect(box!.height).toBeGreaterThan(80)
    expect(box!.x).toBeGreaterThanOrEqual(-8)
    expect(box!.x + box!.width).toBeLessThanOrEqual(IPHONE.width + 8)
  })

  test('homepage featured products are reachable by scrolling on a phone', async ({ page }) => {
    await prepareHungarianPage(page)
    await page.goto('/')
    await dismissDealPopup(page)

    const heading = page.getByRole('heading', { name: 'Kiemelt termékek' })
    await heading.scrollIntoViewIfNeeded()
    await expect(heading).toBeVisible()

    const card = page.locator('main article').first()
    await card.scrollIntoViewIfNeeded()
    await expect(card).toBeVisible()

    const box = await card.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.width).toBeGreaterThan(200)
    expect(box!.y).toBeGreaterThanOrEqual(0)
    expect(box!.y).toBeLessThan(IPHONE.height)
  })
})
