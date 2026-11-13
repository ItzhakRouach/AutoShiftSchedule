import { test, expect, type Page } from '@playwright/test'
import { uid, signupAndOnboard, createInviteCode, joinEmployee, openRequests, markDayOff } from './setup'

/** Set the weekly request-day cap on /settings and save (scoped to the deadline form). */
async function saveRequestCap(managerPage: Page, value: string) {
  await managerPage.goto('/settings')
  const field = managerPage.locator('#max-request-days-per-week')
  const form = managerPage.locator('form').filter({ has: field })
  await field.fill(value)
  // The cap shares a form with the request deadline, whose fields default to
  // Thursday 18:00 on a workplace that never set one. Saving that default from
  // Thursday evening to Saturday puts the deadline in the past and rolls the
  // employee's request week forward, hiding the days this test just marked.
  // Pin a deadline that has not passed on any weekday instead.
  await managerPage.locator('#deadline-dow').selectOption('6')
  await managerPage.locator('#deadline-time').fill('23:59')
  await form.getByRole('button', { name: 'שמור', exact: true }).click()
  await expect(managerPage.getByText('ההגדרות נשמרו בהצלחה')).toBeVisible({ timeout: 10000 })
}

/** Close the bottom sheet by clicking its backdrop (top-left corner is never the panel). */
async function closeSheet(page: Page) {
  await page.mouse.click(10, 10)
}

async function setupManagerAndEmployee(browser: Parameters<typeof signupAndOnboard>[0], empName: string) {
  const u = uid()
  const mgr = await signupAndOnboard(browser, {
    email: `mgr+${u}@example.com`,
    password: 'TestPass123!',
    orgName: `ארגון ${u}`,
    workplaceName: `מקום עבודה ${u}`,
  })
  const code = await createInviteCode(mgr.page)
  const emp = await joinEmployee(browser, code, {
    name: empName,
    email: `emp+${uid()}@example.com`,
    password: 'EmpPass456!',
  })
  return { mgr, emp }
}

test('default cap 3: banner tracks days, 4th day is blocked, clearing a day frees a slot', async ({ browser }) => {
  test.setTimeout(150_000)
  const { mgr, emp } = await setupManagerAndEmployee(browser, 'עובד מוגבל')

  // The new workplace starts with the DB default of 3.
  await mgr.page.goto('/settings')
  await expect(mgr.page.locator('#max-request-days-per-week')).toHaveValue('3')

  await openRequests(emp.page)
  const banner = emp.page.getByTestId('request-cap-banner')
  await expect(banner).toBeVisible({ timeout: 10000 })
  await expect(banner).toContainText('ימי בקשות בשבוע זה')
  await expect(banner).toContainText('0 מתוך 3')

  await markDayOff(emp.page, 'ראשון')
  await markDayOff(emp.page, 'שני')
  await markDayOff(emp.page, 'שלישי')
  await expect(banner).toContainText('3 מתוך 3')
  await expect(banner).toContainText('הגעת למקסימום')

  // A 4th day opens read-only: notice shown, options + save disabled.
  await emp.page.getByText('רביעי', { exact: true }).first().click()
  await expect(emp.page.getByText('הגעת למקסימום ימי בקשות לשבוע — נקו יום אחר כדי לבקש כאן')).toBeVisible({ timeout: 8000 })
  const offButton = emp.page.locator('button').filter({ hasText: 'יום חופש / לא זמין' })
  await expect(offButton).toBeDisabled()
  await expect(emp.page.getByRole('button', { name: 'שמירה', exact: true })).toBeDisabled()
  await closeSheet(emp.page)
  await expect(offButton).not.toBeVisible({ timeout: 5000 })

  // Clear ראשון (toggle its off mark → "נקה יום") → one slot frees up.
  await emp.page.getByText('ראשון', { exact: true }).first().click()
  const offToggle = emp.page.getByText('יום חופש / לא זמין')
  await expect(offToggle).toBeVisible({ timeout: 8000 })
  await offToggle.click()
  await emp.page.getByRole('button', { name: 'נקה יום', exact: true }).click()
  await expect(banner).toContainText('2 מתוך 3', { timeout: 8000 })

  // Now רביעי can be requested.
  await markDayOff(emp.page, 'רביעי')
  await expect(banner).toContainText('3 מתוך 3')

  await emp.context.close()
  await mgr.context.close()
})

test('manager marks the employee "ללא הגבלת בקשות" → no banner, 4th day saves', async ({ browser }) => {
  test.setTimeout(150_000)
  const { mgr, emp } = await setupManagerAndEmployee(browser, 'עובד ללא הגבלה')

  await openRequests(emp.page)
  await markDayOff(emp.page, 'ראשון')
  await markDayOff(emp.page, 'שני')
  await markDayOff(emp.page, 'שלישי')
  await expect(emp.page.getByTestId('request-cap-banner')).toContainText('3 מתוך 3')

  // Manager opens the employee and flips the exemption toggle.
  await mgr.page.goto('/team')
  await mgr.page.getByText('עובד ללא הגבלה', { exact: true }).click()
  await expect(mgr.page.getByRole('heading', { name: 'עובד ללא הגבלה' })).toBeVisible({ timeout: 5000 })
  // A self-joined employee has no role yet and the editor requires one to save.
  const firstRoleSwitch = mgr.page.getByRole('switch').first()
  if ((await firstRoleSwitch.getAttribute('aria-checked')) !== 'true') await firstRoleSwitch.click()
  await expect(firstRoleSwitch).toHaveAttribute('aria-checked', 'true')
  const label = mgr.page.getByText('ללא הגבלת בקשות', { exact: true })
  await expect(label).toBeVisible()
  const unlimitedSwitch = label
    .locator('xpath=ancestor::div[.//button[@role="switch"]][1]')
    .getByRole('switch')
  await unlimitedSwitch.click()
  await expect(unlimitedSwitch).toHaveAttribute('aria-checked', 'true')
  await mgr.page.getByRole('button', { name: 'שמירת שינויים' }).click()
  await expect(mgr.page.getByRole('heading', { name: 'עובד ללא הגבלה' })).not.toBeVisible({ timeout: 10000 })

  // Persisted: reopening shows the toggle ON.
  await mgr.page.reload()
  await mgr.page.getByText('עובד ללא הגבלה', { exact: true }).click()
  await expect(
    mgr.page.getByText('ללא הגבלת בקשות', { exact: true })
      .locator('xpath=ancestor::div[.//button[@role="switch"]][1]')
      .getByRole('switch'),
  ).toHaveAttribute('aria-checked', 'true', { timeout: 8000 })

  // Employee: cap gone, a 4th day saves freely.
  await emp.page.reload()
  await expect(emp.page.getByRole('heading', { name: 'הבקשות שלי' })).toBeVisible({ timeout: 10000 })
  await expect(emp.page.getByTestId('request-cap-banner')).toHaveCount(0)
  await markDayOff(emp.page, 'רביעי')
  await expect(emp.page.locator('span').filter({ hasText: 'יום חופש' })).toHaveCount(4)

  await emp.context.close()
  await mgr.context.close()
})

test('manager clears the workplace cap → banner disappears for a regular employee', async ({ browser }) => {
  test.setTimeout(120_000)
  const { mgr, emp } = await setupManagerAndEmployee(browser, 'עובד רגיל')

  await openRequests(emp.page)
  await expect(emp.page.getByTestId('request-cap-banner')).toBeVisible({ timeout: 10000 })

  await saveRequestCap(mgr.page, '')
  await mgr.page.reload()
  await expect(mgr.page.locator('#max-request-days-per-week')).toHaveValue('')

  await emp.page.reload()
  await expect(emp.page.getByRole('heading', { name: 'הבקשות שלי' })).toBeVisible({ timeout: 10000 })
  await expect(emp.page.getByTestId('request-cap-banner')).toHaveCount(0)

  await emp.context.close()
  await mgr.context.close()
})

test('over the cap (manager lowered it): existing days stay editable, new days stay blocked', async ({ browser }) => {
  test.setTimeout(150_000)
  const { mgr, emp } = await setupManagerAndEmployee(browser, 'עובד מעל המכסה')

  await openRequests(emp.page)
  await markDayOff(emp.page, 'ראשון')
  await markDayOff(emp.page, 'שני')
  await markDayOff(emp.page, 'שלישי')

  // Manager lowers the cap to 2 while the employee already holds 3 days.
  await saveRequestCap(mgr.page, '2')

  await emp.page.reload()
  await expect(emp.page.getByRole('heading', { name: 'הבקשות שלי' })).toBeVisible({ timeout: 10000 })
  await expect(emp.page.getByTestId('request-cap-banner')).toContainText('3 מתוך 2')

  // Editing an existing day: add a preferred shift to ראשון → saves fine.
  await emp.page.getByText('ראשון', { exact: true }).first().click()
  const morning = emp.page.locator('button').filter({ hasText: 'בוקר' })
  await expect(morning).toBeVisible({ timeout: 8000 })
  await expect(morning).toBeEnabled()
  await morning.click()
  await emp.page.getByRole('button', { name: 'שמירה', exact: true }).click()
  const sunday = emp.page.locator('.card-interactive').filter({ hasText: 'ראשון' })
  await expect(sunday.locator('span').filter({ hasText: 'בוקר' })).toBeVisible({ timeout: 8000 })

  // A new day is still blocked.
  await emp.page.getByText('רביעי', { exact: true }).first().click()
  await expect(emp.page.getByText('הגעת למקסימום ימי בקשות לשבוע — נקו יום אחר כדי לבקש כאן')).toBeVisible({ timeout: 8000 })
  await expect(emp.page.getByRole('button', { name: 'שמירה', exact: true })).toBeDisabled()

  await emp.context.close()
  await mgr.context.close()
})
