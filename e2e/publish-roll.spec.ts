import { test, expect, type Page } from '@playwright/test'

/** Sign up → onboard → land on dashboard. (Duplicated from schedule-image.spec.ts — repo pattern.) */
async function signupAndOnboard(page: Page) {
  const uuid = crypto.randomUUID().replace(/-/g, '').slice(0, 12)
  const email = `roll+${uuid}@example.com`
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

async function addEmployee(page: Page, name: string) {
  await page.getByRole('button', { name: 'הוסף עובד' }).click()
  await expect(page.getByRole('heading', { name: 'עובד חדש' })).toBeVisible({ timeout: 5000 })
  await page.getByLabel('שם מלא').fill(name)
  await page.getByLabel('טלפון').fill(`05${Math.floor(10000000 + Math.random() * 90000000)}`)
  await page.getByRole('switch').first().click() // senior role
  await page.getByRole('button', { name: 'הוספת עובד' }).click()
  await expect(page.getByRole('heading', { name: 'עובד חדש' })).toBeHidden({ timeout: 10000 })
}

async function dismissCoverageIssues(page: Page) {
  const dismiss = page.getByRole('button', { name: 'הבנתי' })
  const appeared = await dismiss.waitFor({ state: 'visible', timeout: 4000 }).then(() => true, () => false)
  if (appeared) {
    await dismiss.click()
    await expect(dismiss).toBeHidden({ timeout: 5000 })
  }
}

/**
 * Regression for "הסידור לשבוע זה כבר פורסם" when adding worker requests:
 * publishing a week must ROLL the editor to the next week (like the employee
 * side), keep the published week reachable via ?w=, and let the manager enter
 * next week's requests without hitting the published-week guard.
 */
test('after publish, the editor rolls to the next week and requests stay editable', async ({ page }) => {
  test.setTimeout(180_000)
  await signupAndOnboard(page)

  await page.goto('/team')
  await expect(page).toHaveURL(/\/team/, { timeout: 10000 })
  await addEmployee(page, 'דנה כהן')
  await addEmployee(page, 'יוסי לוי')
  await addEmployee(page, 'מאיה בר')

  // Generate + publish the editing week.
  await page.goto('/schedule')
  await expect(page.getByRole('heading', { name: 'סידור עבודה' })).toBeVisible({ timeout: 10000 })
  const weekLabelBefore = await page.getByTestId('editing-week-label').textContent()
  await page.getByRole('button', { name: 'צור סידור אוטומטי' }).click()
  await expect(page.getByTestId('coverage')).toBeVisible({ timeout: 30000 })
  await dismissCoverageIssues(page)

  await page.getByRole('button', { name: 'פרסם סידור' }).click()
  const confirmPublish = page.getByRole('button', { name: /לחצו שוב לפרסום/ })
  await confirmPublish.click({ timeout: 3000 }).catch(() => {}) // absent when coverage is full
  await expect(page.getByRole('button', { name: /פורסם/ })).toBeVisible({ timeout: 15000 })

  // Publishing pins the URL to the published week (?w=) so the share/unpublish
  // controls stay on screen instead of the editor jumping forward mid-session.
  await expect(page).toHaveURL(/\/schedule\?w=/, { timeout: 30000 })
  await expect(page.getByTestId('editing-week-label')).toHaveText(weekLabelBefore!, { timeout: 15000 })

  // A fresh /schedule visit now edits the NEXT week, with the roll banner.
  await page.goto('/schedule')
  await expect(page.getByTestId('rolled-week-banner')).toBeVisible({ timeout: 15000 })
  const weekLabelAfter = await page.getByTestId('editing-week-label').textContent()
  expect(weekLabelAfter).not.toBe(weekLabelBefore)

  // THE regression: the manager can add a worker's request for the new week.
  await page.getByRole('button', { name: 'בקשות עובדים' }).click()
  await expect(page.getByTestId('requests-week-label')).toBeVisible({ timeout: 5000 })
  await page.locator('td[title="לחצו לעריכת הבקשה"]').first().click()
  await expect(page.getByRole('dialog', { name: 'עריכת בקשת משמרת' })).toBeVisible({ timeout: 5000 })
  await page.getByRole('button', { name: 'יום חופש / לא זמין' }).click()
  await page.getByRole('button', { name: 'שמירה', exact: true }).click()
  // Saved without the published-week guard error → the dialog closes.
  await expect(page.getByRole('dialog', { name: 'עריכת בקשת משמרת' })).toBeHidden({ timeout: 10000 })
  await expect(page.getByText(/כבר פורסם/)).toHaveCount(0)

  // The banner links back to the published week's LIVE view (unpublish there).
  await page.getByRole('link', { name: 'לשבוע שפורסם' }).click()
  await expect(page).toHaveURL(/\/schedule\?w=/, { timeout: 15000 })
  await expect(page.getByTestId('unpublish-schedule')).toBeVisible({ timeout: 15000 })

  // Unpublish (two-step confirm) → the default editor returns to that week.
  const unpub = page.getByTestId('unpublish-schedule')
  await unpub.click()
  await expect(unpub).toHaveText('לחצו שוב לאישור ביטול', { timeout: 2000 })
  await unpub.click()
  await expect(page.getByTestId('unpublish-schedule')).toBeHidden({ timeout: 30_000 })
  await page.goto('/schedule')
  await expect(page.getByTestId('editing-week-label')).toHaveText(weekLabelBefore!, { timeout: 15000 })
})
