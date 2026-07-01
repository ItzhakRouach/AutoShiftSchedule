import { test, expect, type Page } from '@playwright/test'

/** Sign up → onboard → land on dashboard. */
async function signupAndOnboard(page: Page) {
  const uuid = crypto.randomUUID().replace(/-/g, '').slice(0, 12)
  const email = `img+${uuid}@example.com`
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

test('schedule image route returns a valid PNG for a published period', async ({ page, request }) => {
  test.setTimeout(180_000)
  await signupAndOnboard(page)

  // Add employees
  await page.goto('/team')
  await expect(page).toHaveURL(/\/team/, { timeout: 10000 })
  await addEmployee(page, 'דנה כהן')
  await addEmployee(page, 'יוסי לוי')
  await addEmployee(page, 'מאיה בר')

  // Generate schedule
  await page.goto('/schedule')
  await expect(page.getByRole('heading', { name: 'סידור עבודה' })).toBeVisible({ timeout: 10000 })
  await page.getByRole('button', { name: 'צור סידור אוטומטי' }).click()
  await expect(page.getByTestId('coverage')).toBeVisible({ timeout: 30000 })
  await dismissCoverageIssues(page)

  // Publish
  await page.getByRole('button', { name: 'פרסם סידור' }).click()
  await expect(page.getByRole('button', { name: /פורסם/ })).toBeVisible({ timeout: 15000 })

  // The share button should now appear
  await expect(page.getByRole('button', { name: 'שתף לקבוצה' })).toBeVisible({ timeout: 5000 })

  // Extract the periodId from the preview link href
  const previewLink = page.getByRole('link', { name: 'תצוגה מקדימה' })
  await expect(previewLink).toBeVisible({ timeout: 5000 })
  const href = await previewLink.getAttribute('href')
  expect(href).toMatch(/\/api\/schedule-image\/[a-f0-9-]+/)

  // GET the image route using the authenticated browser cookies
  const cookies = await page.context().cookies()
  const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ')

  const imgRes = await request.get(href!, {
    headers: { Cookie: cookieHeader },
  })

  expect(imgRes.status()).toBe(200)
  expect(imgRes.headers()['content-type']).toMatch(/image\/png/)

  const body = await imgRes.body()
  // A real PNG should be well over 10 KB
  expect(body.length).toBeGreaterThan(10_000)
})
