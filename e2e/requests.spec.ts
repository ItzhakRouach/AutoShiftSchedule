import { test, expect, type Browser, type Page } from '@playwright/test'

async function signupAndOnboard(
  browser: Browser,
  email: string,
  password: string,
  orgName: string,
  workplaceName: string,
): Promise<{ page: Page; context: Awaited<ReturnType<Browser['newContext']>> }> {
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

test('employee requests: full flow (mark day-off, preferred shift, vacation)', async ({ browser }) => {
  test.setTimeout(120_000)
  const uuid = crypto.randomUUID().replace(/-/g, '').slice(0, 10)
  const managerEmail = `mgr+${uuid}@example.com`
  const password = 'TestPass123!'
  const orgName = `ארגון ${uuid}`
  const workplaceName = `מקום עבודה ${uuid}`

  // ── 1. Manager signs up + onboards ──────────────────────────────────────
  const { page: managerPage, context: managerContext } = await signupAndOnboard(
    browser, managerEmail, password, orgName, workplaceName,
  )

  // ── 2. Manager creates invite ────────────────────────────────────────────
  await managerPage.goto('/team')
  await managerPage.getByRole('button', { name: 'צור קוד הזמנה' }).click()
  const codeEl = managerPage.locator('div[style*="monospace"]')
  await expect(codeEl).toBeVisible({ timeout: 10000 })
  const code = (await codeEl.textContent())?.trim() ?? ''
  expect(code).toMatch(/^[A-Z2-9]{8}$/)

  // ── 3. Employee signs up via join link ───────────────────────────────────
  const empUuid = crypto.randomUUID().replace(/-/g, '').slice(0, 10)
  const empEmail = `emp+${empUuid}@example.com`
  const empPassword = 'EmpPass456!'
  const empName = 'ישראל ישראלי'

  const empContext = await browser.newContext()
  const empPage = await empContext.newPage()

  await empPage.goto(`/join/${code}`)
  await expect(empPage.getByRole('heading', { name: /הצטרפות/ })).toBeVisible({ timeout: 10000 })
  await empPage.getByLabel('שם מלא').fill(empName)
  await empPage.getByLabel('אימייל').fill(empEmail)
  await empPage.getByLabel('סיסמה').fill(empPassword)
  await empPage.getByRole('button', { name: 'הצטרפות' }).click()
  await expect(empPage).toHaveURL(/\/me$/, { timeout: 15000 })

  // ── 4. Employee navigates to /me/requests ────────────────────────────────
  await empPage.getByRole('link', { name: /הגשת בקשות/ }).click()
  await expect(empPage).toHaveURL(/\/me\/requests/, { timeout: 10000 })
  const heading = empPage.getByRole('heading', { name: 'הבקשות שלי' })
  await expect(heading).toBeVisible({ timeout: 10000 })

  // ── 5. Mark day 0 (ראשון) as day-off ────────────────────────────────────
  // The DayList renders 7 cards. Find by the day name text inside the card.
  await empPage.getByText('ראשון', { exact: true }).first().click()

  // Sheet opens — wait for the day-off toggle text
  await expect(empPage.getByText('יום חופש / לא זמין')).toBeVisible({ timeout: 8000 })
  await empPage.getByText('יום חופש / לא זמין').click()

  // Save and wait for the sheet to close (day card shows "יום חופש" chip)
  await empPage.getByRole('button', { name: 'שמירה' }).click()
  await expect(empPage.locator('span').filter({ hasText: 'יום חופש' })).toBeVisible({ timeout: 8000 })

  // ── 6. Select a preferred shift on day 1 (שני) ──────────────────────────
  // Wait for sheet to be fully closed before clicking next card
  await expect(empPage.getByText('יום חופש / לא זמין')).not.toBeVisible({ timeout: 5000 })

  await empPage.getByText('שני', { exact: true }).first().click()

  // Wait for sheet title that contains "שני"
  await expect(empPage.locator('h2').filter({ hasText: 'שני' })).toBeVisible({ timeout: 8000 })

  // The shift buttons are inside the Sheet. Click the "בוקר" shift row.
  // Each shift button has name div with exact shift name text.
  const morningShiftBtn = empPage.locator('button').filter({ has: empPage.locator('div', { hasText: 'בוקר' }) }).first()
  await morningShiftBtn.click()

  await empPage.getByRole('button', { name: 'שמירה' }).click()

  // After save, the sheet closes. The "שני" card now shows a "בוקר" chip.
  await expect(empPage.locator('span').filter({ hasText: 'בוקר' })).toBeVisible({ timeout: 8000 })

  // ── 7. Reload and assert persistence ────────────────────────────────────
  await empPage.reload()
  await expect(empPage).toHaveURL(/\/me\/requests/)
  await expect(empPage.locator('span').filter({ hasText: 'יום חופש' })).toBeVisible({ timeout: 10000 })
  await expect(empPage.locator('span').filter({ hasText: 'בוקר' })).toBeVisible()

  // ── 8. Add a vacation range ──────────────────────────────────────────────
  await empPage.getByLabel('תאריך התחלה').fill('2026-07-01')
  await empPage.getByLabel('תאריך סיום').fill('2026-07-07')
  await empPage.getByRole('button', { name: 'הוסף חופשה' }).click()
  await expect(empPage.getByText('2026-07-01 – 2026-07-07')).toBeVisible({ timeout: 8000 })

  // Reload and assert vacation persists
  await empPage.reload()
  await expect(empPage.getByText('2026-07-01 – 2026-07-07')).toBeVisible({ timeout: 10000 })

  await empContext.close()
  await managerContext.close()
})
