import { test, expect, type Page } from '@playwright/test'
import { signupAndOnboard, uid } from './setup'

async function addEmployee(page: Page, name: string) {
  await page.getByRole('button', { name: 'הוסף עובד' }).click()
  await expect(page.getByRole('heading', { name: 'עובד חדש' })).toBeVisible({ timeout: 5000 })
  await page.getByLabel('שם מלא').fill(name)
  await page.getByLabel('טלפון').fill(`05${Math.floor(10000000 + Math.random() * 90000000)}`)
  await page.getByRole('switch').first().click()
  await page.getByRole('button', { name: 'הוספת עובד' }).click()
  await expect(page.getByRole('heading', { name: 'עובד חדש' })).toBeHidden({ timeout: 10000 })
}

test('12h proposal: shown before saving, closes cells when approved, nothing saved on cancel', async ({ browser }) => {
  test.setTimeout(150_000)
  const u = uid()
  const { page, context } = await signupAndOnboard(browser, {
    email: `prop+${u}@example.com`, password: 'TestPass123!', orgName: `ארגון ${u}`, workplaceName: `מקום ${u}`,
  })
  // Two people for a role that needs someone on every shift: 8h shifts alone
  // leave most of the week open, day/night pairs cover more of it.
  await page.goto('/team')
  await addEmployee(page, 'דנה כהן')
  await addEmployee(page, 'יוסי לוי')

  await page.goto('/schedule')
  await page.getByRole('button', { name: 'שיבוץ אוטומטי' }).click()
  await expect(page.getByTestId('coverage')).toBeVisible({ timeout: 30000 })
  const gapsBefore = Number(await page.getByTestId('live-gaps').locator('div').first().textContent())

  // The issues popup offers the proposal directly.
  const propose = page.getByTestId('issues-propose-twelve')
  await expect(propose).toBeVisible({ timeout: 10000 })
  await propose.click()
  const sheet = page.getByTestId('twelve-proposal')
  await expect(sheet.getByTestId('proposal-summary')).toBeVisible({ timeout: 30000 })
  await expect(sheet.getByTestId('proposal-day').first()).toContainText('07:00–19:00')

  // Cancel saves nothing.
  await sheet.getByRole('button', { name: 'ביטול' }).click()
  await expect(sheet).toBeHidden()
  await page.reload()
  await expect(page.getByTestId('week-table')).toBeVisible({ timeout: 15000 })
  expect(Number(await page.getByTestId('live-gaps').locator('div').first().textContent())).toBe(gapsBefore)
  await expect(page.getByTestId('week-table').getByText('07:00–19:00')).toHaveCount(0)

  // Approve from the "עוד" menu: the pairs land in the table, fewer gaps remain.
  await page.locator(`[data-testid="schedule-actions-toggle"][aria-expanded="false"]`).click({ timeout: 3000 }).catch(() => {})
  await page.getByTestId('more-actions').click()
  await page.getByTestId('complete-twelve').click()
  await page.getByTestId('proposal-apply').click({ timeout: 30000 })
  await expect(page.getByTestId('week-table').getByText('07:00–19:00').first()).toBeVisible({ timeout: 30000 })
  await expect(async () => {
    expect(Number(await page.getByTestId('live-gaps').locator('div').first().textContent())).toBeLessThan(gapsBefore)
  }).toPass({ timeout: 15000 })
  await context.close()
})
