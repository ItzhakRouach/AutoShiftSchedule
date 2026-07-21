import { test, expect, type Page } from '@playwright/test'
import { uid, signupAndOnboard, createInviteCode, joinEmployee, openRequests, markDayOff } from './setup'

/** Fill the off-cap fields on /settings and save — both live in the deadline
 *  form, so we scope the "שמור" submit to that form (other sections save too). */
async function saveOffCaps(managerPage: Page, opts: { weekly?: string; perDay?: string }) {
  await managerPage.goto('/settings')
  const form = managerPage.locator('form').filter({ has: managerPage.locator('#max-off-days-per-week') })
  if (opts.weekly !== undefined) await managerPage.locator('#max-off-days-per-week').fill(opts.weekly)
  if (opts.perDay !== undefined) await managerPage.locator('#max-off-per-day').fill(opts.perDay)
  await form.getByRole('button', { name: 'שמור', exact: true }).click()
  await expect(managerPage.getByText('ההגדרות נשמרו בהצלחה')).toBeVisible({ timeout: 10000 })
}

test('weekly cap unset (new default): no banner, employee marks 3 days off freely', async ({ browser }) => {
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
    name: 'עובד ללא מגבלה',
    email: `emp+${uid()}@example.com`,
    password: 'EmpPass456!',
  })
  await openRequests(emp.page)

  // No weekly cap configured → the banner is not rendered at all.
  await expect(emp.page.getByTestId('off-cap-banner')).toHaveCount(0)

  // Three different days can all be marked off without any error.
  await markDayOff(emp.page, 'ראשון')
  await markDayOff(emp.page, 'שני')
  await markDayOff(emp.page, 'שלישי')
  await expect(emp.page.locator('span').filter({ hasText: 'יום חופש' })).toHaveCount(3)

  await emp.context.close()
  await mgr.context.close()
})

test('weekly cap = 1: banner tracks usage and disables a second day', async ({ browser }) => {
  test.setTimeout(120_000)
  const u = uid()
  const mgr = await signupAndOnboard(browser, {
    email: `mgr+${u}@example.com`,
    password: 'TestPass123!',
    orgName: `ארגון ${u}`,
    workplaceName: `מקום עבודה ${u}`,
  })

  // Manager sets the weekly cap to 1; it persists across a reload.
  await saveOffCaps(mgr.page, { weekly: '1' })
  await mgr.page.reload()
  await expect(mgr.page.locator('#max-off-days-per-week')).toHaveValue('1')

  const code = await createInviteCode(mgr.page)
  const emp = await joinEmployee(browser, code, {
    name: 'עובד עם מגבלה',
    email: `emp+${uid()}@example.com`,
    password: 'EmpPass456!',
  })
  await openRequests(emp.page)

  const banner = emp.page.getByTestId('off-cap-banner')
  await expect(banner).toBeVisible({ timeout: 10000 })
  await expect(banner).toContainText('ימי חופש בשבוע זה')
  await expect(banner).toContainText('0 מתוך 1')

  // Mark ראשון off → banner hits the max and shows the warning suffix.
  await markDayOff(emp.page, 'ראשון')
  await expect(banner).toContainText('1 מתוך 1')
  await expect(banner).toContainText('הגעת למקסימום')

  // Opening שני: the off toggle is disabled with the max-reached subtext.
  await emp.page.getByText('שני', { exact: true }).first().click()
  const offButton = emp.page.locator('button').filter({ hasText: 'יום חופש / לא זמין' })
  await expect(offButton).toBeVisible({ timeout: 8000 })
  await expect(offButton).toBeDisabled()
  await expect(offButton).toContainText('הגעת למקסימום ימי חופש לשבוע')

  await emp.context.close()
  await mgr.context.close()
})

test('per-day cap = 1: a second employee is blocked with the daily-quota message', async ({ browser }) => {
  test.setTimeout(150_000)
  const u = uid()
  const mgr = await signupAndOnboard(browser, {
    email: `mgr+${u}@example.com`,
    password: 'TestPass123!',
    orgName: `ארגון ${u}`,
    workplaceName: `מקום עבודה ${u}`,
  })

  // Per-day cap = 1, weekly cap left EMPTY.
  await saveOffCaps(mgr.page, { perDay: '1' })

  // Employee A joins (own code) and takes ראשון off — the first taker.
  const codeA = await createInviteCode(mgr.page)
  const empA = await joinEmployee(browser, codeA, {
    name: 'עובד א',
    email: `empa+${uid()}@example.com`,
    password: 'EmpPass456!',
  })
  await openRequests(empA.page)
  await markDayOff(empA.page, 'ראשון')

  // Employee B joins via a SECOND, distinct code (not A's).
  const codeB = await createInviteCode(mgr.page, codeA)
  const empB = await joinEmployee(browser, codeB, {
    name: 'עובד ב',
    email: `empb+${uid()}@example.com`,
    password: 'EmpPass456!',
  })
  await openRequests(empB.page)

  // B tries ראשון off → the daily quota (1) is already full → inline error.
  await empB.page.getByText('ראשון', { exact: true }).first().click()
  const offToggle = empB.page.getByText('יום חופש / לא זמין')
  await expect(offToggle).toBeVisible({ timeout: 8000 })
  await offToggle.click()
  await empB.page.getByRole('button', { name: 'שמירה', exact: true }).click()
  await expect(
    empB.page.getByText('כבר 1 עובדים ביקשו חופש ביום זה — המכסה היומית (1) מלאה'),
  ).toBeVisible({ timeout: 8000 })

  await empA.context.close()
  await empB.context.close()
  await mgr.context.close()
})
