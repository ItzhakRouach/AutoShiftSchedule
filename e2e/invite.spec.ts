import { test, expect, Browser } from '@playwright/test'

async function signupAndOnboard(
  browser: Browser,
  email: string,
  password: string,
  orgName: string,
  workplaceName: string,
) {
  const context = await browser.newContext()
  const page = await context.newPage()

  await page.goto('/signup')
  await page.getByLabel('אימייל').fill(email)
  await page.getByLabel('סיסמה').fill(password)
  await page.getByRole('button', { name: 'הרשמה' }).click()
  await expect(page).toHaveURL(/\/onboarding/, { timeout: 15000 })

  await page.getByLabel('שם הארגון').fill(orgName)
  await page.getByLabel('שם מקום העבודה').fill(workplaceName)
  await page.getByRole('button', { name: 'יצירת מקום עבודה' }).click()
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 })

  return { page, context }
}

test('manager creates invite, employee joins via /join/[code] and lands on /me', async ({
  browser,
}) => {
  const uuid = crypto.randomUUID().replace(/-/g, '').slice(0, 10)
  const managerEmail = `mgr+${uuid}@example.com`
  const managerPassword = 'TestPass123!'
  const orgName = `ארגון ${uuid}`
  const workplaceName = `מקום עבודה ${uuid}`

  // ── 1. Manager signs up, onboards, navigates to /team ────────────────────
  const { page: managerPage, context: managerContext } = await signupAndOnboard(
    browser,
    managerEmail,
    managerPassword,
    orgName,
    workplaceName,
  )

  await managerPage.goto('/team')
  await expect(managerPage).toHaveURL(/\/team/, { timeout: 10000 })

  // ── 2. Manager creates an invite ────────────────────────────────────────
  await managerPage.getByRole('button', { name: 'צור קוד הזמנה' }).click()

  // Wait for code to appear (8 uppercase chars)
  const codeEl = managerPage.locator('div[style*="monospace"]')
  await expect(codeEl).toBeVisible({ timeout: 10000 })
  const code = (await codeEl.textContent())?.trim() ?? ''
  expect(code).toMatch(/^[A-Z2-9]{8}$/)

  // Derive the join URL
  const joinUrl = `http://localhost:3000/join/${code}`

  // ── 3. Fresh employee context visits /join/[code] ───────────────────────
  const employeeContext = await browser.newContext()
  const employeePage = await employeeContext.newPage()

  await employeePage.goto(joinUrl)
  await expect(employeePage.getByRole('heading', { name: /הצטרפות ל/ })).toBeVisible({
    timeout: 10000,
  })
  await expect(employeePage.getByText(workplaceName)).toBeVisible()

  const empUuid = crypto.randomUUID().replace(/-/g, '').slice(0, 10)
  const empEmail = `emp+${empUuid}@example.com`
  const empPassword = 'EmpPass456!'
  const empName = 'ישראל ישראלי'

  await employeePage.getByLabel('שם מלא').fill(empName)
  await employeePage.getByLabel('אימייל').fill(empEmail)
  await employeePage.getByLabel('סיסמה').fill(empPassword)
  await employeePage.getByLabel('טלפון נייד').fill('0521234567')
  await employeePage.getByRole('button', { name: 'הצטרפות' }).click()

  // ── 4. Employee lands on /me with workplace name ─────────────────────────
  await expect(employeePage).toHaveURL(/\/me/, { timeout: 15000 })
  await expect(employeePage.getByText(empName)).toBeVisible({ timeout: 5000 })
  await expect(employeePage.getByText(workplaceName)).toBeVisible()

  await employeeContext.close()
  await managerContext.close()
})

test('invalid invite code shows friendly Hebrew error', async ({ page }) => {
  await page.goto('/join/INVALID0')
  await expect(page.getByText('הזמנה לא תקפה')).toBeVisible({ timeout: 10000 })
})

test('authenticated none-role user sees "join with current account" panel and joins without bouncing to /onboarding', async ({
  browser,
}) => {
  const uuid = crypto.randomUUID().replace(/-/g, '').slice(0, 10)
  const managerEmail = `mgr+${uuid}@example.com`
  const managerPassword = 'TestPass123!'
  const orgName = `ארגון ${uuid}`
  const workplaceName = `מקום עבודה ${uuid}`

  // ── 1. Manager sets up a workplace and invite ────────────────────────────
  const { page: managerPage, context: managerContext } = await signupAndOnboard(
    browser,
    managerEmail,
    managerPassword,
    orgName,
    workplaceName,
  )

  await managerPage.goto('/team')
  await expect(managerPage).toHaveURL(/\/team/, { timeout: 10000 })
  await managerPage.getByRole('button', { name: 'צור קוד הזמנה' }).click()
  const codeEl = managerPage.locator('div[style*="monospace"]')
  await expect(codeEl).toBeVisible({ timeout: 10000 })
  const code = (await codeEl.textContent())?.trim() ?? ''
  expect(code).toMatch(/^[A-Z2-9]{8}$/)
  const joinUrl = `http://localhost:3000/join/${code}`

  // ── 2. A fresh user signs up (lands on /onboarding, role = none) ─────────
  const empUuid = crypto.randomUUID().replace(/-/g, '').slice(0, 10)
  const empEmail = `none+${empUuid}@example.com`
  const empPassword = 'EmpPass456!'

  const noneContext = await browser.newContext()
  const nonePage = await noneContext.newPage()

  await nonePage.goto('/signup')
  await nonePage.getByLabel('אימייל').fill(empEmail)
  await nonePage.getByLabel('סיסמה').fill(empPassword)
  await nonePage.getByRole('button', { name: 'הרשמה' }).click()
  await expect(nonePage).toHaveURL(/\/onboarding/, { timeout: 15000 })

  // ── 3. Navigate to the invite link — must NOT bounce back to /onboarding ─
  await nonePage.goto(joinUrl)
  await expect(nonePage).not.toHaveURL(/\/onboarding/, { timeout: 8000 })

  // Should see the join-with-current-account panel
  await expect(nonePage.getByRole('heading', { name: /הצטרפות ל/ })).toBeVisible({
    timeout: 10000,
  })
  // The authenticated panel must NOT show email/password fields
  await expect(nonePage.getByLabel('אימייל')).not.toBeVisible()
  await expect(nonePage.getByLabel('סיסמה')).not.toBeVisible()

  // ── 4. Fill the authenticated join form and submit ───────────────────────
  const empName = 'עובד מאומת'
  await nonePage.getByLabel('שם מלא').fill(empName)
  await nonePage.getByLabel('טלפון נייד').fill('0521234567')
  await nonePage.getByText('משרה חלקית', { exact: true }).click()
  await nonePage.getByRole('button', { name: /הצטרפות עם החשבון/ }).click()

  // ── 5. Lands on /me ──────────────────────────────────────────────────────
  await expect(nonePage).toHaveURL(/\/me/, { timeout: 15000 })
  await expect(nonePage.getByText(empName)).toBeVisible({ timeout: 5000 })
  await expect(nonePage.getByText(workplaceName)).toBeVisible()

  await noneContext.close()
  await managerContext.close()
})

test('employee joins as student + Shabbat observer and lands on /me', async ({ browser }) => {
  const uuid = crypto.randomUUID().replace(/-/g, '').slice(0, 10)
  const managerEmail = `mgr+${uuid}@example.com`
  const managerPassword = 'TestPass123!'
  const orgName = `ארגון ${uuid}`
  const workplaceName = `מקום עבודה ${uuid}`

  // ── 1. Manager signs up, onboards ────────────────────────────────────────
  const { page: managerPage, context: managerContext } = await signupAndOnboard(
    browser,
    managerEmail,
    managerPassword,
    orgName,
    workplaceName,
  )

  await managerPage.goto('/team')
  await expect(managerPage).toHaveURL(/\/team/, { timeout: 10000 })

  // ── 2. Manager creates an invite ─────────────────────────────────────────
  await managerPage.getByRole('button', { name: 'צור קוד הזמנה' }).click()
  const codeEl = managerPage.locator('div[style*="monospace"]')
  await expect(codeEl).toBeVisible({ timeout: 10000 })
  const code = (await codeEl.textContent())?.trim() ?? ''
  expect(code).toMatch(/^[A-Z2-9]{8}$/)

  const joinUrl = `http://localhost:3000/join/${code}`

  // ── 3. Fresh employee context ─────────────────────────────────────────────
  const employeeContext = await browser.newContext()
  const employeePage = await employeeContext.newPage()

  await employeePage.goto(joinUrl)
  await expect(employeePage.getByRole('heading', { name: /הצטרפות ל/ })).toBeVisible({
    timeout: 10000,
  })

  const empUuid = crypto.randomUUID().replace(/-/g, '').slice(0, 10)
  const empEmail = `emp+${empUuid}@example.com`
  const empPassword = 'EmpPass456!'
  const empName = 'שומר שבת ישראלי'

  await employeePage.getByLabel('שם מלא').fill(empName)
  await employeePage.getByLabel('אימייל').fill(empEmail)
  await employeePage.getByLabel('סיסמה').fill(empPassword)
  await employeePage.getByLabel('טלפון נייד').fill('0521234567')

  // Choose "סטודנט" — radio is visually hidden inside a label, click the label text
  await employeePage.getByText('סטודנט', { exact: true }).click()

  // Check Shabbat observer checkbox
  await employeePage.getByText(/שומר\/ת שבת/).click()

  await employeePage.getByRole('button', { name: 'הצטרפות' }).click()

  // ── 4. Employee lands on /me ──────────────────────────────────────────────
  await expect(employeePage).toHaveURL(/\/me/, { timeout: 15000 })
  await expect(employeePage.getByText(empName)).toBeVisible({ timeout: 5000 })

  await employeeContext.close()
  await managerContext.close()
})
