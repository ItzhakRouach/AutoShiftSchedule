import { test, expect, type Page } from '@playwright/test'

/** Mirrors src/lib/dates/week.ts#upcomingWeekStartISO — the requests grid
 *  only ever shows the upcoming week, so regression coverage for a day cell
 *  must target a real date inside it (not a fixed future date). */
function upcomingWeekStartISO(today: Date): string {
  const day = today.getDay()
  const daysUntilSunday = day === 0 ? 0 : 7 - day
  const sunday = new Date(today)
  sunday.setDate(today.getDate() + daysUntilSunday)
  const yyyy = sunday.getFullYear()
  const mm = String(sunday.getMonth() + 1).padStart(2, '0')
  const dd = String(sunday.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

/** ISO date for `offset` days after `iso`. */
function addDaysISO(iso: string, offset: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  date.setDate(date.getDate() + offset)
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

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
  // The מילואים kind chip appears alongside the approved-status chip (scoped
  // to the sheet panel — the row itself ALSO shows a מילואים week-marker badge
  // behind the sheet, so an unscoped locator would match both).
  const yossiSheet = page.getByRole('heading', { name: /היעדרות — יוסי לוי/ }).locator('..')
  await expect(yossiSheet.locator('span').filter({ hasText: 'מילואים' })).toBeVisible()

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
  // The מחלה kind chip appears alongside the approved-status chip (scoped to
  // the sheet panel — see the מילואים note above for why this must be scoped).
  const mayaSheet = page.getByRole('heading', { name: /היעדרות — מאיה בר/ }).locator('..')
  await expect(mayaSheet.locator('span').filter({ hasText: 'מחלה' })).toBeVisible()

  // Close before opening the next worker's sheet.
  await page.locator('body').click({ position: { x: 5, y: 5 } })
  await expect(page.getByRole('heading', { name: /היעדרות — מאיה בר/ })).toBeHidden({ timeout: 5000 })

  // ── 5. REGRESSION: a מילואים day cell in the "בקשות עובדים" grid must show
  // מילואים, not the generic חופשה label (the reported bug — the grid used a
  // kind-less boolean and a hardcoded חופשה/palm-tree label for ANY absence).
  const uuid2 = crypto.randomUUID().replace(/-/g, '').slice(0, 12)
  await page.goto('/team')
  await addEmployee(page, `רון גל ${uuid2}`)
  await page.goto('/schedule')
  await page.getByRole('button', { name: 'בקשות עובדים' }).click()
  await expect(page.getByTestId('requests-overview')).toBeVisible({ timeout: 10000 })

  const sunday = upcomingWeekStartISO(new Date())
  const tuesday = addDaysISO(sunday, 2) // a day guaranteed to render in the grid

  const ronRow = page.locator('tr').filter({ hasText: `רון גל ${uuid2}` })
  await ronRow.getByRole('button', { name: 'היעדרות' }).click()
  const ronHeading = page.getByRole('heading', { name: new RegExp(`היעדרות — רון גל ${uuid2}`) })
  await expect(ronHeading).toBeVisible({ timeout: 8000 })

  await page.getByRole('button', { name: 'מילואים', exact: true }).click()
  await page.getByLabel('תאריך התחלה').fill(tuesday)
  await page.getByLabel('תאריך סיום').fill(tuesday)
  await page.getByRole('button', { name: 'הוסף היעדרות' }).click()
  const ronSheet = ronHeading.locator('..')
  await expect(ronSheet.locator('span').filter({ hasText: 'מילואים' })).toBeVisible({ timeout: 10000 })

  await page.locator('body').click({ position: { x: 5, y: 5 } })
  await expect(ronHeading).toBeHidden({ timeout: 5000 })

  // The day cell for Tuesday now renders the מילואים label/color — never
  // "חופשה" and never the palm emoji.
  const dayCell = ronRow.getByTestId('vacation-cell')
  await expect(dayCell).toBeVisible({ timeout: 10000 })
  await expect(dayCell).toHaveText('מילואים')
  await expect(dayCell).not.toHaveText(/חופשה/)
  await expect(dayCell).not.toContainText('🌴')
})
