import { test, expect, type Page } from '@playwright/test'
import { signupAndOnboard, createInviteCode, joinEmployee, uid } from './setup'

/** Manager pre-creates a rostered employee (senior role) with a KNOWN phone so
 *  the invite-join claims that row and generation assigns the guard shifts. */
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

test('employee sees a "new schedule" banner on publish, cleared by viewing the schedule', async ({ browser }) => {
  test.setTimeout(240_000)
  const token = uid()
  const guardPhone = '0529991001'

  const manager = await signupAndOnboard(browser, {
    email: `nb-mgr+${token}@example.com`,
    password: 'TestPass123!',
    orgName: `ארגון ${token}`,
    workplaceName: `מקום ${token}`,
  })
  await manager.page.goto('/team')
  await expect(manager.page).toHaveURL(/\/team/, { timeout: 10000 })
  await addEmployee(manager.page, 'נועם בר', guardPhone)
  await addEmployee(manager.page, 'דנה כהן', '0529991002')
  await addEmployee(manager.page, 'יוסי לוי', '0529991003')

  const code = await createInviteCode(manager.page)
  const emp = await joinEmployee(browser, code, {
    name: 'נועם בר',
    email: `nb-emp+${token}@example.com`,
    password: 'TestPass123!',
    phone: guardPhone,
  })

  // Before any publish: no banner on /me.
  await emp.page.goto('/me')
  await expect(emp.page.getByRole('heading', { name: /שלום/ })).toBeVisible({ timeout: 15000 })
  await expect(emp.page.getByText('סידור חדש פורסם')).toHaveCount(0)

  // Manager generates + publishes.
  await manager.page.goto('/schedule')
  await expect(manager.page.getByRole('heading', { name: 'סידור עבודה' })).toBeVisible({ timeout: 10000 })
  await manager.page.getByRole('button', { name: 'צור סידור אוטומטי' }).click()
  await expect(manager.page.getByTestId('coverage')).toBeVisible({ timeout: 30000 })
  await dismissCoverageIssues(manager.page)
  await manager.page.getByRole('button', { name: 'פרסם סידור' }).click()
  await manager.page.getByRole('button', { name: /לחצו שוב לפרסום/ }).click({ timeout: 3000 }).catch(() => {})
  await expect(manager.page.getByRole('button', { name: /פורסם/ })).toBeVisible({ timeout: 15000 })

  // Employee reloads /me → banner appears.
  await emp.page.goto('/me')
  await expect(emp.page.getByText('סידור חדש פורסם')).toBeVisible({ timeout: 15000 })

  // Viewing the schedule marks it seen → banner gone on next /me visit.
  await emp.page.goto('/me/schedule')
  await expect(emp.page.getByRole('heading', { name: 'הסידור השבועי' })).toBeVisible({ timeout: 15000 })
  await emp.page.goto('/me')
  await expect(emp.page.getByRole('heading', { name: /שלום/ })).toBeVisible({ timeout: 15000 })
  await expect(emp.page.getByText('סידור חדש פורסם')).toHaveCount(0)

  await manager.context.close()
  await emp.context.close()
})
