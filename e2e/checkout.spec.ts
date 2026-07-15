import { test, expect } from '@playwright/test'
import {
  clearCart,
  addProductToCart,
  completeDummyPayment,
  uniqueEmail,
  dismissDealPopup,
} from './helpers'

test.describe('Checkout flow', () => {
  test.beforeEach(async ({ page }) => {
    await clearCart(page)
  })

  test('DummyProvider fizetés → siker oldal', async ({ page, request, baseURL }) => {
    const guestEmail = uniqueEmail('checkout')

    await addProductToCart(page)
    await page.goto('/kosar')
    await dismissDealPopup(page)
    await page.getByRole('button', { name: 'Rendelés véglegesítése' }).click()
    await expect(page).toHaveURL(/\/fizetes/)

    await page.locator('#guest-email').fill(guestEmail)

    const payPromise = completeDummyPayment(page, request, baseURL!)
    await page.getByRole('button', { name: 'Fizetek kártyával' }).click()
    await payPromise

    await page.waitForURL(/\/fizetes\/siker/, { timeout: 15_000 })
    await expect(page.getByRole('heading', { name: 'Sikeres fizetés' })).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText(/Raktári rendelés|ord_/i).first()).toBeVisible()
  })
})
