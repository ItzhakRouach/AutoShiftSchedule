import { test, expect, type Page } from '@playwright/test'

// Runs against AI_FAKE=1 (playwright.config.ts webServer env), so this spec
// never calls the paid Claude API. If you start the dev server yourself before
// `npm run e2e`, Playwright reuses it and this WILL spend real money.

async function signupAndOnboard(page: Page) {
  const uuid = crypto.randomUUID().replace(/-/g, '').slice(0, 12)
  await page.goto('/signup')
  await page.getByLabel('אימייל').fill(`mgr+${uuid}@example.com`)
  await page.getByLabel('סיסמה').fill('TestPass123!')
  await page.getByRole('button', { name: 'הרשמה' }).click()
  await expect(page).toHaveURL(/\/onboarding/, { timeout: 15000 })
  await page.getByLabel('שם הארגון').fill(`ארגון ${uuid}`)
  await page.getByLabel('שם מקום העבודה').fill(`מקום עבודה ${uuid}`)
  await page.getByRole('button', { name: 'יצירת מקום עבודה' }).click()
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 })
}

async function addEmployee(page: Page, name: string) {
  await page.getByRole('button', { name: 'הוסף עובד' }).click()
  await expect(page.getByRole('heading', { name: 'עובד חדש' })).toBeVisible({ timeout: 5000 })
  await page.getByLabel('שם מלא').fill(name)
  await page.getByLabel('טלפון').fill(`05${Math.floor(10000000 + Math.random() * 90000000)}`)
  await page.getByRole('switch').first().click()
  await page.getByRole('button', { name: 'הוספת עובד' }).click()
  await expect(page.getByRole('heading', { name: 'עובד חדש' })).toBeHidden({ timeout: 10000 })
}

test('the coverage popup offers an AI explanation and renders it', async ({ page }) => {
  test.setTimeout(120_000)
  await signupAndOnboard(page)

  await page.goto('/team')
  await addEmployee(page, 'דנה כהן')
  await addEmployee(page, 'יוסי לוי')

  await page.goto('/schedule')
  await expect(page.getByRole('heading', { name: 'סידור עבודה' })).toBeVisible({ timeout: 10000 })
  await page.getByRole('button', { name: 'צור סידור אוטומטי' }).click()

  // 2 employees cannot staff 63 required slots, so the issues popup must open.
  const explain = page.getByTestId('ai-explain-btn')
  await expect(explain).toBeVisible({ timeout: 30000 })

  await explain.click()
  const text = page.getByTestId('ai-explain-text')
  await expect(text).toBeVisible({ timeout: 30000 })
  await expect(text).toContainText('AI_FAKE')
  // The button is replaced by the result, not left alongside it.
  await expect(explain).toBeHidden()
})
