import { test, expect } from '@playwright/test'
import {
  clearCart,
  TEST_PRODUCT_SLUG,
  prepareHungarianPage,
  dismissDealPopup,
} from './helpers'

test.describe('Cart flow', () => {
  test.beforeEach(async ({ page }) => {
    await clearCart(page)
  })

  test('termék megtekintés → kosárba → kosár oldal', async ({ page }) => {
    await prepareHungarianPage(page)
    await page.goto(`/termek/${TEST_PRODUCT_SLUG}`)
    await dismissDealPopup(page)
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Roll-top hátizsák')

    await page.getByRole('button', { name: 'Kosárba' }).click()

    await page.goto('/kosar')
    await dismissDealPopup(page)
    await expect(page.getByRole('heading', { name: 'Kosár' })).toBeVisible()
    await expect(page.getByText(/Roll-top hátizsák/i).first()).toBeVisible()
    await expect(page.getByRole('button', { name: 'Rendelés véglegesítése' })).toBeEnabled()
  })
})
