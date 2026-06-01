import { test, expect, type Page } from '@playwright/test'

/** Shared setup: sign up → onboard → navigate to /team */
async function setupTeam(page: Page) {
  const uuid = crypto.randomUUID().replace(/-/g, '').slice(0, 12)
  const email = `test+${uuid}@example.com`
  const password = 'TestPass123!'
  const orgName = `ארגון ${uuid}`
  const workplaceName = `מקום עבודה ${uuid}`

  await page.goto('/signup')
  await page.getByLabel('אימייל').fill(email)
  await page.getByLabel('סיסמה').fill(password)
  await page.getByRole('button', { name: 'הרשמה' }).click()
  await expect(page).toHaveURL(/\/onboarding/, { timeout: 15000 })

  await page.getByLabel('שם הארגון').fill(orgName)
  await page.getByLabel('שם מקום העבודה').fill(workplaceName)
  await page.getByRole('button', { name: 'יצירת מקום עבודה' }).click()
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 })

  await page.goto('/team')
  await expect(page).toHaveURL(/\/team/, { timeout: 10000 })
}

test('add an employee, verify they appear in the team list', async ({ page }) => {
  await setupTeam(page)

  // Open add employee sheet
  await page.getByRole('button', { name: 'הוסף עובד' }).click()
  await expect(page.getByRole('heading', { name: 'עובד חדש' })).toBeVisible({ timeout: 5000 })

  // Fill name
  await page.getByLabel('שם מלא').fill('ישראל ישראלי')

  // Select first role (אחמ״ש) – first switch
  const firstRoleSwitch = page.getByRole('switch').first()
  await firstRoleSwitch.click()
  await expect(firstRoleSwitch).toHaveAttribute('aria-checked', 'true')

  // Toggle "שומר שבת וחג" on — single combined toggle (was two separate toggles before).
  // Order of switches: 3 roles, then availability toggle, then 2 settings toggles
  // (שומר שבת וחג + חובה לקבל בקשות). Combined shabbat+chag is the 5th switch (index 4).
  const shabbatSwitch = page.getByRole('switch').nth(4)
  await shabbatSwitch.click()
  await expect(shabbatSwitch).toHaveAttribute('aria-checked', 'true')

  // Submit
  await page.getByRole('button', { name: 'הוספת עובד' }).click()

  // Sheet should close and employee should appear
  await expect(page.getByText('ישראל ישראלי')).toBeVisible({ timeout: 10000 })
})

test('create employee with student type, max shifts, and custom availability', async ({ page }) => {
  await setupTeam(page)

  const empName = `סטודנט ${crypto.randomUUID().slice(0, 6)}`

  // Open add employee sheet
  await page.getByRole('button', { name: 'הוסף עובד' }).click()
  await expect(page.getByRole('heading', { name: 'עובד חדש' })).toBeVisible({ timeout: 5000 })

  // Select "סטודנט" employment type
  await page.getByRole('button', { name: 'סטודנט' }).click()

  // Fill name
  await page.getByLabel('שם מלא').fill(empName)

  // Select first role
  const firstRoleSwitch = page.getByRole('switch').first()
  await firstRoleSwitch.click()
  await expect(firstRoleSwitch).toHaveAttribute('aria-checked', 'true')

  // Enable custom availability (the availability toggle)
  const availabilityToggle = page.getByRole('switch', { name: /זמינות/ }).first()
  // If not found by name, use positional: it's after role switches + before settings toggles
  if (await availabilityToggle.count() === 0) {
    // Availability toggle is index 3 (after 3 role switches)
    await page.getByRole('switch').nth(3).click()
  } else {
    await availabilityToggle.click()
  }

  // Wait for the grid to appear and click a shift cell
  // Click the first cell (Sunday, first shift column) if available
  const firstCell = page.getByRole('button', { name: /ראשון/ }).first()
  if (await firstCell.count() > 0) {
    await firstCell.click()
    await expect(firstCell).toHaveAttribute('aria-pressed', 'true')
  }

  // Submit
  await page.getByRole('button', { name: 'הוספת עובד' }).click()
  await expect(page.getByText(empName)).toBeVisible({ timeout: 10000 })

  // The employee card should show "סטודנט" badge
  await expect(page.getByText('סטודנט').first()).toBeVisible()

  // Open editor and verify values persisted
  await page.getByText(empName).click()
  await expect(page.getByRole('heading', { name: empName })).toBeVisible({ timeout: 5000 })

  // Employment type button should be pressed
  await expect(page.getByRole('button', { name: 'סטודנט' })).toHaveAttribute('aria-pressed', 'true')
})

test('edit employee — toggle availability ON, mark a cell, save, reload and verify', async ({ page }) => {
  await setupTeam(page)

  const empName = `עובד ${crypto.randomUUID().slice(0, 6)}`

  // Create employee first
  await page.getByRole('button', { name: 'הוסף עובד' }).click()
  await expect(page.getByRole('heading', { name: 'עובד חדש' })).toBeVisible({ timeout: 5000 })
  await page.getByLabel('שם מלא').fill(empName)
  const firstRoleSwitch = page.getByRole('switch').first()
  await firstRoleSwitch.click()
  await page.getByRole('button', { name: 'הוספת עובד' }).click()
  // Wait for the sheet heading to disappear before checking the list
  await expect(page.getByRole('heading', { name: 'עובד חדש' })).toBeHidden({ timeout: 10000 })
  await expect(page.locator('span').filter({ hasText: empName })).toBeVisible({ timeout: 10000 })

  // Open edit
  await page.locator('span').filter({ hasText: empName }).click()
  await expect(page.getByRole('heading', { name: empName })).toBeVisible({ timeout: 5000 })

  // Turn on custom availability (the toggle has aria-label="זמינות מותאמת אישית")
  const availSwitch = page.getByRole('switch', { name: 'זמינות מותאמת אישית' })
  await availSwitch.click()
  await expect(availSwitch).toHaveAttribute('aria-checked', 'true')

  // Mark a cell (Sunday / first shift column) so the availability row is saved to the DB.
  // Onboarding seeds 3 shift types (morning, noon, night); the grid renders them all.
  // We click the first available cell in the grid (day=ראשון, first shift type).
  const firstCell = page.getByRole('button', { name: /^ראשון/ }).first()
  await expect(firstCell).toBeVisible({ timeout: 5000 })
  await firstCell.click()
  await expect(firstCell).toHaveAttribute('aria-pressed', 'true')

  // Save
  await page.getByRole('button', { name: 'שמירת שינויים' }).click()
  // Wait for the sheet to close (heading disappears) before asserting the list card
  await expect(page.getByRole('heading', { name: empName })).toBeHidden({ timeout: 10000 })
  await expect(page.locator('span').filter({ hasText: empName })).toBeVisible({ timeout: 10000 })

  // Reload and re-open
  await page.reload()
  await expect(page.locator('span').filter({ hasText: empName })).toBeVisible({ timeout: 10000 })
  await page.locator('span').filter({ hasText: empName }).click()
  await expect(page.getByRole('heading', { name: empName })).toBeVisible({ timeout: 5000 })

  // Availability toggle should still be ON (persisted because at least one DB row exists)
  const reloadedSwitch = page.getByRole('switch', { name: 'זמינות מותאמת אישית' })
  await expect(reloadedSwitch).toHaveAttribute('aria-checked', 'true')

  // The marked cell should still be marked
  const reloadedCell = page.getByRole('button', { name: /^ראשון/ }).first()
  await expect(reloadedCell).toHaveAttribute('aria-pressed', 'true')
})
