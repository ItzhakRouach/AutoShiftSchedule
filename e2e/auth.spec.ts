import { test, expect } from '@playwright/test'

// ── Role-select landing ────────────────────────────────────────────────────

test('root / shows role-select cards', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('link', { name: /כניסת מנהל/ })).toBeVisible()
  await expect(page.getByRole('link', { name: /כניסת עובד/ })).toBeVisible()
})

test('clicking "כניסת מנהל" goes to /login?as=manager with signup link', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: /כניסת מנהל/ }).click()
  await expect(page).toHaveURL(/\/login\?as=manager/)
  await expect(page.getByRole('heading', { name: 'כניסת מנהל' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'הרשמה' })).toBeVisible()
})

test('clicking "כניסת עובד" goes to /login?as=employee with invite note, no signup link', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: /כניסת עובד/ }).click()
  await expect(page).toHaveURL(/\/login\?as=employee/)
  await expect(page.getByRole('heading', { name: 'כניסת עובד' })).toBeVisible()
  await expect(page.getByText(/הצטרפת דרך קישור הזמנה/)).toBeVisible()
  await expect(page.getByRole('link', { name: 'הרשמה' })).not.toBeVisible()
})

test('/login without ?as defaults to manager copy (signup link visible)', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByRole('heading', { name: 'כניסת מנהל' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'הרשמה' })).toBeVisible()
})

// ── Existing auth tests ────────────────────────────────────────────────────

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

  // Lands on dashboard with the workplace name and scope toggle
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 })
  await expect(page.getByRole('heading', { name: workplaceName })).toBeVisible()
  await expect(page.getByRole('button', { name: 'שבוע' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'חודש' })).toBeVisible()
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

// ── Logout in bottom nav ───────────────────────────────────────────────────

test('logged-in manager sees "התנתקות" in bottom nav and clicking it lands on /login', async ({
  page,
}) => {
  const uuid = crypto.randomUUID().replace(/-/g, '').slice(0, 12)
  const email = `test+${uuid}@example.com`
  const password = 'TestPass123!'
  const orgName = `ארגון ${uuid}`
  const workplaceName = `מקום עבודה ${uuid}`

  // Sign up + complete onboarding
  await page.goto('/signup')
  await page.getByLabel('אימייל').fill(email)
  await page.getByLabel('סיסמה').fill(password)
  await page.getByRole('button', { name: 'הרשמה' }).click()
  await expect(page).toHaveURL(/\/onboarding/, { timeout: 15000 })

  await page.getByLabel('שם הארגון').fill(orgName)
  await page.getByLabel('שם מקום העבודה').fill(workplaceName)
  await page.getByRole('button', { name: 'יצירת מקום עבודה' }).click()
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 })

  // Bottom nav shows logout button
  await expect(page.getByRole('button', { name: 'התנתקות' })).toBeVisible()

  // Click logout → lands on /login
  await page.getByRole('button', { name: 'התנתקות' }).click()
  await expect(page).toHaveURL(/\/login/, { timeout: 10000 })
})
