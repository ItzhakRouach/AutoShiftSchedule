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

  // Derive the join URL (relative — resolved against the configured baseURL)
  const joinUrl = `/join/${code}`

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

  // ── 5. Employee can open the weekly schedule page. Nothing is published yet,
  // so the page shows the dedicated empty state instead of the schedule header.
  await employeePage.getByRole('link', { name: /הסידור השבועי/ }).click()
  await expect(employeePage).toHaveURL(/\/me\/schedule/, { timeout: 10000 })
  await expect(employeePage.getByRole('heading', { name: 'עדיין לא פורסם סידור עבודה' })).toBeVisible({ timeout: 10000 })

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
  const joinUrl = `/join/${code}`

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

test('manager-created employee is claimed via the ?e= link even when the invitee changes name AND phone — no duplicate row', async ({
  browser,
}) => {
  const uuid = crypto.randomUUID().replace(/-/g, '').slice(0, 10)
  const managerGivenName = `דנה מהמנהל ${uuid}`
  const typedName = `דנה כהן ${uuid}`

  // ── 1. Manager sets up a workplace and pre-creates a pending employee ─────
  const { page: managerPage, context: managerContext } = await signupAndOnboard(
    browser,
    `mgr+${uuid}@example.com`,
    'TestPass123!',
    `ארגון ${uuid}`,
    `מקום עבודה ${uuid}`,
  )
  await managerPage.goto('/team')
  await managerPage.getByRole('button', { name: 'הוסף עובד' }).click()
  await managerPage.getByLabel('שם מלא').fill(managerGivenName)
  await managerPage.getByLabel(/טלפון/).fill('0529999999')
  await managerPage.getByText('מאבטח', { exact: true }).first().click()
  await managerPage.getByRole('button', { name: 'הוספת עובד' }).click()
  await expect(managerPage.getByText(managerGivenName)).toBeVisible({ timeout: 10000 })
  await expect(managerPage.getByText('טרם הצטרף')).toBeVisible()

  // ── 2. Capture the personal wa.me invite and extract the ?e= join link ────
  await managerPage.evaluate(() => {
    ;(window as unknown as { __wa?: string }).__wa = undefined
    window.open = ((url: string) => {
      ;(window as unknown as { __wa?: string }).__wa = String(url)
      return null
    }) as typeof window.open
  })
  await managerPage.getByTestId('resend-invite').click()
  await expect
    .poll(async () => managerPage.evaluate(() => (window as unknown as { __wa?: string }).__wa), {
      timeout: 10000,
    })
    .toBeTruthy()
  const waUrl = await managerPage.evaluate(() => (window as unknown as { __wa?: string }).__wa!)
  const joinPath = decodeURIComponent(new URL(waUrl).searchParams.get('text') ?? '').match(
    /\/join\/[A-Z2-9]{8}\?e=[0-9a-f-]{36}/,
  )?.[0]
  expect(joinPath).toBeTruthy()

  // ── 3. Invitee opens the link, sees the prefill, then changes BOTH fields ─
  const employeeContext = await browser.newContext()
  const employeePage = await employeeContext.newPage()
  await employeePage.goto(joinPath!)
  await expect(employeePage.getByLabel('שם מלא')).toHaveValue(managerGivenName)
  // Phone stored in local form, prefilled as prefix dropdown (052) + dashed number.
  await expect(employeePage.getByLabel('קידומת')).toHaveValue('052')
  await expect(employeePage.getByLabel('טלפון נייד')).toHaveValue('999-9999')

  await employeePage.getByLabel('שם מלא').fill(typedName)
  await employeePage.getByLabel('אימייל').fill(`emp+${uuid}@example.com`)
  await employeePage.getByLabel('סיסמה').fill('EmpPass456!')
  await employeePage.getByLabel('טלפון נייד').fill('0521111111') // different phone!
  await employeePage.getByRole('button', { name: 'הצטרפות' }).click()
  await expect(employeePage).toHaveURL(/\/me/, { timeout: 15000 })

  // ── 4. Manager sees ONE row: the claimed one, no pending leftover ─────────
  await managerPage.reload()
  await expect(managerPage.getByText(typedName)).toBeVisible({ timeout: 10000 })
  await expect(managerPage.getByText(managerGivenName)).not.toBeVisible()
  await expect(managerPage.getByText('טרם הצטרף')).not.toBeVisible()

  await employeeContext.close()
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

  const joinUrl = `/join/${code}`

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
