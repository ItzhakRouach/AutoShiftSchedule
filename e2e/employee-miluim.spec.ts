import { test, expect } from '@playwright/test'
import { futureRange } from './heb-dates'
import { uid, signupAndOnboard, createInviteCode, joinEmployee, openRequests } from './setup'

// Employees can self-select the מילואים absence kind, and it is auto-approved
// immediately (official duty — blocks scheduling at once), never sitting in a
// pending state. Dates are dynamic (futureRange) so the row never rots into a
// hidden past entry, and a 15-days-out range stays outside the current week so
// it does not also lock a day card (which would double the מילואים span).
test('employee adds a מילואים range — auto-approved immediately, persists on reload', async ({ browser }) => {
  test.setTimeout(120_000)
  const u = uid()
  const mgr = await signupAndOnboard(browser, {
    email: `mgr+${u}@example.com`,
    password: 'TestPass123!',
    orgName: `ארגון ${u}`,
    workplaceName: `מקום עבודה ${u}`,
  })
  const code = await createInviteCode(mgr.page)
  const emp = await joinEmployee(browser, code, {
    name: 'מילואימניק',
    email: `emp+${uid()}@example.com`,
    password: 'EmpPass456!',
  })
  const page = emp.page
  await openRequests(page)

  // ── Select the מילואים kind (סוג היעדרות), fill a future range, submit ───────
  const vac = futureRange(15, 3)
  await page.getByRole('button', { name: 'מילואים', exact: true }).click()
  await page.getByLabel('מתאריך').fill(vac.fromISO)
  await page.getByLabel('עד תאריך').fill(vac.toISO)
  await page.getByRole('button', { name: 'הוסף חופשה' }).click()

  // ── The new row shows the range + the מילואים kind badge + approved status,
  //    immediately (no pending step). The kind badge is the only <span> reading
  //    מילואים — the Segmented option is a <button>. ─────────────────────────
  await expect(page.getByText(vac.text)).toBeVisible({ timeout: 8000 })
  await expect(page.locator('span').filter({ hasText: 'מילואים' })).toBeVisible()
  await expect(page.getByText('אושר ✓')).toBeVisible()

  // ── Reload → the row and both badges persist ────────────────────────────────
  await page.reload()
  await expect(page.getByText(vac.text)).toBeVisible({ timeout: 10000 })
  await expect(page.locator('span').filter({ hasText: 'מילואים' })).toBeVisible()
  await expect(page.getByText('אושר ✓')).toBeVisible()

  await emp.context.close()
  await mgr.context.close()
})
