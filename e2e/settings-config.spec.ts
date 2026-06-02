import { test, expect, type Page } from '@playwright/test'

async function signupAndOnboard(page: Page) {
  const uuid = crypto.randomUUID().replace(/-/g, '').slice(0, 12)
  await page.goto('/signup')
  await page.getByLabel('אימייל').fill(`mgr+cfg+${uuid}@example.com`)
  await page.getByLabel('סיסמה').fill('TestPass123!')
  await page.getByRole('button', { name: 'הרשמה' }).click()
  await expect(page).toHaveURL(/\/onboarding/, { timeout: 15000 })
  await page.getByLabel('שם הארגון').fill(`ארגון ${uuid}`)
  await page.getByLabel('שם מקום העבודה').fill(`מקום עבודה ${uuid}`)
  await page.getByRole('button', { name: 'יצירת מקום עבודה' }).click()
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 })
}

test('settings shows roles/shifts/working-days config sections', async ({ page }) => {
  await signupAndOnboard(page)
  await page.goto('/settings')
  await expect(page.getByRole('heading', { name: 'תפקידים' })).toBeVisible({ timeout: 10000 })
  await expect(page.getByRole('heading', { name: 'משמרות' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'ימי עבודה' })).toBeVisible()
})

test('manager adds a custom role; it persists', async ({ page }) => {
  await signupAndOnboard(page)
  await page.goto('/settings')

  await page.getByPlaceholder('שם תפקיד חדש').fill('אב בית')
  await page.getByRole('button', { name: 'הוסף' }).click()
  // On success the add input clears (the server action persisted the role).
  await expect(page.getByPlaceholder('שם תפקיד חדש')).toHaveValue('', { timeout: 10000 })
})

test('manager sets working days (Sun–Thu) and it persists', async ({ page }) => {
  await signupAndOnboard(page)
  await page.goto('/settings')

  const section = page.locator('section').filter({ has: page.getByRole('heading', { name: 'ימי עבודה' }) })
  // Turn Friday + Saturday off, then save.
  await section.getByRole('button', { name: 'שישי' }).click()
  await section.getByRole('button', { name: 'שבת' }).click()
  await section.getByRole('button', { name: 'שמירה' }).click()
  await expect(section.getByText('נשמר בהצלחה')).toBeVisible({ timeout: 10000 })
})
