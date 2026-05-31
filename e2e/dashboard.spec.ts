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
  const roleSwitches = page.getByRole('switch')
  for (let i = 0; i < 3; i++) await roleSwitches.nth(i).click()
  await page.getByRole('button', { name: 'הוספת עובד' }).click()
  await expect(page.getByRole('heading', { name: 'עובד חדש' })).toBeHidden({ timeout: 10000 })
}

test('dashboard KPI cards render after fresh onboarding (empty state)', async ({ page }) => {
  await signupAndOnboard(page)
  await expect(page).toHaveURL(/\/dashboard/)
  await expect(page.getByText('אין נתונים להצגה עדיין')).toBeVisible({ timeout: 10000 })
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
  await expect(page.getByRole('heading', { name: 'שיבוץ אוטומטי' })).toBeVisible({ timeout: 10000 })
  await page.getByRole('button', { name: 'צור סידור אוטומטי' }).click()
  const coverage = page.getByTestId('coverage')
  await expect(coverage).toBeVisible({ timeout: 30000 })
  await page.getByRole('button', { name: 'פרסם סידור' }).click()
  await expect(page.getByRole('button', { name: /פורסם/ })).toBeVisible({ timeout: 10000 })

  // Go to dashboard
  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/dashboard/)

  // Coverage card (prominent, new)
  await expect(page.getByText('כיסוי השיבוץ')).toBeVisible({ timeout: 10000 })

  // New KPI labels
  await expect(page.getByText('משבצות לא מאוישות')).toBeVisible()
  await expect(page.getByText('משמרות 12 שעות')).toBeVisible()
  await expect(page.getByText('מתחת למינימום')).toBeVisible()
  await expect(page.getByText('בקשות שכובדו')).toBeVisible()

  // Secondary stats still present
  await expect(page.getByText('עובדים פעילים')).toBeVisible()
  await expect(page.getByText(/סה״כ שעות ה/)).toBeVisible()

  // Scope toggle: click חודש — secondary hours label updates
  await page.getByRole('button', { name: 'חודש' }).click()
  await expect(page).toHaveURL(/scope=month/)
  await expect(page.getByText('סה״כ שעות החודש')).toBeVisible({ timeout: 10000 })

  // Scope toggle: click שנה
  await page.getByRole('button', { name: 'שנה' }).click()
  await expect(page).toHaveURL(/scope=year/)
  await expect(page.getByText('סה״כ שעות השנה')).toBeVisible({ timeout: 10000 })

  // Back to שבוע
  await page.getByRole('button', { name: 'שבוע' }).click()
  await expect(page).toHaveURL(/scope=week/)
  await expect(page.getByText('סה״כ שעות השבוע')).toBeVisible({ timeout: 10000 })
})
