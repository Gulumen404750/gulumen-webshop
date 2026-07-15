import { test, expect } from '@playwright/test'
import {
  uniqueEmail,
  registerUser,
  TEST_LIKE_PRODUCT_SLUG,
  prepareHungarianPage,
  dismissDealPopup,
} from './helpers'

test.describe('Kedvencek', () => {
  test('like toggle termékoldalon', async ({ page }) => {
    const email = uniqueEmail('likes')
    await registerUser(page, email)

    await prepareHungarianPage(page)
    await page.goto(`/termek/${TEST_LIKE_PRODUCT_SLUG}`)
    await dismissDealPopup(page)

    const likeButton = page.locator('button.text-sm.font-medium.text-accent').filter({ hasText: 'Kedvencekhez' })
    await expect(likeButton).toBeVisible()

    const likeResponse = page.waitForResponse(
      (res) => res.url().includes('/like') && res.request().method() === 'POST' && res.ok()
    )
    await likeButton.click()
    await likeResponse

    await expect(
      page.locator('button.text-sm.font-medium.text-accent').filter({ hasText: 'Eltávolítás a kedvencekből' })
    ).toBeVisible()

    const unlikeResponse = page.waitForResponse(
      (res) => res.url().includes('/like') && res.request().method() === 'POST' && res.ok()
    )
    await page.locator('button.text-sm.font-medium.text-accent').filter({ hasText: 'Eltávolítás a kedvencekből' }).click()
    await unlikeResponse
    await expect(likeButton).toBeVisible()

    const likeAgainResponse = page.waitForResponse(
      (res) => res.url().includes('/like') && res.request().method() === 'POST' && res.ok()
    )
    await likeButton.click()
    await likeAgainResponse

    await page.goto('/kedvencek')
    await expect(page.getByRole('heading', { name: 'Kedvencek' })).toBeVisible()
    await expect(page.getByText(/Kábel rendező klipsz/i).first()).toBeVisible({ timeout: 10_000 })
  })
})
