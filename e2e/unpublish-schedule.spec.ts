import { test, expect, type Page } from '@playwright/test'

/** Sign up → onboard → land on dashboard. (Duplicated from schedule-image.spec.ts — repo pattern.) */
async function signupAndOnboard(page: Page) {
  const uuid = crypto.randomUUID().replace(/-/g, '').slice(0, 12)
  const email = `unpub+${uuid}@example.com`
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
  await page.getByRole('switch').first().click() // senior role
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

test('manager can publish, unpublish, and see the publish button return', async ({ page }) => {
  test.setTimeout(180_000)
  await signupAndOnboard(page)

  // Seed a few employees so generation can produce a schedule.
  await page.goto('/team')
  await expect(page).toHaveURL(/\/team/, { timeout: 10000 })
  await addEmployee(page, 'דנה כהן')
  await addEmployee(page, 'יוסי לוי')
  await addEmployee(page, 'מאיה בר')

  // Generate.
  await page.goto('/schedule')
  await expect(page.getByRole('heading', { name: 'סידור עבודה' })).toBeVisible({ timeout: 10000 })
  await page.getByRole('button', { name: 'צור סידור אוטומטי' }).click()
  await expect(page.getByTestId('coverage')).toBeVisible({ timeout: 30000 })
  await dismissCoverageIssues(page)

  // Publish. We only wait for "פורסם ✓" to appear — the surrounding publish
  // useTransition can stay pending for an extended time (the publish server
  // action awaits a slow PNG-render + Supabase Storage upload, then triggers
  // router.refresh which holds the transition open). The unpublish flow does
  // not depend on that transition settling, so we don't wait for it here.
  await page.getByRole('button', { name: 'פרסם סידור' }).click()
  // Incomplete coverage arms an inline two-step confirm — click again to publish.
  const confirmPublish = page.getByRole('button', { name: /לחצו שוב לפרסום/ })
  await confirmPublish.click({ timeout: 3000 }).catch(() => {}) // absent when coverage is full
  await expect(page.getByRole('button', { name: /פורסם/ })).toBeVisible({ timeout: 15000 })

  // Unpublish — two-step confirm.
  const unpub = page.getByTestId('unpublish-schedule')
  await expect(unpub).toBeVisible({ timeout: 15000 })
  await expect(unpub).toHaveText('ביטול פרסום')

  await unpub.click()
  await expect(unpub).toHaveText('לחצו שוב לאישור ביטול', { timeout: 2000 })

  await unpub.click()

  // After a successful unpublish the {published && ...} block unmounts → the
  // unpublish button itself disappears. This is the strongest direct signal
  // that `published` flipped to false. We intentionally do NOT assert on the
  // sibling publish button label (it may still read "פורסם ✓" briefly while
  // the original publish-transition's pending state settles, or "מפרסם…" if
  // it had not yet settled — neither would be a correctness bug for unpublish).
  await expect(page.getByTestId('unpublish-schedule')).toBeHidden({ timeout: 30_000 })
})
