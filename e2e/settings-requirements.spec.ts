import { test, expect, type Page } from '@playwright/test'

async function signupAndOnboard(page: Page) {
  const uuid = crypto.randomUUID().replace(/-/g, '').slice(0, 12)
  const email = `mgr+req+${uuid}@example.com`
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

test('settings page shows staffing requirements section', async ({ page }) => {
  await signupAndOnboard(page)
  await page.goto('/settings')
  await expect(
    page.getByRole('heading', { name: 'דרישות איוש' }),
  ).toBeVisible({ timeout: 10000 })
})

test('manager changes a shift role count via stepper → saves → reload → value persisted', async ({
  page,
}) => {
  await signupAndOnboard(page)
  await page.goto('/settings')

  // Wait for requirements section to load
  await expect(page.getByRole('heading', { name: 'דרישות איוש' })).toBeVisible({ timeout: 10000 })

  const requirementsSection = page.locator('section').filter({ hasText: 'דרישות איוש' })

  // Get the first count span value
  const countSpans = requirementsSection.locator('span').filter({ hasText: /^[0-9]$/ })
  const firstCountSpan = countSpans.first()
  const initialValue = await firstCountSpan.textContent()

  // Click the plus/increment button in the first stepper of the requirements section.
  // The Stepper renders [minus-btn][span:value][plus-btn] inside a flex div.
  const firstStepperGroup = requirementsSection.locator('div').filter({
    has: page.locator('span').filter({ hasText: /^[0-9]$/ }),
  }).first()

  // Second button in the stepper group is the increment (+)
  await firstStepperGroup.getByRole('button').nth(1).click()

  const expectedValue = String(Number(initialValue) + 1)
  await expect(firstCountSpan).toHaveText(expectedValue)

  // Save
  await requirementsSection.getByRole('button', { name: 'שמירה' }).click()
  await expect(requirementsSection.getByText('נשמר בהצלחה')).toBeVisible({ timeout: 10000 })

  // Reload and confirm value persisted
  await page.reload()
  await expect(page.getByRole('heading', { name: 'דרישות איוש' })).toBeVisible({ timeout: 10000 })

  const reloadedSection = page.locator('section').filter({ hasText: 'דרישות איוש' })
  const reloadedSpans = reloadedSection.locator('span').filter({ hasText: /^[0-9]$/ })
  await expect(reloadedSpans.first()).toHaveText(expectedValue, { timeout: 10000 })
})
