import { test, expect, type Page } from '@playwright/test'

// Runs against AI_FAKE=1 (playwright.config.ts webServer env): the fixture
// proposer returns a well-formed reply proposing NO swaps, so the whole flow is
// exercised without a paid call. Starting the dev server yourself before
// `npm run e2e` makes Playwright reuse it and WILL spend real money.

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

async function dismissCoverageIssues(page: Page) {
  const dismiss = page.getByRole('button', { name: 'הבנתי' })
  const appeared = await dismiss.waitFor({ state: 'visible', timeout: 5000 }).then(() => true, () => false)
  if (appeared) {
    await dismiss.click()
    await expect(dismiss).toBeHidden({ timeout: 5000 })
  }
}

test('AI improvement check reports when there is nothing to improve', async ({ page }) => {
  test.setTimeout(120_000)
  await signupAndOnboard(page)

  await page.goto('/team')
  await addEmployee(page, 'דנה כהן')
  await addEmployee(page, 'יוסי לוי')

  await page.goto('/schedule')
  await expect(page.getByRole('heading', { name: 'סידור עבודה' })).toBeVisible({ timeout: 10000 })
  await page.getByRole('button', { name: 'צור סידור אוטומטי' }).click()
  await expect(page.getByTestId('coverage')).toBeVisible({ timeout: 30000 })
  await dismissCoverageIssues(page)

  // The button only appears once a schedule exists and is unpublished.
  const btn = page.getByTestId('ai-improve-btn')
  await expect(btn).toBeVisible({ timeout: 15000 })
  await btn.click()

  const panel = page.getByTestId('ai-improve-panel')
  await expect(panel).toBeVisible({ timeout: 30000 })
  await expect(panel).toContainText('לא נמצא שיפור')
  // Nothing to apply ⇒ no apply button is offered.
  await expect(page.getByTestId('ai-improve-apply')).toHaveCount(0)

  // Closing returns to the button without having changed the schedule.
  await panel.getByRole('button', { name: 'סגור' }).click()
  await expect(btn).toBeVisible()
})
