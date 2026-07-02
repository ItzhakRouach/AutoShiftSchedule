import { test, expect, type Page } from '@playwright/test'

/** Sign up → onboard → land on dashboard. */
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

/** Add an employee via the team UI, with a phone number (required field). */
async function addEmployee(page: Page, name: string) {
  await page.getByRole('button', { name: 'הוסף עובד' }).click()
  await expect(page.getByRole('heading', { name: 'עובד חדש' })).toBeVisible({ timeout: 5000 })
  await page.getByLabel('שם מלא').fill(name)
  await page.getByLabel('טלפון').fill(`05${Math.floor(10000000 + Math.random() * 90000000)}`)
  await page.getByRole('switch').first().click()
  await page.getByRole('button', { name: 'הוספת עובד' }).click()
  await expect(page.getByRole('heading', { name: 'עובד חדש' })).toBeHidden({ timeout: 10000 })
}

test('manager sets a vacation, a מילואים and a מחלה range for workers from the requests view', async ({ page }) => {
  test.setTimeout(120_000)
  await signupAndOnboard(page)

  await page.goto('/team')
  await expect(page).toHaveURL(/\/team/, { timeout: 10000 })
  await addEmployee(page, 'דנה כהן')
  await addEmployee(page, 'יוסי לוי')
  await addEmployee(page, 'מאיה בר')

  await page.goto('/schedule')
  await expect(page.getByRole('heading', { name: 'סידור עבודה' })).toBeVisible({ timeout: 10000 })

  // Switch to "בקשות עובדים".
  await page.getByRole('button', { name: 'בקשות עובדים' }).click()
  await expect(page.getByTestId('requests-overview')).toBeVisible({ timeout: 10000 })

  // ── 1. Open דנה כהן's היעדרות sheet and add an ordinary vacation range ─────
  const danaRow = page.locator('tr').filter({ hasText: 'דנה כהן' })
  await danaRow.getByRole('button', { name: 'היעדרות' }).click()

  await expect(page.getByRole('heading', { name: /היעדרות — דנה כהן/ })).toBeVisible({ timeout: 8000 })
  await page.getByLabel('תאריך התחלה').fill('2026-07-10')
  await page.getByLabel('תאריך סיום').fill('2026-07-12')
  await page.getByRole('button', { name: 'הוסף היעדרות' }).click()

  // Server round-trip via router.refresh() — the range appears in the sheet's
  // existing-entries list, already approved (manager IS the approver).
  const vacationRangeText = 'יום שישי 10.7 — יום ראשון 12.7'
  await expect(page.getByText(vacationRangeText)).toBeVisible({ timeout: 10000 })
  await expect(page.getByText('אושר ✓')).toBeVisible()

  // Close the sheet via backdrop click before opening the next one (Sheet.tsx
  // closes on backdrop click; the panel is bottom-anchored so the top-left
  // corner is always backdrop, never the panel content).
  await page.locator('body').click({ position: { x: 5, y: 5 } })
  await expect(page.getByRole('heading', { name: /היעדרות — דנה כהן/ })).toBeHidden({ timeout: 5000 })

  // ── 2. Open יוסי לוי's sheet and add a מילואים range ───────────────────────
  const yossiRow = page.locator('tr').filter({ hasText: 'יוסי לוי' })
  await yossiRow.getByRole('button', { name: 'היעדרות' }).click()
  await expect(page.getByRole('heading', { name: /היעדרות — יוסי לוי/ })).toBeVisible({ timeout: 8000 })

  await page.getByRole('button', { name: 'מילואים', exact: true }).click()
  await page.getByLabel('תאריך התחלה').fill('2026-08-01')
  await page.getByLabel('תאריך סיום').fill('2026-08-05')
  await page.getByRole('button', { name: 'הוסף היעדרות' }).click()

  await expect(page.getByText('יום שבת 1.8 — יום רביעי 5.8')).toBeVisible({ timeout: 10000 })
  // The מילואים kind chip appears alongside the approved-status chip.
  await expect(page.locator('span').filter({ hasText: 'מילואים' })).toBeVisible()

  // ── 3. Remove the מילואים entry — the "הסר" undo path ──────────────────────
  await page.getByRole('button', { name: 'הסר' }).first().click()
  await expect(page.getByText('אין היעדרויות מוגדרות')).toBeVisible({ timeout: 10000 });

  // Close before opening the next worker's sheet.
  await page.locator('body').click({ position: { x: 5, y: 5 } });
  await expect(page.getByRole('heading', { name: /היעדרות — יוסי לוי/ })).toBeHidden({ timeout: 5000 });

  // ── 4. Open מאיה בר's sheet and add a מחלה range ───────────────────────────
  const mayaRow = page.locator('tr').filter({ hasText: 'מאיה בר' })
  await mayaRow.getByRole('button', { name: 'היעדרות' }).click()
  await expect(page.getByRole('heading', { name: /היעדרות — מאיה בר/ })).toBeVisible({ timeout: 8000 })

  await page.getByRole('button', { name: 'מחלה', exact: true }).click()
  await page.getByLabel('תאריך התחלה').fill('2026-07-15')
  await page.getByLabel('תאריך סיום').fill('2026-07-16')
  await page.getByRole('button', { name: 'הוסף היעדרות' }).click()

  await expect(page.getByText('יום רביעי 15.7 — יום חמישי 16.7')).toBeVisible({ timeout: 10000 })
  // The מחלה kind chip appears alongside the approved-status chip.
  await expect(page.locator('span').filter({ hasText: 'מחלה' })).toBeVisible()
})
