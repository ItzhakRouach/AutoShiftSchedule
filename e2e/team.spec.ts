import { test, expect } from '@playwright/test'

test('add an employee, verify they appear in the team list', async ({ page }) => {
  const uuid = crypto.randomUUID().replace(/-/g, '').slice(0, 12)
  const email = `test+${uuid}@example.com`
  const password = 'TestPass123!'
  const orgName = `ארגון ${uuid}`
  const workplaceName = `מקום עבודה ${uuid}`

  // 1. Sign up
  await page.goto('/signup')
  await page.getByLabel('אימייל').fill(email)
  await page.getByLabel('סיסמה').fill(password)
  await page.getByRole('button', { name: 'הרשמה' }).click()
  await expect(page).toHaveURL(/\/onboarding/, { timeout: 15000 })

  // 2. Complete onboarding
  await page.getByLabel('שם הארגון').fill(orgName)
  await page.getByLabel('שם מקום העבודה').fill(workplaceName)
  await page.getByRole('button', { name: 'יצירת מקום עבודה' }).click()
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 })

  // 3. Navigate to /team via the dashboard link
  await page.getByRole('link', { name: 'ניהול עובדים' }).click()
  await expect(page).toHaveURL(/\/team/, { timeout: 10000 })

  // 4. Open the add employee sheet
  await page.getByRole('button', { name: 'הוסף עובד' }).click()

  // Wait for the sheet to be visible
  await expect(page.getByRole('heading', { name: 'עובד חדש' })).toBeVisible({ timeout: 5000 })

  // 5. Fill in the employee name
  await page.getByLabel('שם מלא').fill('ישראל ישראלי')

  // 6. Select the first role (אחמ״ש) by clicking the role's switch button directly.
  //    The Toggle now has stopPropagation so it won't double-fire.
  //    The role row switches are the first 3 switches in the page.
  const firstRoleSwitch = page.getByRole('switch').first()
  await firstRoleSwitch.click()
  // Confirm the role is now checked
  await expect(firstRoleSwitch).toHaveAttribute('aria-checked', 'true')

  // 7. Toggle שומר שבת on — it's the 4th switch (index 3: after 3 role switches)
  const shabbatSwitch = page.getByRole('switch').nth(3)
  await shabbatSwitch.click()
  await expect(shabbatSwitch).toHaveAttribute('aria-checked', 'true')

  // 8. Submit
  await page.getByRole('button', { name: 'הוספת עובד' }).click()

  // 9. Sheet should close and employee should appear in the list
  await expect(page.getByText('ישראל ישראלי')).toBeVisible({ timeout: 10000 })
})
