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
  await page.getByLabel('טלפון').fill(`05${Math.floor(10000000 + Math.random() * 90000000)}`)
  // Senior role (אחמ״ש) auto-qualifies for all lower roles via the rank hierarchy.
  await page.getByRole('switch').first().click()
  await page.getByRole('button', { name: 'הוספת עובד' }).click()
  await expect(page.getByRole('heading', { name: 'עובד חדש' })).toBeHidden({ timeout: 10000 })
}

/** CoverageIssues is a fullscreen popup that auto-opens after generation
 *  whenever slots were left uncovered or off-requests overridden — nearly
 *  always with small e2e seeds. Its scrim swallows clicks, so dismiss it
 *  (if it appeared) before interacting with anything underneath. */
async function dismissCoverageIssues(page: Page) {
  const dismiss = page.getByRole('button', { name: 'הבנתי' })
  const appeared = await dismiss.waitFor({ state: 'visible', timeout: 4000 }).then(() => true, () => false)
  if (appeared) {
    await dismiss.click()
    await expect(dismiss).toBeHidden({ timeout: 5000 })
  }
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
  await expect(page.getByRole('heading', { name: 'סידור עבודה' })).toBeVisible({ timeout: 10000 })
  await page.getByRole('button', { name: 'צור סידור אוטומטי' }).click()
  await expect(page.getByTestId('coverage')).toBeVisible({ timeout: 30000 })
  await dismissCoverageIssues(page)

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

  // Reload to read the freshly persisted state. WeekTableCell renders a 12h
  // assignment as the worker's name plus the variant's hour range — for the
  // "יום 12ש׳" (m12_day) variant applied above that range is 07:00–19:00.
  // (The old "-12" suffix no longer exists; the bare "12ש׳" text is NOT a safe
  // marker because the header day-pair buttons also contain it.)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'סידור עבודה' })).toBeVisible({ timeout: 10000 })
  const twelveMarker = page.getByTestId('week-table').getByText('07:00–19:00').first()
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

  // Build the scenario by hand on the empty, pre-generation grid — no auto
  // scheduler involved, so both "an empty slot" and "someone already booked
  // elsewhere that day" are guaranteed rather than hoped-for.
  await page.goto('/schedule')
  await expect(page.getByRole('heading', { name: 'סידור עבודה' })).toBeVisible({ timeout: 10000 })

  const weekTable = page.getByTestId('week-table')
  // First row of each shift group carries both the shift name and the role
  // name (rowSpan), so intersecting on shift text lands on the אחמ״ש row.
  const morningRow = weekTable.locator('tr', { hasText: 'בוקר' }).first()
  const noonRow = weekTable.locator('tr', { hasText: 'צהריים' }).first()
  const morningDay0 = morningRow.locator('td').nth(2) // shift col, role col, then days
  const noonDay0 = noonRow.locator('td').nth(2)

  // Shift A (בוקר, day 0): assign דנה כהן directly from the candidate list.
  // The WorkerPalette above the grid also renders a (draggable) button with
  // her name; behind the open sheet it would win `.first()` and the sheet's
  // scrim would swallow the click. The in-sheet candidate row is the only
  // non-draggable button carrying the full name — target that.
  await morningDay0.click()
  await expect(page.getByText('עובדים זמינים')).toBeVisible({ timeout: 8000 })
  await page.locator('button:not([draggable])', { hasText: 'דנה כהן' }).first().click()
  await expect(page.getByText('שובץ ✓')).toBeVisible({ timeout: 5000 })
  await expect(page.getByText('עובדים זמינים')).toBeHidden({ timeout: 8000 })
  await expect(morningDay0).toContainText('דנה כהן')

  // Shift B (צהריים, day 0, same role): tapping דנה כהן here must NOT assign
  // immediately — she's already committed to shift A that day, so the
  // candidate list shows her as "assigned_other" and tapping opens the
  // in-sheet confirm strip (native window.confirm is unreliable/silent in PWAs).
  await noonDay0.click()
  await expect(page.getByText('עובדים זמינים')).toBeVisible({ timeout: 8000 })
  const candidateBtn = page.locator('button', { hasText: 'משובץ במשמרת אחרת' }).first()
  await expect(candidateBtn).toBeVisible({ timeout: 5000 })
  await candidateBtn.click()
  await expect(page.getByText('עובד זה כבר משובץ במשמרת אחרת ביום זה')).toBeVisible({ timeout: 5000 })

  // ביטול leaves the schedule unchanged: the confirm strip closes, no success
  // message appears, and the target cell is still unfilled.
  await page.getByRole('button', { name: 'ביטול' }).click()
  await expect(page.getByText('עובד זה כבר משובץ במשמרת אחרת ביום זה')).toBeHidden({ timeout: 5000 })
  await expect(page.getByText('שובץ ✓')).toBeHidden()
  await page.mouse.click(5, 5)
  await expect(page.getByText('עובדים זמינים')).toBeHidden({ timeout: 8000 })
  await expect(noonDay0).toHaveText('לא מאויש')
  await expect(morningDay0).toContainText('דנה כהן')

  // Reopen and this time confirm the move with העבר — it completes via the
  // same assignSlot path: דנה כהן now appears in shift B and is gone from A.
  await noonDay0.click()
  await expect(page.getByText('עובדים זמינים')).toBeVisible({ timeout: 8000 })
  await page.locator('button', { hasText: 'משובץ במשמרת אחרת' }).first().click()
  await expect(page.getByText('עובד זה כבר משובץ במשמרת אחרת ביום זה')).toBeVisible({ timeout: 5000 })
  await page.getByRole('button', { name: 'העבר' }).click()
  await expect(page.getByText('שובץ ✓')).toBeVisible({ timeout: 5000 })
  await expect(page.getByText('עובדים זמינים')).toBeHidden({ timeout: 8000 })
  await expect(noonDay0).toContainText('דנה כהן')
  await expect(morningDay0).toHaveText('לא מאויש')
})

test('clicking a worker chip opens the editor; highlight lives only in the totals bar', async ({ page }) => {
  test.setTimeout(120_000)
  await signupAndOnboard(page)

  await page.goto('/team')
  await expect(page).toHaveURL(/\/team/, { timeout: 10000 })
  await addEmployee(page, 'דנה כהן')
  await addEmployee(page, 'יוסי לוי')

  await page.goto('/schedule')
  await expect(page.getByRole('heading', { name: 'סידור עבודה' })).toBeVisible({ timeout: 10000 })
  await page.getByRole('button', { name: 'צור סידור אוטומטי' }).click()
  await expect(page.getByTestId('coverage')).toBeVisible({ timeout: 30000 })
  await dismissCoverageIssues(page)

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
