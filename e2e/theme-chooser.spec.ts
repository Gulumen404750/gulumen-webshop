import { expect, test } from '@playwright/test'

test.describe('Első látogatásos témaválasztó', () => {
  test('megjelenik, sötét módot ment, újratöltéskor nem kérdez újra', async ({ page }) => {
    // Ne töröld a témát minden navigációnál / reloadnál — különben a mentett
    // dark választás eltűnik, mielőtt a bootstrap script futna.
    await page.addInitScript(() => {
      localStorage.setItem('gulumen-locale', 'hu')
      sessionStorage.setItem('gulumen-deal-popup-closed', 'true')
      if (!sessionStorage.getItem('e2e-theme-chooser-cleared')) {
        localStorage.removeItem('gulumen-theme')
        localStorage.removeItem('gulumen-dark')
        sessionStorage.setItem('e2e-theme-chooser-cleared', '1')
      }
    })

    await page.goto('/')
    const dialog = page.getByRole('dialog', { name: 'Hogyan szeretnéd böngészni?' })
    await expect(dialog).toBeVisible()

    await dialog.getByRole('button', { name: /Sötét mód/i }).click()
    await expect(dialog).toHaveCount(0)
    await expect(page.locator('html')).toHaveClass(/dark/)

    const stored = await page.evaluate(() => localStorage.getItem('gulumen-theme'))
    expect(stored).toBe('dark')

    await page.reload()
    await expect(page.getByRole('dialog', { name: 'Hogyan szeretnéd böngészni?' })).toHaveCount(0)
    await expect(page.locator('html')).toHaveClass(/dark/)
  })

  test('mentett választásnál nem jelenik meg', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('gulumen-locale', 'hu')
      localStorage.setItem('gulumen-theme', 'light')
      sessionStorage.setItem('gulumen-deal-popup-closed', 'true')
    })
    await page.goto('/')
    await expect(page.getByRole('dialog', { name: 'Hogyan szeretnéd böngészni?' })).toHaveCount(0)
  })
})
