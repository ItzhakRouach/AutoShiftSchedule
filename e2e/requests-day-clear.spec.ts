import { test, expect } from '@playwright/test'
import { uid, signupAndOnboard, createInviteCode, joinEmployee, openRequests, markDayOff } from './setup'

// Single-day clear: an employee marks ראשון off, then clears JUST that day via
// the "נקה יום" save-button (the label the save button takes when a saved day is
// emptied), and the card returns to its empty-state copy — no full wipe needed.
test('day clear: mark ראשון off, then clear that one day back to empty', async ({ browser }) => {
  test.setTimeout(120_000)
  const u = uid()
  const manager = await signupAndOnboard(browser, {
    email: `mgr+${u}@example.com`,
    password: 'TestPass123!',
    orgName: `ארגון ${u}`,
    workplaceName: `מקום עבודה ${u}`,
  })
  const code = await createInviteCode(manager.page)
  const emp = await joinEmployee(browser, code, {
    name: 'ישראל ישראלי',
    email: `emp+${uid()}@example.com`,
    password: 'EmpPass456!',
  })
  const page = emp.page
  await openRequests(page)

  // ── 1. Mark ראשון off (helper opens, toggles, saves, waits for the chip) ─────
  await markDayOff(page, 'ראשון')

  // ── 2. Reopen ראשון → untoggle off → the save button now reads "נקה יום" ─────
  await page.getByText('ראשון', { exact: true }).first().click()
  const offToggle = page.getByText('יום חופש / לא זמין')
  await expect(offToggle).toBeVisible({ timeout: 8000 })
  await offToggle.click()
  const clearDayBtn = page.getByRole('button', { name: 'נקה יום', exact: true })
  await expect(clearDayBtn).toBeVisible({ timeout: 5000 })
  await clearDayBtn.click()
  await expect(offToggle).not.toBeVisible({ timeout: 8000 })

  // ── 3. The ראשון card returns to the empty-state copy; no off-chip remains ───
  const sundayCard = page.locator('.card-interactive').filter({ hasText: 'ראשון' })
  await expect(sundayCard).toContainText('טרם נבחר — הקישו להוספה', { timeout: 10000 })
  await expect(page.locator('span').filter({ hasText: 'יום חופש' })).toHaveCount(0)

  // ── 4. Reload → still empty; the clear-all control is absent with 0 filled ───
  await page.reload()
  await expect(page).toHaveURL(/\/me\/requests/)
  await expect(page.locator('.card-interactive').filter({ hasText: 'ראשון' }))
    .toContainText('טרם נבחר — הקישו להוספה', { timeout: 10000 })
  await expect(page.getByTestId('clear-all-requests')).toHaveCount(0)

  await emp.context.close()
  await manager.context.close()
})
