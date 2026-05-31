import { test, expect, type Page } from '@playwright/test'

async function signupAndOnboard(page: Page) {
  const uuid = crypto.randomUUID().replace(/-/g, '').slice(0, 12)
  const email = `mgr+${uuid}@example.com`
  await page.goto('/signup')
  await page.getByLabel('אימייל').fill(email)
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

test('manager manually edits a slot and applies a 12h shift', async ({ page }) => {
  test.setTimeout(120_000)
  await signupAndOnboard(page)

  await page.goto('/team')
  await expect(page).toHaveURL(/\/team/, { timeout: 10000 })
  await addEmployee(page, 'דנה כהן')
  await addEmployee(page, 'יוסי לוי')
  await addEmployee(page, 'מאיה בר')

  await page.goto('/schedule')
  await expect(page.getByRole('heading', { name: 'שיבוץ אוטומטי' })).toBeVisible({ timeout: 10000 })
  await page.getByRole('button', { name: 'צור סידור אוטומטי' }).click()
  await expect(page.getByTestId('coverage')).toBeVisible({ timeout: 30000 })

  // Open a slot (either an assigned chip or an empty "לא מאויש" slot) on day 0.
  const slot = page.getByText('לא מאויש').first()
  const chip = page.getByText('דנה כהן').first()
  if (await slot.count()) await slot.click()
  else await chip.click()

  // The SwapEditor sheet should open with the candidate list heading.
  await expect(page.getByText('עובדים זמינים')).toBeVisible({ timeout: 8000 })

  // Click a candidate that is not disabled (זמין / ✓ ביקש / משובץ).
  const candidate = page
    .locator('button', { hasText: /זמין|ביקש|משובץ במשמרת אחרת/ })
    .first()
  if (await candidate.count()) {
    await candidate.click()
    await expect(page.getByText('עובדים זמינים')).toBeHidden({ timeout: 8000 })
  } else {
    // No legal candidate here; close the sheet via the backdrop.
    await page.mouse.click(5, 5)
    await expect(page.getByText('עובדים זמינים')).toBeHidden({ timeout: 8000 })
  }

  // Apply a 12h shift: reopen a slot and pick a 12h variant + employee.
  const slot2 = page.getByText('לא מאויש').first()
  if (await slot2.count()) await slot2.click()
  else await page.getByText('דנה כהן').first().click()
  await expect(page.getByText('החל משמרת 12 שעות')).toBeVisible({ timeout: 8000 })
  await page.getByRole('button', { name: 'יום 12ש׳' }).click()
  await page.getByRole('button', { name: /— 12ש׳$/ }).first().click()

  // The 12h warning should appear inline.
  await expect(page.getByText(/משמרת 12 שעות תופסת/)).toBeVisible({ timeout: 8000 })

  // Close the sheet (backdrop click) and confirm a 12ש׳ badge is in the grid.
  await page.mouse.click(5, 5)
  await expect(page.getByText('החל משמרת 12 שעות')).toBeHidden({ timeout: 8000 })

  // Reload to read the freshly persisted state, then find the 12ש׳ badge on
  // any day (it was applied on the selected day; search defensively).
  await page.reload()
  await expect(page.getByRole('heading', { name: 'שיבוץ אוטומטי' })).toBeVisible({ timeout: 10000 })
  const dayBtns = page.getByRole('button', { name: /^[א-ת]׳/ })
  let found = false
  const n = await dayBtns.count()
  for (let d = 0; d < n && !found; d++) {
    await dayBtns.nth(d).click()
    if (await page.getByTestId('twelve-badge').count()) found = true
  }
  expect(found).toBe(true)
})
