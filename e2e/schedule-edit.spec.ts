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
  // Senior role (אחמ״ש) auto-qualifies for all lower roles via the rank hierarchy.
  await page.getByRole('switch').first().click()
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

  // Click a strictly-available candidate (זמין / ביקש) to avoid the double-book
  // warning path that keeps the sheet open. Fall back to backdrop close if none.
  const strictCandidate = page
    .locator('button', { hasText: /זמין|ביקש/ })
    .first()
  if (await strictCandidate.count()) {
    await strictCandidate.click()
  }
  // Whether or not auto-closed, ensure the sheet is gone before continuing.
  const sheetStillOpen = await page.getByText('עובדים זמינים').isVisible()
  if (sheetStillOpen) await page.mouse.click(5, 5)
  await expect(page.getByText('עובדים זמינים')).toBeHidden({ timeout: 8000 })

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

  // Reload to read the freshly persisted state, then find a -12 marker in the
  // week table (the WeekTable renders 12h cells with a "-12" suffix).
  await page.reload()
  await expect(page.getByRole('heading', { name: 'שיבוץ אוטומטי' })).toBeVisible({ timeout: 10000 })
  // The -12 suffix appears inside cells that hold a 12h assignment.
  // It may be rendered after reload once the grid shows the persisted assignment.
  const twelveMarker = page.getByTestId('week-table').locator('text=-12').first()
  const found = (await twelveMarker.count()) > 0
  expect(found).toBe(true)
})

test('assigning an employee already scheduled elsewhere that day requires in-sheet confirm', async ({ page }) => {
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

  // Find an employee already assigned to some shift on day 0 (auto-scheduler
  // should have booked at least one), then open a DIFFERENT, empty shift on
  // that same day so the candidate list shows them as "assigned elsewhere".
  const weekTable = page.getByTestId('week-table')
  const dayCells = weekTable.locator('tbody tr td:nth-child(3)') // first day column
  const cellCount = await dayCells.count()
  let assignedName: string | null = null
  let emptyCellIndex = -1
  for (let i = 0; i < cellCount; i++) {
    const text = (await dayCells.nth(i).innerText()).trim()
    if (text === 'לא מאויש' && emptyCellIndex === -1) emptyCellIndex = i
    else if (assignedName === null && text && text !== 'לא מאויש' && !text.includes('12ש׳')) assignedName = text
  }
  test.skip(assignedName === null || emptyCellIndex === -1, 'auto-scheduler did not produce the day-0 mix this test needs')

  await dayCells.nth(emptyCellIndex).click()
  await expect(page.getByText('עובדים זמינים')).toBeVisible({ timeout: 8000 })

  const candidateBtn = page.locator('button', { hasText: 'משובץ במשמרת אחרת' }).first()
  test.skip((await candidateBtn.count()) === 0, 'no candidate is booked elsewhere on this day in this run')

  // Tapping the candidate must NOT assign immediately — it opens an inline
  // confirm strip (native window.confirm is unreliable/silent in PWAs).
  await candidateBtn.click()
  await expect(page.getByText('עובד זה כבר משובץ במשמרת אחרת ביום זה')).toBeVisible({ timeout: 5000 })

  // ביטול leaves the schedule unchanged: the confirm strip closes, no success
  // message appears, and the target cell is still unfilled.
  await page.getByRole('button', { name: 'ביטול' }).click()
  await expect(page.getByText('עובד זה כבר משובץ במשמרת אחרת ביום זה')).toBeHidden({ timeout: 5000 })
  await expect(page.getByText('שובץ ✓')).toBeHidden()
  await page.mouse.click(5, 5)
  await expect(page.getByText('עובדים זמינים')).toBeHidden({ timeout: 8000 })
  await expect(dayCells.nth(emptyCellIndex)).toHaveText('לא מאויש')

  // Reopen and this time confirm the move with העבר — it completes via the
  // same assignSlot path and the target cell picks up the moved employee.
  await dayCells.nth(emptyCellIndex).click()
  await expect(page.getByText('עובדים זמינים')).toBeVisible({ timeout: 8000 })
  await page.locator('button', { hasText: 'משובץ במשמרת אחרת' }).first().click()
  await expect(page.getByText('עובד זה כבר משובץ במשמרת אחרת ביום זה')).toBeVisible({ timeout: 5000 })
  await page.getByRole('button', { name: 'העבר' }).click()
  await expect(page.getByText('שובץ ✓')).toBeVisible({ timeout: 5000 })
  await expect(page.getByText('עובדים זמינים')).toBeHidden({ timeout: 8000 })
  await expect(dayCells.nth(emptyCellIndex)).toContainText(assignedName!)
})

test('clicking a worker chip opens the editor; highlight lives only in the totals bar', async ({ page }) => {
  test.setTimeout(120_000)
  await signupAndOnboard(page)

  await page.goto('/team')
  await expect(page).toHaveURL(/\/team/, { timeout: 10000 })
  await addEmployee(page, 'דנה כהן')
  await addEmployee(page, 'יוסי לוי')

  await page.goto('/schedule')
  await expect(page.getByRole('heading', { name: 'שיבוץ אוטומטי' })).toBeVisible({ timeout: 10000 })
  await page.getByRole('button', { name: 'צור סידור אוטומטי' }).click()
  await expect(page.getByTestId('coverage')).toBeVisible({ timeout: 30000 })

  // Clicking an assigned worker's name INSIDE a grid cell must open the
  // SwapEditor (not toggle a highlight) — this is the bug being fixed.
  const gridChip = page.getByTestId('week-table').getByText('דנה כהן').first()
  await expect(gridChip).toBeVisible({ timeout: 10000 })
  await gridChip.click()
  await expect(page.getByText('עובדים זמינים')).toBeVisible({ timeout: 8000 })
  await page.mouse.click(5, 5)
  await expect(page.getByText('עובדים זמינים')).toBeHidden({ timeout: 8000 })

  // Highlighting a worker's shifts is now exclusively a totals-bar action:
  // clicking a chip there toggles aria-pressed without opening the editor.
  const totalsChip = page.getByTestId('emp-total-chip').first()
  await expect(totalsChip).toBeVisible({ timeout: 10000 })
  await expect(totalsChip).toHaveAttribute('aria-pressed', 'false')
  await totalsChip.click()
  await expect(totalsChip).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByText('עובדים זמינים')).toBeHidden()

  // Toggling off restores the default state.
  await totalsChip.click()
  await expect(totalsChip).toHaveAttribute('aria-pressed', 'false')
})
