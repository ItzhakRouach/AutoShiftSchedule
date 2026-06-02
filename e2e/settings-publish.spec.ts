import { test, expect, type Page } from '@playwright/test'

async function signupAndOnboard(page: Page) {
  const uuid = crypto.randomUUID().replace(/-/g, '').slice(0, 12)
  const email = `mgr+publish+${uuid}@example.com`
  const password = 'TestPass123!'

  await page.goto('/signup')
  await page.getByLabel('אימייל').fill(email)
  await page.getByLabel('סיסמה').fill(password)
  await page.getByRole('button', { name: 'הרשמה' }).click()
  await expect(page).toHaveURL(/\/onboarding/, { timeout: 15000 })

  await page.getByLabel('שם הארגון').fill(`ארגון ${uuid}`)
  await page.getByLabel('שם מקום העבודה').fill(`מקום עבודה ${uuid}`)
  await page.getByRole('button', { name: 'יצירת מקום עבודה' }).click()
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 })
}

test('settings page shows publish section', async ({ page }) => {
  await signupAndOnboard(page)
  await page.goto('/settings')
  await expect(page.getByRole('heading', { name: 'פרסום אוטומטי לווטסאפ' })).toBeVisible({ timeout: 10000 })
})

test('manager sets publish day + time → saved → reload → values persisted', async ({ page }) => {
  await signupAndOnboard(page)
  await page.goto('/settings')

  // Select Saturday (index 6) as publish day
  await page.locator('select[name="publish_dow"]').selectOption('6')
  // Set publish time
  await page.locator('input[name="publish_time"]').fill('09:00')
  // Submit
  await page.getByRole('button', { name: 'שמור הגדרות פרסום' }).click()
  await expect(page.getByText('הגדרות הפרסום נשמרו')).toBeVisible({ timeout: 10000 })

  // Reload and verify persistence
  await page.reload()
  await expect(page.locator('select[name="publish_dow"]')).toHaveValue('6', { timeout: 10000 })
  // DB stores time as HH:MM:SS; browser input shows HH:MM — match either
  await expect(page.locator('input[name="publish_time"]')).toHaveValue(/^09:00/)
})

test('manager enables WhatsApp auto-send, sets group JID → saved → reload → value persisted', async ({ page }) => {
  await signupAndOnboard(page)
  await page.goto('/settings')

  // Set required day/time first
  await page.locator('select[name="publish_dow"]').selectOption('5')
  await page.locator('input[name="publish_time"]').fill('08:00')

  // Enable WhatsApp auto-send toggle
  await page.locator('#whatsapp-toggle').check()
  await expect(page.locator('input[name="whatsapp_group_jid"]')).toBeVisible({ timeout: 5000 })

  // Fill the group JID
  await page.locator('input[name="whatsapp_group_jid"]').fill('120363012345678901@g.us')

  // Save
  await page.getByRole('button', { name: 'שמור הגדרות פרסום' }).click()
  await expect(page.getByText('הגדרות הפרסום נשמרו')).toBeVisible({ timeout: 10000 })

  // Reload — toggle ON (field visible) with the group JID populated
  await page.reload()
  await expect(page.locator('input[name="whatsapp_group_jid"]')).toBeVisible({ timeout: 10000 })
  await expect(page.locator('input[name="whatsapp_group_jid"]')).toHaveValue('120363012345678901@g.us')
})
