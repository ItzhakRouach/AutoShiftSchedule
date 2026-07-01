import { test, expect, type Page } from '@playwright/test'

async function signupAndOnboard(page: Page) {
  const uuid = crypto.randomUUID().replace(/-/g, '').slice(0, 12)
  await page.goto('/signup')
  await page.getByLabel('אימייל').fill(`mgr+note+${uuid}@example.com`)
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

test('manager assigns a רענון day note to an employee', async ({ page }) => {
  test.setTimeout(120_000)
  await signupAndOnboard(page)

  await page.goto('/team')
  await addEmployee(page, 'יצחק רואש')
  await addEmployee(page, 'דנה כהן')

  await page.goto('/schedule')
  await page.getByRole('button', { name: 'צור סידור אוטומטי' }).click()
  await expect(page.getByTestId('coverage')).toBeVisible({ timeout: 30000 })

  // Open the day-note editor, assign יצחק a רענון on day 2 (שלישי).
  await page.getByRole('button', { name: 'רענון / הערת יום' }).click()
  await page.getByTestId('note-day-2').click()
  await page.getByRole('combobox').selectOption({ label: 'יצחק רואש' })
  await page.getByRole('button', { name: 'רענון', exact: true }).click()
  await page.getByTestId('save-day-note').click()
  // Save clears the form fields on success.
  await expect(page.getByTestId('save-day-note')).toBeDisabled({ timeout: 10000 })

  // Reload — the note persists and shows in the summary panel under the table.
  await page.reload()
  const summary = page.getByTestId('day-notes-summary')
  await expect(summary).toBeVisible({ timeout: 10000 })
  await expect(summary).toContainText('רענון')
  await expect(summary).toContainText('יצחק')
})
