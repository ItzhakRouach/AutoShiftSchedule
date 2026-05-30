import { test, expect } from '@playwright/test'

test('home renders RTL Hebrew', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  await expect(page.locator('html')).toHaveAttribute('lang', 'he')
  await expect(page.getByRole('heading', { name: 'מִשְׁמֶרֶת' })).toBeVisible()
})
