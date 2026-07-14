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

// ── Forgot / reset password ────────────────────────────────────────────────

test('forgot-password: reachable from login, submitting shows a success message', async ({ page }) => {
  await page.goto('/login')
  await page.getByRole('link', { name: 'שכחתי סיסמה?' }).click()
  await expect(page).toHaveURL(/\/forgot-password/)
  await expect(page.getByRole('heading', { name: 'שכחתי סיסמה' })).toBeVisible()

  const uuid = crypto.randomUUID().replace(/-/g, '').slice(0, 10)
  await page.getByLabel('אימייל').fill(`nobody+${uuid}@example.com`)
  await page.getByRole('button', { name: 'שליחת קישור לאיפוס' }).click()
  await expect(page.getByText(/נשלח אליו קישור לאיפוס/)).toBeVisible({ timeout: 10000 })
})

test('reset-password without a recovery session shows the expired-link card, not the form', async ({ page }) => {
  await page.goto('/reset-password')
  await expect(page.getByRole('heading', { name: 'הקישור אינו תקף' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'בקשת קישור חדש' })).toBeVisible()
  await expect(page.getByLabel('סיסמה חדשה')).not.toBeVisible()
})

test('failed reset-link exchange surfaces an explanation on /forgot-password', async ({ page }) => {
  // /auth/callback redirects here with ?error=1 when the code exchange fails
  // (expired link, or opened in a browser without the PKCE verifier cookie).
  await page.goto('/forgot-password?error=1')
  await expect(page.getByText(/הקישור לאיפוס פג תוקף/)).toBeVisible()
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

// ── Top nav: desktop-width persistent bar (hamburger dropdown is mobile-only,
// hidden via CSS `display: none !important` at Playwright's default ≥1024px
// viewport) — tabs and logout are both visible immediately, no menu needed. ──

test('logged-in manager sees "התנתקות" in the persistent top nav, and clicking it lands on /login', async ({
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

  // Desktop viewport: logout is a persistent icon button in the top bar —
  // no menu to open. (The hamburger + dropdown only render at mobile widths.)
  await expect(page.getByRole('button', { name: 'תפריט' })).toBeHidden()
  const logoutBtn = page.getByRole('button', { name: 'התנתקות' })
  await expect(logoutBtn).toBeVisible()

  // Click logout → lands on /login
  await logoutBtn.click()
  await expect(page).toHaveURL(/\/login/, { timeout: 10000 })
})

test('persistent top-nav tab bar navigates to a tab', async ({ page }) => {
  const uuid = crypto.randomUUID().replace(/-/g, '').slice(0, 12)
  const email = `test+nav+${uuid}@example.com`
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

  // Desktop viewport: tabs are inline in the top bar already — no menu to
  // open. Scope to the nav landmark since "עובדים" also substring-matches the
  // onboarding checklist's "הוספת עובדים" link on the dashboard.
  const nav = page.getByRole('navigation', { name: 'ניווט' })
  await expect(nav.getByRole('link', { name: 'עובדים', exact: true })).toBeVisible()
  await nav.getByRole('link', { name: 'עובדים', exact: true }).click()
  await expect(page).toHaveURL(/\/team/, { timeout: 10000 })
})
