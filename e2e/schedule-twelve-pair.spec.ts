import { test, expect, type Page } from '@playwright/test'

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
  // Senior role (אחמ״ש) auto-qualifies for all lower roles via the rank hierarchy.
  await page.getByRole('switch').first().click()
  await page.getByRole('button', { name: 'הוספת עובד' }).click()
  await expect(page.getByRole('heading', { name: 'עובד חדש' })).toBeHidden({ timeout: 10000 })
}

/**
 * Open the 12h-pair wizard on the first day that can actually form a pair (a role
 * with both a morning and a night assignee). Returns true and leaves the sheet
 * open with the role list visible, or false if no day is formable.
 */
async function openFormableDay(page: Page): Promise<boolean> {
  const dayBtns = page.getByTestId('day-pair-btn')
  const count = await dayBtns.count()
  for (let i = 0; i < count; i++) {
    await dayBtns.nth(i).click()
    await expect(page.getByText(/צמד 12 שעות/)).toBeVisible({ timeout: 5000 })
    if (await page.getByText('בחרו תפקיד').isVisible()) return true
    await page.mouse.click(5, 5)
    await expect(page.getByText(/צמד 12 שעות/)).toBeHidden({ timeout: 5000 })
  }
  return false
}

// Enough staff that the auto-scheduler fully covers at least one day → a role with
// both a morning and a night assignee exists, so a 12h pair is formable.
async function seedStaffAndSchedule(page: Page) {
  await page.goto('/team')
  await expect(page).toHaveURL(/\/team/, { timeout: 10000 })
  for (let i = 0; i < 10; i++) await addEmployee(page, `עובד ${i + 1}`)

  await page.goto('/schedule')
  await expect(page.getByRole('heading', { name: 'שיבוץ אוטומטי' })).toBeVisible({ timeout: 10000 })
  await page.getByRole('button', { name: 'צור סידור אוטומטי' }).click()
  await expect(page.getByTestId('coverage')).toBeVisible({ timeout: 30000 })
}

test('12h pair offers only the day\'s assigned staff and applies', async ({ page }) => {
  test.setTimeout(180_000)
  await signupAndOnboard(page)
  await seedStaffAndSchedule(page)

  expect(await openFormableDay(page)).toBe(true)

  await page.locator('button', { hasText: /אחמ|מוקדן|מאבטח/ }).first().click()
  await expect(page.getByText(/עובד בוקר/)).toBeVisible({ timeout: 8000 })

  // Candidates come from the day's existing morning / night assignments.
  await expect(page.getByTestId('pair-morning').locator('button').first()).toBeVisible({ timeout: 8000 })
  await page.getByTestId('pair-morning').locator('button').first().click()
  await page.getByTestId('pair-night').locator('button').first().click()

  await page.getByRole('button', { name: 'החל צמד 12 שעות' }).click()
  await expect(page.getByText(/הוחל צמד 12 שעות/)).toBeVisible({ timeout: 8000 })

  await page.mouse.click(5, 5)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'שיבוץ אוטומטי' })).toBeVisible({ timeout: 10000 })
  const twelveMarker = page.getByTestId('week-table').locator('text=-12').first()
  expect(await twelveMarker.count()).toBeGreaterThan(0)
})

test('apply is gated until both morning and night are chosen', async ({ page }) => {
  test.setTimeout(180_000)
  await signupAndOnboard(page)
  await seedStaffAndSchedule(page)

  expect(await openFormableDay(page)).toBe(true)
  await page.locator('button', { hasText: /אחמ|מוקדן|מאבטח/ }).first().click()
  await expect(page.getByText(/עובד בוקר/)).toBeVisible({ timeout: 8000 })

  const applyBtn = page.getByRole('button', { name: 'החל צמד 12 שעות' })
  await expect(applyBtn).toBeDisabled()

  await page.getByTestId('pair-morning').locator('button').first().click()
  await expect(applyBtn).toBeDisabled()
})
