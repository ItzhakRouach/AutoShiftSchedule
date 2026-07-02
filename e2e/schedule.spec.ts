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
  await page.getByLabel('טלפון').fill(`05${Math.floor(10000000 + Math.random() * 90000000)}`)
  // Select the most-senior role (אחמ״ש, rank 3). Via the role-rank hierarchy this
  // auto-qualifies the employee for the two lower roles too, so they can fill any.
  await page.getByRole('switch').first().click()
  await page.getByRole('button', { name: 'הוספת עובד' }).click()
  await expect(page.getByRole('heading', { name: 'עובד חדש' })).toBeHidden({ timeout: 10000 })
}

/** CoverageIssues is a fullscreen popup that auto-opens after generation
 *  whenever slots were left uncovered or off-requests overridden — nearly
 *  always with small e2e seeds. Its scrim swallows clicks, so dismiss it
 *  (if it appeared) before interacting with anything underneath. */
async function dismissCoverageIssues(page: Page) {
  const dismiss = page.getByRole('button', { name: 'הבנתי' })
  const appeared = await dismiss.waitFor({ state: 'visible', timeout: 4000 }).then(() => true, () => false)
  if (appeared) {
    await dismiss.click()
    await expect(dismiss).toBeHidden({ timeout: 5000 })
  }
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
  await expect(page.getByRole('heading', { name: 'סידור עבודה' })).toBeVisible({ timeout: 10000 })

  // Generate the schedule.
  await page.getByRole('button', { name: 'צור סידור אוטומטי' }).click()

  // Coverage value should render.
  const coverage = page.getByTestId('coverage')
  await expect(coverage).toBeVisible({ timeout: 30000 })
  await expect(coverage).toHaveText(/\d+%/)
  await dismissCoverageIssues(page)

  // Task 5: generation is 8h-only by default — if gaps remain, the secondary
  // "השלם 12ש׳ אוטומטית" button offers to complete coverage with 12h shifts.
  // Small e2e seeds may or may not leave gaps, so this is conditional.
  const completeTwelve = page.getByTestId('complete-twelve')
  if (await completeTwelve.count()) {
    await completeTwelve.click()
    await expect(coverage).toHaveText(/\d+%/, { timeout: 30000 })
  }

  // The week table should be visible (default view is "סידור").
  await expect(page.getByTestId('week-table')).toBeVisible({ timeout: 15000 })

  // At least one of the added employees should appear assigned in the week table.
  const weekTable = page.getByTestId('week-table')
  const foundAssigned =
    (await weekTable.getByText('דנה כהן').count()) > 0 ||
    (await weekTable.getByText('יוסי לוי').count()) > 0 ||
    (await weekTable.getByText('מאיה בר').count()) > 0
  expect(foundAssigned).toBe(true)

  // Toggle to "בקשות עובדים" — requests overview should appear.
  await page.getByRole('button', { name: 'בקשות עובדים' }).click()
  await expect(page.getByTestId('requests-overview')).toBeVisible({ timeout: 10000 })

  // The week-table should be hidden while in requests mode.
  await expect(page.getByTestId('week-table')).toBeHidden()

  // Toggle back to "סידור" — week table reappears.
  await page.getByRole('button', { name: 'סידור', exact: true }).click()
  await expect(page.getByTestId('week-table')).toBeVisible({ timeout: 10000 })
})
