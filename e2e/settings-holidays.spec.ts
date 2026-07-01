import { test, expect, type Page } from '@playwright/test'

async function signupAndOnboard(page: Page) {
  const uuid = crypto.randomUUID().replace(/-/g, '').slice(0, 12)
  const email = `mgr+holidays+${uuid}@example.com`
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

test('settings page shows holidays section', async ({ page }) => {
  await signupAndOnboard(page)
  await page.goto('/settings')
  await expect(page.getByRole('heading', { name: 'לוח חגים' })).toBeVisible({ timeout: 10000 })
  await expect(page.getByText('אין חגים מוגדרים')).toBeVisible()
})

test('manager loads Israeli holidays for a year → at least one row appears', async ({ page }) => {
  await signupAndOnboard(page)
  await page.goto('/settings')

  // Set year to 2025 and load. Scoped to the הגדרות "לוח חגים" section — a
  // "מקסימום חופשים ליום" spinbutton was added elsewhere on the page, so an
  // unscoped getByRole('spinbutton') now matches 2 elements (strict-mode violation).
  const holidaysSection = page.locator('section', { has: page.getByRole('heading', { name: 'לוח חגים' }) })
  const yearInput = holidaysSection.getByRole('spinbutton')
  await yearInput.fill('2025')
  await page.getByRole('button', { name: /טען חגי ישראל לשנה/ }).click()

  // Wait for success or holiday rows to appear
  await expect(page.getByText('החגים נטענו')).toBeVisible({ timeout: 15000 })

  // Reload to confirm rows persisted
  await page.reload()
  await expect(page.getByRole('heading', { name: 'לוח חגים' })).toBeVisible({ timeout: 10000 })
  // At least one holiday row visible (Yom Kippur should be there)
  await expect(page.getByText('יוֹם כִּפּוּר').first()).toBeVisible({ timeout: 5000 })
})

test('manager adds custom holiday → appears; remove → gone', async ({ page }) => {
  await signupAndOnboard(page)
  await page.goto('/settings')

  // Expand the add-custom form
  await page.getByText('הוסף חג מותאם אישית').click()

  // Fill in date + name
  await page.getByRole('textbox', { name: /date|תאריך/i }).or(page.locator('input[type="date"]')).fill('2025-12-25')
  await page.getByPlaceholder('שם החג').fill('חג בדיקה')
  // Scoped to the <details> (implicit role="group") that wraps the add-custom
  // form — an unscoped getByRole('button', { name: 'הוסף' }) now also matches
  // the disabled "add role" button in the roles section (strict-mode violation).
  await page.getByRole('group').getByRole('button', { name: 'הוסף' }).click()

  await expect(page.getByText('חג בדיקה')).toBeVisible({ timeout: 10000 })

  // Remove the custom holiday
  const removeBtn = page.getByRole('button', { name: 'הסר' }).first()
  await removeBtn.click()

  // After removal the item should be gone
  await expect(page.getByText('חג בדיקה')).toBeHidden({ timeout: 10000 })
})
