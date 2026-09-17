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

const MARK_TEXT = 'יום כיפור'

// The page header also renders "N לא מאויש" (week-health stat), so every
// empty-cell lookup here is scoped to the week table itself.
test('manager marks an empty slot with free text, then clears the mark', async ({ page }) => {
  test.setTimeout(120_000)
  await signupAndOnboard(page)

  await page.goto('/schedule')
  await expect(page.getByRole('heading', { name: 'סידור עבודה' })).toBeVisible({ timeout: 10000 })

  const table = page.getByTestId('week-table')
  const gapsBefore = await table.getByText('לא מאויש').count()
  expect(gapsBefore).toBeGreaterThan(0)

  // Mark the first empty cell — first with NO caption (Enter on an empty
  // field), which must still leave a visible trace in the edit view.
  await table.getByText('לא מאויש').first().click()
  const input = page.getByLabel('טקסט לסימון המשבצת')
  await expect(input).toBeVisible({ timeout: 8000 })
  await input.press('Enter')
  await expect(page.getByText('סומן ✓')).toBeVisible({ timeout: 10000 })
  await expect(table.getByText('—')).toHaveCount(1)
  await expect(table.getByText('לא מאויש')).toHaveCount(gapsBefore - 1)

  // Now give that same cell a caption via the "עדכן" path.
  await table.getByText('—').click()
  const update = page.getByLabel('טקסט לסימון המשבצת')
  await expect(update).toBeVisible({ timeout: 8000 })
  await update.fill(MARK_TEXT)
  await page.getByRole('button', { name: 'עדכן' }).click()
  await expect(page.getByText('סומן ✓')).toBeVisible({ timeout: 10000 })

  // The cell now shows the caption, and one "לא מאויש" gap is gone.
  await expect(table.getByText(MARK_TEXT)).toBeVisible({ timeout: 10000 })
  await expect(table.getByText('לא מאויש')).toHaveCount(gapsBefore - 1)

  // Reopening the marked cell offers removal; clearing restores the gap.
  await table.getByText(MARK_TEXT).click()
  const clear = page.getByRole('button', { name: 'הסר סימון' })
  await expect(clear).toBeVisible({ timeout: 8000 })
  await clear.click()
  await expect(page.getByText('הסימון הוסר ✓')).toBeVisible({ timeout: 10000 })
  await expect(table.getByText(MARK_TEXT)).toHaveCount(0)
  await expect(table.getByText('לא מאויש')).toHaveCount(gapsBefore)
})
