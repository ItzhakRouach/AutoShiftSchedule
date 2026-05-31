import { test, expect, type Page } from '@playwright/test'

/** Sign up → onboard → land on dashboard. */
async function signupAndOnboard(page: Page) {
  const uuid = crypto.randomUUID().replace(/-/g, '').slice(0, 12)
  const email = `mgr+${uuid}@example.com`
  const password = 'TestPass123!'

  await page.goto('/signup')
  await page.getByLabel('אימייל').fill(email)
  await page.getByLabel('סיסמה').fill(password)
  await page.getByRole('button', { name: 'הרשמה' }).click()
  await expect(page).toHaveURL(/\/onboarding/, { timeout: 15000 })

  await page.getByLabel('שם הארגון').fill(`ארגון ${uuid}`)
  await page.getByLabel('שם מקום העבודה').fill(`מקום עבודה ${uuid}`)
  await page.getByRole('button', { name: 'יצירת מקום עבודה' }).click()
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 })
}

/** Add an employee via the team UI, selecting all three roles. */
async function addEmployee(page: Page, name: string) {
  await page.getByRole('button', { name: 'הוסף עובד' }).click()
  await expect(page.getByRole('heading', { name: 'עובד חדש' })).toBeVisible({ timeout: 5000 })
  await page.getByLabel('שם מלא').fill(name)
  // Select all three role switches so the employee can fill any required role.
  const roleSwitches = page.getByRole('switch')
  for (let i = 0; i < 3; i++) {
    await roleSwitches.nth(i).click()
  }
  await page.getByRole('button', { name: 'הוספת עובד' }).click()
  await expect(page.getByRole('heading', { name: 'עובד חדש' })).toBeHidden({ timeout: 10000 })
}

test('manager generates an auto schedule and sees coverage + assignments', async ({ page }) => {
  test.setTimeout(120_000)
  await signupAndOnboard(page)

  // Go to team and add 3 employees, each with all roles.
  await page.goto('/team')
  await expect(page).toHaveURL(/\/team/, { timeout: 10000 })

  await addEmployee(page, 'דנה כהן')
  await addEmployee(page, 'יוסי לוי')
  await addEmployee(page, 'מאיה בר')

  // Navigate to /schedule.
  await page.goto('/schedule')
  await expect(page.getByRole('heading', { name: 'שיבוץ אוטומטי' })).toBeVisible({ timeout: 10000 })

  // Generate the schedule.
  await page.getByRole('button', { name: 'צור סידור אוטומטי' }).click()

  // Coverage value should render.
  const coverage = page.getByTestId('coverage')
  await expect(coverage).toBeVisible({ timeout: 30000 })
  await expect(coverage).toHaveText(/\d+%/)

  // At least one of the added employees should appear assigned in the grid.
  // The day grid renders employee name chips. Search across all 7 days.
  let foundAssigned = false
  for (let d = 0; d < 7 && !foundAssigned; d++) {
    const dayBtn = page.getByRole('button', { name: new RegExp(`^[א-ת]׳`) }).nth(d)
    if (await dayBtn.count()) await dayBtn.click()
    if (
      (await page.getByText('דנה כהן').count()) ||
      (await page.getByText('יוסי לוי').count()) ||
      (await page.getByText('מאיה בר').count())
    ) {
      foundAssigned = true
    }
  }
  expect(foundAssigned).toBe(true)
})
