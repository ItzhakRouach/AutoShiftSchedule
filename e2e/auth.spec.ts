import { test, expect } from '@playwright/test'

test('unauthenticated /dashboard redirects to /login', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/login/)
})

test('fresh signup lands on /onboarding (no org yet)', async ({ page }) => {
  const uuid = crypto.randomUUID().replace(/-/g, '').slice(0, 12)
  const email = `test+${uuid}@example.com`
  const password = 'TestPass123!'

  await page.goto('/signup')
  await page.getByLabel('אימייל').fill(email)
  await page.getByLabel('סיסמה').fill(password)
  await page.getByRole('button', { name: 'הרשמה' }).click()

  await expect(page).toHaveURL(/\/onboarding/, { timeout: 15000 })
})

test('full onboarding flow: signup → create workplace → dashboard with seeded data', async ({
  page,
}) => {
  const uuid = crypto.randomUUID().replace(/-/g, '').slice(0, 12)
  const email = `test+${uuid}@example.com`
  const password = 'TestPass123!'
  const orgName = `ארגון ${uuid}`
  const workplaceName = `מקום עבודה ${uuid}`

  // Sign up → onboarding
  await page.goto('/signup')
  await page.getByLabel('אימייל').fill(email)
  await page.getByLabel('סיסמה').fill(password)
  await page.getByRole('button', { name: 'הרשמה' }).click()
  await expect(page).toHaveURL(/\/onboarding/, { timeout: 15000 })

  // Complete onboarding
  await page.getByLabel('שם הארגון').fill(orgName)
  await page.getByLabel('שם מקום העבודה').fill(workplaceName)
  await page.getByRole('button', { name: 'יצירת מקום עבודה' }).click()

  // Lands on dashboard with the workplace name and seeded counts
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 })
  await expect(page.getByRole('heading', { name: workplaceName })).toBeVisible()
  await expect(page.getByText('תפקידים: 3')).toBeVisible()
  await expect(page.getByText('סוגי משמרת: 7')).toBeVisible()
})

test('authenticated user with org is redirected away from /login and /onboarding', async ({
  page,
}) => {
  const uuid = crypto.randomUUID().replace(/-/g, '').slice(0, 12)
  const email = `test+${uuid}@example.com`
  const password = 'TestPass123!'
  const orgName = `ארגון ${uuid}`
  const workplaceName = `מקום עבודה ${uuid}`

  // Sign up → onboarding → complete onboarding → dashboard
  await page.goto('/signup')
  await page.getByLabel('אימייל').fill(email)
  await page.getByLabel('סיסמה').fill(password)
  await page.getByRole('button', { name: 'הרשמה' }).click()
  await expect(page).toHaveURL(/\/onboarding/, { timeout: 15000 })

  await page.getByLabel('שם הארגון').fill(orgName)
  await page.getByLabel('שם מקום העבודה').fill(workplaceName)
  await page.getByRole('button', { name: 'יצירת מקום עבודה' }).click()
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 })

  // Authenticated → /login should bounce to /dashboard
  await page.goto('/login')
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 })

  // Authenticated with org → /onboarding should bounce to /dashboard
  // (no redirect loop, no second org created)
  await page.goto('/onboarding')
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 })
  await expect(page.getByRole('heading', { name: workplaceName })).toBeVisible()
})
