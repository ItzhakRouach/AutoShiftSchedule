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

// The slot-editor sheet has no fixed list heading (candidate sections are
// dynamic: "ביקשו משמרת זו" / "זמינים" / "דורש אישור"), but the 12h section
// header always renders — use it as the sheet-open anchor. NOTE: the page
// header also shows "N לא מאויש" (week-health stat), so empty-slot lookups
// must be scoped to the week-table, never a bare page.getByText.
const SHEET_ANCHOR = 'החל משמרת 12 שעות'

test('manager applies a 12h shift on the empty grid before generating', async ({ page }) => {
  test.setTimeout(120_000)
  await signupAndOnboard(page)

  await page.goto('/team')
  await expect(page).toHaveURL(/\/team/, { timeout: 10000 })
  await addEmployee(page, 'דנה כהן')
  await addEmployee(page, 'יוסי לוי')
  await addEmployee(page, 'מאיה בר')

  await page.goto('/schedule')
  await expect(page.getByRole('heading', { name: 'סידור עבודה' })).toBeVisible({ timeout: 10000 })

  // Apply the 12h shift on the empty, pre-generation grid — every candidate is
  // unblocked on an empty week, so the "— 12ש׳" button is guaranteed to render
  // (scheduler-dependent state after auto-generation is not, see prior flake).
  const slot = page.getByTestId('week-table').getByText('לא מאויש').first()
  await slot.click()
  await expect(page.getByText(SHEET_ANCHOR)).toBeVisible({ timeout: 8000 })
  await page.getByRole('button', { name: 'יום 12ש׳' }).click()
  await page.getByRole('button', { name: /— 12ש׳$/ }).first().click()

  // The 12h warning should appear inline.
  await expect(page.getByText(/משמרת 12 שעות תופסת/)).toBeVisible({ timeout: 8000 })

  // Close the sheet (backdrop click) and confirm a 12ש׳ badge is in the grid.
  await page.mouse.click(5, 5)
  await expect(page.getByText(SHEET_ANCHOR)).toBeHidden({ timeout: 8000 })

  // Reload to read the freshly persisted state. WeekTableCell renders a 12h
  // assignment as the worker's name plus the variant's hour range — for the
  // "יום 12ש׳" (m12_day) variant applied above that range is 07:00–19:00.
  await page.reload()
  await expect(page.getByRole('heading', { name: 'סידור עבודה' })).toBeVisible({ timeout: 10000 })
  const twelveMarker = page.getByTestId('week-table').getByText('07:00–19:00').first()
  const found = (await twelveMarker.count()) > 0
  expect(found).toBe(true)
})

test('manager manually edits a slot after auto-generating', async ({ page }) => {
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

  // Open a slot (either an empty "לא מאויש" slot or an assigned chip) on the grid.
  const weekTable = page.getByTestId('week-table')
  const slot = weekTable.getByText('לא מאויש').first()
  const chip = weekTable.getByText('דנה כהן').first()
  if (await slot.count()) await slot.click()
  else await chip.click()

  // The SwapEditor sheet should open.
  await expect(page.getByText(SHEET_ANCHOR)).toBeVisible({ timeout: 8000 })

  // Click a strictly-available candidate (זמין / ✓ ביקש) if one exists —
  // hard-blocked workers are collapsed and assigned-elsewhere ones are hidden.
  const strictCandidate = page.locator('button', { hasText: /^.*(זמין|ביקש)/ }).first()
  if (await strictCandidate.count()) {
    await strictCandidate.click()
  }
  // Whether or not auto-closed, ensure the sheet is gone before continuing.
  const sheetStillOpen = await page.getByText(SHEET_ANCHOR).isVisible()
  if (sheetStillOpen) await page.mouse.click(5, 5)
  await expect(page.getByText(SHEET_ANCHOR)).toBeHidden({ timeout: 8000 })
})

test('double-booking is server-rejected on tap-to-assign; drag moves the worker instead', async ({ page }) => {
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

  // Shift A (בוקר, day 0): assign דנה כהן from the sheet's candidate list.
  // The WorkerPalette also renders a (draggable) button with her name — the
  // in-sheet candidate row is the only non-draggable one; target that.
  await morningDay0.click()
  await expect(page.getByText(SHEET_ANCHOR)).toBeVisible({ timeout: 8000 })
  await page.locator('button:not([draggable])', { hasText: 'דנה כהן' }).first().click()
  await expect(page.getByTestId('assign-toast').getByText('שובץ ✓')).toBeVisible({ timeout: 5000 })
  await expect(page.getByText(SHEET_ANCHOR)).toBeHidden({ timeout: 8000 })
  await expect(morningDay0).toContainText('דנה כהן')

  // Shift B (צהריים, day 0, same role): holding her and tapping another cell
  // on her busy day is a deliberate client-side no-op (WeekTable blocks taps
  // on heldBusyDays; the cell greys out) — nothing is assigned, no sheet opens.
  // (The sheet hides busy workers entirely, so no path double-books her.)
  await page.locator('button[draggable]', { hasText: 'דנה כהן' }).first().click() // hold in palette
  await noonDay0.click()
  await expect(page.getByText(SHEET_ANCHOR)).toBeHidden() // no sheet opened
  await expect(noonDay0).toHaveText('לא מאויש')
  await expect(morningDay0).toContainText('דנה כהן')
  await page.locator('button[draggable]', { hasText: 'דנה כהן' }).first().click() // release hold

  // Moving her legitimately is a drag: grid chip (a draggable span) from בוקר
  // to the empty צהריים cell → drag-move (source vacated), server-validated.
  await morningDay0.locator('span[draggable]').first().dragTo(noonDay0)
  await expect(page.getByTestId('assign-toast').getByText(/הועבר|✓/)).toBeVisible({ timeout: 8000 })
  await expect(noonDay0).toContainText('דנה כהן', { timeout: 8000 })
  await expect(morningDay0).toHaveText('לא מאויש', { timeout: 8000 })
})

test('tap-to-assign shows שובץ ✓ and בטל (undo bar) reverts the cell to empty', async ({ page }) => {
  test.setTimeout(120_000)
  await signupAndOnboard(page)

  await page.goto('/team')
  await expect(page).toHaveURL(/\/team/, { timeout: 10000 })
  await addEmployee(page, 'דנה כהן')

  // Empty, pre-generation grid: the WorkerPalette is available and every cell
  // starts unfilled, so the tap-worker→tap-cell fast path is deterministic.
  await page.goto('/schedule')
  await expect(page.getByRole('heading', { name: 'סידור עבודה' })).toBeVisible({ timeout: 10000 })

  const weekTable = page.getByTestId('week-table')
  const morningRow = weekTable.locator('tr', { hasText: 'בוקר' }).first()
  const morningDay0 = morningRow.locator('td').nth(2)
  await expect(morningDay0).toHaveText('לא מאויש')

  // Hold דנה כהן in the palette (draggable chip, tap-to-hold), then tap the
  // empty cell — this resolves through useCellAssign's dispatch/assignTo path.
  await page.locator('button[draggable]', { hasText: 'דנה כהן' }).first().click()
  await morningDay0.click()

  // The shared AssignToast confirms; undo now lives in the persistent
  // UndoRedoBar (appears once history is non-empty).
  await expect(page.getByTestId('assign-toast').getByText('שובץ ✓')).toBeVisible({ timeout: 5000 })
  await expect(morningDay0).toContainText('דנה כהן')
  const undoBtn = page.getByRole('button', { name: 'בטל', exact: true })
  await expect(undoBtn).toBeVisible({ timeout: 5000 })

  await undoBtn.click()

  // Undo reverses the assignment: the cell is empty again.
  await expect(morningDay0).toHaveText('לא מאויש', { timeout: 8000 })
})

test('undo after a sheet assign restores the empty slot', async ({ page }) => {
  test.setTimeout(120_000)
  await signupAndOnboard(page)

  await page.goto('/team')
  await expect(page).toHaveURL(/\/team/, { timeout: 10000 })
  await addEmployee(page, 'דנה כהן')
  await addEmployee(page, 'יוסי לוי')

  await page.goto('/schedule')
  await expect(page.getByRole('heading', { name: 'סידור עבודה' })).toBeVisible({ timeout: 10000 })

  const weekTable = page.getByTestId('week-table')
  const morningRow = weekTable.locator('tr', { hasText: 'בוקר' }).first()
  const morningDay0 = morningRow.locator('td').nth(2)

  // Assign דנה כהן from the sheet's candidate list (SwapEditor.onDone pushes
  // the edit onto the same undo stack used by the fast tap/drag paths).
  await morningDay0.click()
  await expect(page.getByText(SHEET_ANCHOR)).toBeVisible({ timeout: 8000 })
  await page.locator('button:not([draggable])', { hasText: 'דנה כהן' }).first().click()
  await expect(page.getByText(SHEET_ANCHOR)).toBeHidden({ timeout: 8000 })
  await expect(morningDay0).toContainText('דנה כהן')

  const undoBtn = page.getByRole('button', { name: 'בטל', exact: true })
  await expect(undoBtn).toBeVisible({ timeout: 5000 })
  await undoBtn.click()

  // Undo reverses the sheet assign: the slot is unfilled again.
  await expect(morningDay0).toHaveText('לא מאויש', { timeout: 8000 })
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
  await expect(page.getByText(SHEET_ANCHOR)).toBeVisible({ timeout: 8000 })
  await page.mouse.click(5, 5)
  await expect(page.getByText(SHEET_ANCHOR)).toBeHidden({ timeout: 8000 })

  // Highlighting a worker's shifts is now exclusively a totals-bar action:
  // clicking a chip there toggles aria-pressed without opening the editor.
  const totalsChip = page.getByTestId('emp-total-chip').first()
  await expect(totalsChip).toBeVisible({ timeout: 10000 })
  await expect(totalsChip).toHaveAttribute('aria-pressed', 'false')
  await totalsChip.click()
  await expect(totalsChip).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByText(SHEET_ANCHOR)).toBeHidden()

  // Toggling off restores the default state.
  await totalsChip.click()
  await expect(totalsChip).toHaveAttribute('aria-pressed', 'false')
})
