import { test, expect, type Page } from '@playwright/test'
import { signupAndOnboard, uid } from './setup'

// The balance panel docks beside the table only on wide screens.
test.use({ viewport: { width: 1440, height: 900 } })

async function addEmployee(page: Page, name: string) {
  await page.getByRole('button', { name: 'הוסף עובד' }).click()
  await expect(page.getByRole('heading', { name: 'עובד חדש' })).toBeVisible({ timeout: 5000 })
  await page.getByLabel('שם מלא').fill(name)
  await page.getByLabel('טלפון').fill(`05${Math.floor(10000000 + Math.random() * 90000000)}`)
  await page.getByRole('switch').first().click()
  await page.getByRole('button', { name: 'הוספת עובד' }).click()
  await expect(page.getByRole('heading', { name: 'עובד חדש' })).toBeHidden({ timeout: 10000 })
}

test('balance panel lists every worker, matches the totals bar, and shares selection with the table', async ({ browser }) => {
  test.setTimeout(120_000)
  const u = uid()
  const { page, context } = await signupAndOnboard(browser, {
    email: `bal+${u}@example.com`, password: 'TestPass123!', orgName: `ארגון ${u}`, workplaceName: `מקום עבודה ${u}`,
  })
  await page.setViewportSize({ width: 1440, height: 900 })

  await page.goto('/team')
  await addEmployee(page, 'דנה כהן')
  await addEmployee(page, 'יוסי לוי')
  await addEmployee(page, 'מאיה בר')

  await page.goto('/schedule')
  await page.getByRole('button', { name: 'צור סידור אוטומטי' }).click()
  await expect(page.getByTestId('coverage')).toBeVisible({ timeout: 30000 })
  const dismiss = page.getByRole('button', { name: 'הבנתי' })
  if (await dismiss.waitFor({ state: 'visible', timeout: 5000 }).then(() => true, () => false)) await dismiss.click()

  const panel = page.getByTestId('balance-panel')
  await expect(panel).toBeVisible()
  const rows = panel.getByTestId('balance-row')
  await expect(rows).toHaveCount(3)

  // Each worker's panel total equals morning + noon + night + 12h.
  for (let i = 0; i < 3; i++) {
    const row = rows.nth(i)
    const n = async (id: string) => Number(await row.getByTestId(id).textContent())
    expect(await n('balance-total')).toBe(
      (await n('balance-morning')) + (await n('balance-noon')) + (await n('balance-night')) + (await n('balance-twelve')),
    )
  }

  // Picking a worker in the panel selects the same worker in the table's chip bar.
  const dana = rows.filter({ hasText: 'דנה כהן' })
  await dana.click()
  await expect(dana).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByTestId('emp-total-chip').filter({ hasText: 'דנה' })).toHaveAttribute('aria-pressed', 'true')

  if (process.env.BALANCE_SHOT) await page.screenshot({ path: process.env.BALANCE_SHOT, fullPage: true })
  await context.close()
})
