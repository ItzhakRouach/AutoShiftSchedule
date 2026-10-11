import { test, expect, type Page } from '@playwright/test'

async function signupAndOnboard(page: Page) {
  const uuid = crypto.randomUUID().replace(/-/g, '').slice(0, 12)
  await page.goto('/signup')
  await page.getByLabel('אימייל').fill(`dist+${uuid}@example.com`)
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
  if (await dismiss.waitFor({ state: 'visible', timeout: 5000 }).then(() => true, () => false)) {
    await dismiss.click()
    await expect(dismiss).toBeHidden({ timeout: 5000 })
  }
}

test('worker distribution drawer opens, expands a worker, and closes', async ({ page }) => {
  test.setTimeout(120_000)
  await signupAndOnboard(page)

  await page.goto('/team')
  await addEmployee(page, 'דנה כהן')
  await addEmployee(page, 'יוסי לוי')
  await addEmployee(page, 'מאיה בר')

  await page.goto('/schedule')
  await page.getByRole('button', { name: 'צור סידור אוטומטי' }).click()
  await expect(page.getByTestId('coverage')).toBeVisible({ timeout: 30000 })
  await dismissCoverageIssues(page)

  const trigger = page.getByTestId('distribution-btn')
  await expect(trigger).toBeVisible()
  await trigger.click()

  const drawer = page.getByTestId('distribution-drawer')
  await expect(drawer).toBeVisible({ timeout: 10000 })
  await expect(drawer).toHaveAttribute('role', 'dialog')
  // One row per employee on the roster, zero-shift workers included.
  await expect(page.getByTestId('distribution-row')).toHaveCount(3)

  // Tapping a worker reveals their day-by-day detail.
  const first = page.getByTestId('distribution-row').first()
  await expect(first).toHaveAttribute('aria-expanded', 'false')
  await first.click()
  await expect(first).toHaveAttribute('aria-expanded', 'true')

  // Escape closes it (the dialog-a11y hook).
  await page.keyboard.press('Escape')
  await expect(drawer).toBeHidden({ timeout: 8000 })

  // REGRESSION GUARD: the drawer must not disturb the existing per-worker chip
  // bar or the week table — they keep their own jobs.
  await expect(page.getByTestId('week-table')).toBeVisible()
  const chip = page.getByTestId('emp-total-chip').first()
  await expect(chip).toHaveAttribute('aria-pressed', 'false')
  await chip.click()
  await expect(chip).toHaveAttribute('aria-pressed', 'true')
})
