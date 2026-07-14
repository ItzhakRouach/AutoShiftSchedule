import { test, expect, type Page } from '@playwright/test'

async function signupAndOnboard(page: Page) {
  const uuid = crypto.randomUUID().replace(/-/g, '').slice(0, 12)
  const email = `mgr+dash+${uuid}@example.com`
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
  return { email, uuid }
}

async function addEmployee(page: Page, name: string) {
  await page.getByRole('button', { name: 'הוסף עובד' }).click()
  await expect(page.getByRole('heading', { name: 'עובד חדש' })).toBeVisible({ timeout: 5000 })
  await page.getByLabel('שם מלא').fill(name)
  await page.getByLabel('טלפון').fill(`05${Math.floor(10000000 + Math.random() * 90000000)}`)
  // Senior role (אחמ״ש) auto-qualifies for all lower roles via the rank hierarchy.
  await page.getByRole('switch').first().click()
  await page.getByRole('button', { name: 'הוספת עובד' }).click()
  await expect(page.getByRole('heading', { name: 'עובד חדש' })).toBeHidden({ timeout: 10000 })
}

/** CoverageIssues is a fullscreen popup that auto-opens after generation
 *  whenever slots were left uncovered or off-requests overridden — nearly
 *  always with small e2e seeds. Its scrim swallows clicks, so dismiss it
 *  (if it appeared) before interacting with anything underneath. */
async function dismissCoverageIssues(page: Page) {
  const dismiss = page.getByRole('button', { name: 'הבנתי' })
  const appeared = await dismiss.waitFor({ state: 'visible', timeout: 4000 }).then(() => true, () => false)
  if (appeared) {
    await dismiss.click()
    await expect(dismiss).toBeHidden({ timeout: 5000 })
  }
}

test('dashboard shows onboarding steps instead of KPI cards before any employees exist (empty state)', async ({ page }) => {
  await signupAndOnboard(page)
  await expect(page).toHaveURL(/\/dashboard/)
  // With zero active employees the dashboard renders the onboarding checklist
  // (3 steps) in place of the KPI grid.
  await expect(page.getByText('ברוכים הבאים 👋 בואו נתחיל')).toBeVisible({ timeout: 10000 })
  await expect(page.getByRole('link', { name: /הוספת עובדים/ })).toBeVisible()
  await expect(page.getByRole('link', { name: /הגדרת תפקידים ומשמרות/ })).toBeVisible()
  await expect(page.getByRole('link', { name: /יצירת הסידור הראשון/ })).toBeVisible()
  // KPI grid must NOT render yet.
  await expect(page.getByText('משבצות לא מאוישות')).not.toBeVisible()
})

test('dashboard shows new KPIs after schedule is published', async ({ page }) => {
  test.setTimeout(150_000)
  await signupAndOnboard(page)

  // Add employees
  await page.goto('/team')
  await expect(page).toHaveURL(/\/team/, { timeout: 10000 })
  await addEmployee(page, 'דנה כהן')
  await addEmployee(page, 'יוסי לוי')
  await addEmployee(page, 'מאיה בר')

  // Generate + publish schedule
  await page.goto('/schedule')
  await expect(page.getByRole('heading', { name: 'סידור עבודה' })).toBeVisible({ timeout: 10000 })
  await page.getByRole('button', { name: 'צור סידור אוטומטי' }).click()
  const coverage = page.getByTestId('coverage')
  await expect(coverage).toBeVisible({ timeout: 30000 })
  await dismissCoverageIssues(page)
  await page.getByRole('button', { name: 'פרסם סידור' }).click()
  // Incomplete coverage arms an inline two-step confirm — click again to publish.
  const confirmPublish = page.getByRole('button', { name: /לחצו שוב לפרסום/ })
  await confirmPublish.click({ timeout: 3000 }).catch(() => {}) // absent when coverage is full
  await expect(page.getByRole('button', { name: /פורסם/ })).toBeVisible({ timeout: 10000 })

  // After publishing, the WhatsApp share link appears.
  await expect(page.getByRole('link', { name: 'שתף בוואטסאפ' })).toBeVisible({ timeout: 10000 })

  // Go to dashboard
  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/dashboard/)

  // Coverage card (prominent)
  await expect(page.getByText('כיסוי השיבוץ')).toBeVisible({ timeout: 10000 })

  // KPI labels — current set
  await expect(page.getByText('משבצות לא מאוישות')).toBeVisible()
  await expect(page.getByText('משמרות 12 שעות')).toBeVisible()
  await expect(page.getByText('מתחת למינימום')).toBeVisible()
  // Below-min clarifying subtitle
  await expect(page.getByText('עובדים שקיבלו פחות ממינימום המשמרות שהוגדר להם')).toBeVisible()

  // Requests-honored KPI (professional wording, no ≥ symbols)
  await expect(page.getByText('כיבוד בקשות עובדים')).toBeVisible()

  // Secondary stats — active employees still present
  await expect(page.getByText('עובדים פעילים')).toBeVisible()

  // Removed metrics must NOT appear
  await expect(page.getByText(/סה״כ שעות ה/)).not.toBeVisible()
  await expect(page.getByText(/פילוח לפי תפקיד/)).not.toBeVisible()

  // Scope toggle still works
  await page.getByRole('button', { name: 'חודש' }).click()
  await expect(page).toHaveURL(/scope=month/)

  await page.getByRole('button', { name: 'שנה' }).click()
  await expect(page).toHaveURL(/scope=year/)

  await page.getByRole('button', { name: 'שבוע' }).click()
  await expect(page).toHaveURL(/scope=week/)
})
