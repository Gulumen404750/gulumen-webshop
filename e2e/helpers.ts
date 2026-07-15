import type { APIRequestContext, Page } from '@playwright/test'

export const TEST_PRODUCT_SLUG = 'rolltop-hatizsak-fekete-1'
/** type: 'stock' – like API csak stock/sourcing termékekre működik. */
export const TEST_LIKE_PRODUCT_SLUG = 'kabel-rendezo-klipsz'
export const TEST_PASSWORD = 'TestPassword123!'
export const WEBHOOK_SECRET = 'e2e-webhook-secret'

export function uniqueEmail(prefix = 'e2e'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.local`
}

/** Magyar UI + akciós popup kikapcsolása az E2E-ben. */
export async function prepareHungarianPage(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem('gulumen-locale', 'hu')
    sessionStorage.setItem('gulumen-deal-popup-closed', 'true')
  })
}

export async function dismissDealPopup(page: Page): Promise<void> {
  const close = page.getByRole('button', { name: 'Bezárás' })
  if (await close.isVisible().catch(() => false)) {
    await close.click({ force: true })
    await close.waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {})
  }
}

export async function clearCart(page: Page): Promise<void> {
  await prepareHungarianPage(page)
  await page.goto('/')
  await dismissDealPopup(page)
  await page.evaluate(() => {
    localStorage.removeItem('gulumen-cart')
    localStorage.removeItem('cart')
    localStorage.removeItem('cartItems')
  })
}

export async function registerUser(
  page: Page,
  email: string,
  password = TEST_PASSWORD
): Promise<void> {
  await prepareHungarianPage(page)
  await page.goto('/regisztracio')
  await dismissDealPopup(page)
  await page.locator('#reg-email').fill(email)
  await page.locator('#reg-password').fill(password)
  await page.locator('#reg-offers').check()
  await page.getByRole('button', { name: 'Regisztráció', exact: true }).click()
  await page.waitForURL('**/termekek')
}

export async function loginUser(
  page: Page,
  email: string,
  password = TEST_PASSWORD
): Promise<void> {
  await prepareHungarianPage(page)
  await page.goto('/profil')
  await dismissDealPopup(page)
  await page.locator('#email').fill(email)
  await page.locator('#password').fill(password)
  await page.getByRole('button', { name: 'Bejelentkezés', exact: true }).click()
  await page.waitForURL('**/')
}

export async function logoutUser(page: Page): Promise<void> {
  await page.goto('/profil')
  await dismissDealPopup(page)
  await page.getByRole('button', { name: 'Kijelentkezés' }).click()
  await page.waitForURL('**/api/auth/signout**')
  await page.getByRole('button', { name: /sign out|kijelentkezés/i }).click()
  await page.waitForURL(/\/(\?.*)?$/)
}

export async function addProductToCart(page: Page): Promise<void> {
  await prepareHungarianPage(page)
  await page.goto(`/termek/${TEST_PRODUCT_SLUG}`)
  await dismissDealPopup(page)
  await page.getByRole('button', { name: 'Kosárba' }).click()
}

export async function completeDummyPayment(
  page: Page,
  request: APIRequestContext,
  baseURL: string
): Promise<void> {
  const checkoutResponse = await page.waitForResponse(
    (res) => res.url().includes('/api/checkout') && res.request().method() === 'POST'
  )
  const data = (await checkoutResponse.json()) as {
    payments?: Array<{ transactionId?: string }>
  }

  for (const payment of data.payments ?? []) {
    if (!payment.transactionId) continue
    await request.post(`${baseURL}/api/payments/webhook`, {
      headers: { 'X-Webhook-Secret': WEBHOOK_SECRET },
      data: {
        provider: 'dummy',
        transactionId: payment.transactionId,
        status: 'succeeded',
      },
    })
  }
}
