import { test, expect, type Page } from '@playwright/test'

async function signupAndOnboard(page: Page, uuid: string) {
  await page.goto('/signup')
  await page.getByLabel('אימייל').fill(`mgr+wp+${uuid}@example.com`)
  await page.getByLabel('סיסמה').fill('TestPass123!')
  await page.getByRole('button', { name: 'הרשמה' }).click()
  await expect(page).toHaveURL(/\/onboarding/, { timeout: 15000 })
  await page.getByLabel('שם הארגון').fill(`ארגון ${uuid}`)
  await page.getByLabel('שם מקום העבודה').fill(`סניף ראשי ${uuid}`)
  await page.getByRole('button', { name: 'יצירת מקום עבודה' }).click()
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 })
}

test('manager adds a second workplace and switches between them', async ({ page }) => {
  test.setTimeout(90_000)
  const uuid = crypto.randomUUID().replace(/-/g, '').slice(0, 10)
  await signupAndOnboard(page, uuid)

  // Dashboard heading shows the first workplace; switcher present.
  await expect(page.getByRole('heading', { name: `סניף ראשי ${uuid}` })).toBeVisible({ timeout: 10000 })
  await expect(page.getByTestId('workplace-switcher')).toBeVisible()

  // Open switcher → add a second workplace.
  await page.getByTestId('workplace-switcher').click()
  await page.getByRole('button', { name: 'הוסף מקום עבודה' }).click()
  await page.getByPlaceholder('שם מקום העבודה החדש').fill(`סניף שני ${uuid}`)
  await page.getByRole('button', { name: 'צור מקום עבודה' }).click()

  // Lands back on dashboard, now active = the new workplace.
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 })
  await expect(page.getByRole('heading', { name: `סניף שני ${uuid}` })).toBeVisible({ timeout: 10000 })

  // Switch back to the first workplace via the switcher.
  await page.getByTestId('workplace-switcher').click()
  await page.getByRole('button', { name: `סניף ראשי ${uuid}` }).click()
  await expect(page.getByRole('heading', { name: `סניף ראשי ${uuid}` })).toBeVisible({ timeout: 10000 })
})
