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
