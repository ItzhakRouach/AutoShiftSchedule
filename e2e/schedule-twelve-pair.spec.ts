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
  const roleSwitches = page.getByRole('switch')
  for (let i = 0; i < 3; i++) await roleSwitches.nth(i).click()
  await page.getByRole('button', { name: 'הוספת עובד' }).click()
  await expect(page.getByRole('heading', { name: 'עובד חדש' })).toBeHidden({ timeout: 10000 })
}

test('manager applies a day-level 12h pair via the wizard', async ({ page }) => {
  test.setTimeout(120_000)
  await signupAndOnboard(page)

  await page.goto('/team')
  await expect(page).toHaveURL(/\/team/, { timeout: 10000 })
  await addEmployee(page, 'דנה כהן')
  await addEmployee(page, 'יוסי לוי')
  await addEmployee(page, 'מאיה בר')
  await addEmployee(page, 'אורי טל')

  await page.goto('/schedule')
  await expect(page.getByRole('heading', { name: 'שיבוץ אוטומטי' })).toBeVisible({ timeout: 10000 })
  await page.getByRole('button', { name: 'צור סידור אוטומטי' }).click()
  await expect(page.getByTestId('coverage')).toBeVisible({ timeout: 30000 })

  // Open the wizard on the LAST day of the week: its night 12h block extends past
  // the period end, so it won't rest-conflict with a next-day morning shift,
  // making a valid morning+night pair reliably available.
  await page.getByTestId('day-pair-btn').last().click()
  await expect(page.getByText('בחרו תפקיד')).toBeVisible({ timeout: 8000 })

  // Choose the first role.
  await page.locator('button', { hasText: /אחמ|מוקדן|מאבטח/ }).first().click()
  await expect(page.getByText(/עובד בוקר/)).toBeVisible({ timeout: 8000 })

  // Both lists render the SAME employees in the SAME order. Pick the first
  // enabled morning candidate, then a night candidate at a DIFFERENT list index
  // (server rejects the same employee for both slots). Only truly-eligible
  // candidates are enabled now, so any enabled pick validates server-side.
  const morningBtns = page.getByTestId('pair-morning').locator('button')
  const nightBtns = page.getByTestId('pair-night').locator('button')
  const total = await morningBtns.count()
  await expect(page.getByTestId('pair-morning').locator('button:not([disabled])').first()).toBeVisible({ timeout: 8000 })

  let mIdx = -1
  for (let i = 0; i < total; i++) {
    if (await morningBtns.nth(i).isEnabled()) { mIdx = i; await morningBtns.nth(i).click(); break }
  }
  expect(mIdx).toBeGreaterThanOrEqual(0)
  let clicked = false
  for (let i = 0; i < total; i++) {
    if (i !== mIdx && (await nightBtns.nth(i).isEnabled())) { await nightBtns.nth(i).click(); clicked = true; break }
  }
  expect(clicked).toBe(true)

  await page.getByRole('button', { name: 'החל צמד 12 שעות' }).click()
  // Success warning appears inline.
  await expect(page.getByText(/הוחל צמד 12 שעות/)).toBeVisible({ timeout: 8000 })

  // Close + reload, then assert a -12 marker exists in the grid.
  await page.mouse.click(5, 5)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'שיבוץ אוטומטי' })).toBeVisible({ timeout: 10000 })
  const twelveMarker = page.getByTestId('week-table').locator('text=-12').first()
  expect(await twelveMarker.count()).toBeGreaterThan(0)
})

test('apply is gated until both morning and night are chosen', async ({ page }) => {
  test.setTimeout(120_000)
  await signupAndOnboard(page)
  await page.goto('/team')
  await addEmployee(page, 'רון שמש')
  await addEmployee(page, 'גל ניר')
  await addEmployee(page, 'תמר זיו')

  await page.goto('/schedule')
  await page.getByRole('button', { name: 'צור סידור אוטומטי' }).click()
  await expect(page.getByTestId('coverage')).toBeVisible({ timeout: 30000 })

  await page.getByTestId('day-pair-btn').first().click()
  await expect(page.getByText('בחרו תפקיד')).toBeVisible({ timeout: 8000 })
  await page.locator('button', { hasText: /אחמ|מוקדן|מאבטח/ }).first().click()
  await expect(page.getByText(/עובד בוקר/)).toBeVisible({ timeout: 8000 })

  // Apply button is disabled before any picks.
  const applyBtn = page.getByRole('button', { name: 'החל צמד 12 שעות' })
  await expect(applyBtn).toBeDisabled()

  // After choosing only a morning candidate, apply is still disabled.
  await page.getByTestId('pair-morning').locator('button:not([disabled])').first().click()
  await expect(applyBtn).toBeDisabled()
})
