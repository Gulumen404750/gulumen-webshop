import { test, expect } from '@playwright/test'
import { uniqueEmail, registerUser, loginUser, logoutUser, TEST_PASSWORD } from './helpers'

test.describe('Auth flow', () => {
  test('regisztráció → bejelentkezés → kijelentkezés', async ({ page }) => {
    const email = uniqueEmail('auth')

    await registerUser(page, email)
    await page.goto('/profil')
    await expect(page.getByText('Bejelentkezve:')).toBeVisible()
    await expect(page.getByText(email)).toBeVisible()

    await logoutUser(page)
    await page.goto('/profil')
    await expect(page.getByRole('button', { name: 'Bejelentkezés', exact: true })).toBeVisible()

    await loginUser(page, email, TEST_PASSWORD)
    await page.goto('/profil')
    await expect(page.getByText('Bejelentkezve:')).toBeVisible()
    await expect(page.getByText(email)).toBeVisible()
  })
})
