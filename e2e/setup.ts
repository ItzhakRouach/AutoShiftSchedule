/** Shared setup helpers for the requests/off-cap/miluim e2e specs.
 *
 * These mirror the local helpers already used by requests.spec.ts /
 * invite.spec.ts (signup+onboard, invite-code, join) — factored out so each new
 * spec stays self-contained AND well under the 200-line file limit. Every
 * selector/copy string here is traced to current component source (see
 * task report). Not a *.spec.ts file, so Playwright never runs it as a test.
 */
import { expect, type Browser, type BrowserContext, type Page } from '@playwright/test'

export interface UserSession {
  page: Page
  context: BrowserContext
}

/** Short unique token for per-test emails / org names — the suite runs against a
 *  shared cloud Supabase project, so every identity must be collision-free. */
export function uid(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 10)
}

/** Manager signs up and completes onboarding, landing on /dashboard. */
export async function signupAndOnboard(
  browser: Browser,
  creds: { email: string; password: string; orgName: string; workplaceName: string },
): Promise<UserSession> {
  const context = await browser.newContext()
  const page = await context.newPage()
  await page.goto('/signup')
  await page.getByLabel('אימייל').fill(creds.email)
  await page.getByLabel('סיסמה').fill(creds.password)
  await page.getByRole('button', { name: 'הרשמה' }).click()
  await expect(page).toHaveURL(/\/onboarding/, { timeout: 15000 })
  await page.getByLabel('שם הארגון').fill(creds.orgName)
  await page.getByLabel('שם מקום העבודה').fill(creds.workplaceName)
  await page.getByRole('button', { name: 'יצירת מקום עבודה' }).click()
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 })
  return { page, context }
}

/** Mint an invite code on /team and return it. Handles both the first-time panel
 *  ("צור קוד הזמנה") and the has-code panel ("צור קוד חדש" mints a replacement).
 *  Pass `previousCode` to wait until the freshly-minted code actually differs. */
export async function createInviteCode(managerPage: Page, previousCode?: string): Promise<string> {
  await managerPage.goto('/team')
  await expect(managerPage).toHaveURL(/\/team/, { timeout: 10000 })
  const codeEl = managerPage.locator('div[style*="monospace"]')
  const freshBtn = managerPage.getByRole('button', { name: 'צור קוד הזמנה' })
  if ((await freshBtn.count()) > 0) {
    await freshBtn.click()
  } else {
    await managerPage.getByRole('button', { name: 'צור קוד חדש' }).click()
  }
  await expect(codeEl).toBeVisible({ timeout: 10000 })
  if (previousCode) await expect(codeEl).not.toHaveText(previousCode, { timeout: 10000 })
  const code = (await codeEl.textContent())?.trim() ?? ''
  expect(code).toMatch(/^[A-Z2-9]{8}$/)
  return code
}

/** A fresh employee joins via /join/[code] and lands on /me. */
export async function joinEmployee(
  browser: Browser,
  code: string,
  emp: { name: string; email: string; password: string; phone?: string },
): Promise<UserSession> {
  const context = await browser.newContext()
  const page = await context.newPage()
  await page.goto(`/join/${code}`)
  await expect(page.getByRole('heading', { name: /הצטרפות/ })).toBeVisible({ timeout: 10000 })
  await page.getByLabel('שם מלא').fill(emp.name)
  await page.getByLabel('אימייל').fill(emp.email)
  await page.getByLabel('סיסמה').fill(emp.password)
  await page.getByLabel('טלפון נייד').fill(emp.phone ?? '0521234567')
  await page.getByRole('button', { name: 'הצטרפות' }).click()
  await expect(page).toHaveURL(/\/me/, { timeout: 15000 })
  return { page, context }
}

/** Navigate an employee to /me/requests and wait for the page heading. */
export async function openRequests(page: Page): Promise<void> {
  await page.getByRole('link', { name: /הגשת בקשות/ }).click()
  await expect(page).toHaveURL(/\/me\/requests/, { timeout: 10000 })
  await expect(page.getByRole('heading', { name: 'הבקשות שלי' })).toBeVisible({ timeout: 10000 })
}

/** Open a day card, toggle "יום חופש / לא זמין" ON, save, and wait until the
 *  day's off-chip appears and the sheet closes — i.e. the save succeeded. */
export async function markDayOff(page: Page, dayName: string): Promise<void> {
  await page.getByText(dayName, { exact: true }).first().click()
  const offToggle = page.getByText('יום חופש / לא זמין')
  await expect(offToggle).toBeVisible({ timeout: 8000 })
  await offToggle.click()
  await page.getByRole('button', { name: 'שמירה', exact: true }).click()
  const card = page.locator('.card-interactive').filter({ hasText: dayName })
  await expect(card.locator('span').filter({ hasText: 'יום חופש' })).toBeVisible({ timeout: 8000 })
  await expect(offToggle).not.toBeVisible({ timeout: 5000 })
}
