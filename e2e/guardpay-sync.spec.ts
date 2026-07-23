import { test, expect, type Page } from '@playwright/test'
import { signupAndOnboard, createInviteCode, joinEmployee, uid } from './setup'

/** Manager pre-creates a rostered employee with a role and a KNOWN phone so the
 *  invite-join claims that row (roles preserved) and generation assigns shifts. */
async function addEmployee(page: Page, name: string, phone: string) {
  await page.getByRole('button', { name: 'הוסף עובד' }).click()
  await expect(page.getByRole('heading', { name: 'עובד חדש' })).toBeVisible({ timeout: 5000 })
  await page.getByLabel('שם מלא').fill(name)
  await page.getByLabel('טלפון').fill(phone)
  await page.getByRole('switch').first().click()
  await page.getByRole('button', { name: 'הוספת עובד' }).click()
  await expect(page.getByRole('heading', { name: 'עובד חדש' })).toBeHidden({ timeout: 10000 })
}

async function dismissCoverageIssues(page: Page) {
  const dismiss = page.getByRole('button', { name: 'הבנתי' })
  const appeared = await dismiss.waitFor({ state: 'visible', timeout: 4000 }).then(() => true, () => false)
  if (appeared) {
    await dismiss.click()
    await expect(dismiss).toBeHidden({ timeout: 5000 })
  }
}

test('employee links GuardPay and imports the published week', async ({ browser }) => {
  test.setTimeout(240_000)
  const token = uid()
  const guardPhone = '0529990001'

  // Manager: workplace + 3 rostered employees (one to be claimed by the guard).
  const manager = await signupAndOnboard(browser, {
    email: `gp-mgr+${token}@example.com`,
    password: 'TestPass123!',
    orgName: `ארגון ${token}`,
    workplaceName: `מקום ${token}`,
  })
  await manager.page.goto('/team')
  await expect(manager.page).toHaveURL(/\/team/, { timeout: 10000 })
  await addEmployee(manager.page, 'גארד פיי', guardPhone)
  await addEmployee(manager.page, 'דנה כהן', '0529990002')
  await addEmployee(manager.page, 'יוסי לוי', '0529990003')

  // Guard joins via invite with the SAME phone → claims the rostered row + role.
  const code = await createInviteCode(manager.page)
  const guard = await joinEmployee(browser, code, {
    name: 'גארד פיי',
    email: `gp-emp+${token}@example.com`,
    password: 'TestPass123!',
    phone: guardPhone,
  })

  // Manager: generate + publish.
  await manager.page.goto('/schedule')
  await expect(manager.page.getByRole('heading', { name: 'סידור עבודה' })).toBeVisible({ timeout: 10000 })
  await manager.page.getByRole('button', { name: 'צור סידור אוטומטי' }).click()
  await expect(manager.page.getByTestId('coverage')).toBeVisible({ timeout: 30000 })
  await dismissCoverageIssues(manager.page)
  await manager.page.getByRole('button', { name: 'פרסם סידור' }).click()
  const confirmPublish = manager.page.getByRole('button', { name: /לחצו שוב לפרסום/ })
  await confirmPublish.click({ timeout: 3000 }).catch(() => {}) // absent when coverage is full
  await expect(manager.page.getByRole('button', { name: /פורסם/ })).toBeVisible({ timeout: 15000 })

  // Guard: schedule page shows the GuardPay card → link (fake auto-match).
  await guard.page.goto('/me/schedule')
  await expect(guard.page.getByRole('heading', { name: 'הסידור השבועי' })).toBeVisible({ timeout: 15000 })
  await guard.page.getByTestId('guardpay-connect').click()
  await expect(guard.page.getByText(/נמצא חשבון GuardPay על שם ישראל ישראלי/)).toBeVisible({ timeout: 10000 })
  await guard.page.getByTestId('guardpay-link-confirm').click()

  // Linked state → import.
  const syncBtn = guard.page.getByTestId('guardpay-sync')
  await expect(syncBtn).toBeVisible({ timeout: 15000 })
  await expect(syncBtn).toBeEnabled({ timeout: 15000 }) // claimed role ⇒ has shifts
  await syncBtn.click()
  await expect(guard.page.getByTestId('guardpay-synced-badge')).toBeVisible({ timeout: 15000 })

  // Import is one-shot per published week: the button grays out and locks.
  await expect(syncBtn).toBeDisabled({ timeout: 15000 })
  await expect(syncBtn).toHaveText('יובא ✓')

  // Manager unpublishes (schedule about to change) → the sync marker resets and
  // the employee can import the updated week again.
  const unpub = manager.page.getByTestId('unpublish-schedule')
  await expect(unpub).toBeVisible({ timeout: 15000 })
  await unpub.click()
  await expect(unpub).toHaveText('לחצו שוב לאישור ביטול', { timeout: 2000 })
  await unpub.click()
  await expect(manager.page.getByTestId('unpublish-schedule')).toBeHidden({ timeout: 30_000 })
  await manager.page.getByRole('button', { name: 'פרסם סידור' }).click()
  await manager.page.getByRole('button', { name: /לחצו שוב לפרסום/ }).click({ timeout: 3000 }).catch(() => {})
  await expect(manager.page.getByRole('button', { name: /פורסם/ })).toBeVisible({ timeout: 15000 })

  await guard.page.reload()
  const syncBtn2 = guard.page.getByTestId('guardpay-sync')
  await expect(syncBtn2).toBeEnabled({ timeout: 15000 })
  await expect(syncBtn2).toHaveText('ייבוא המשמרות ל-GuardPay')

  await manager.context.close()
  await guard.context.close()
})
