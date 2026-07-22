import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  // Serialize: the e2e suite shares one cloud Supabase project, so parallel
  // workers creating users/orgs concurrently race each other. One worker is
  // reliable (the suite is fast enough).
  workers: 1,
  fullyParallel: false,
  // The dev server slows over a long serialized run against the shared cloud
  // DB; give navigations generous headroom so late tests don't time out.
  expect: { timeout: 15_000 },
  use: { baseURL: 'http://localhost:3000', navigationTimeout: 30_000, actionTimeout: 15_000 },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    // GuardPay integration runs against canned fixtures in e2e — no real
    // Appwrite calls. NOTE: applies only when Playwright starts the server;
    // kill any already-running dev server before `npm run e2e`.
    env: { GUARDPAY_FAKE: '1' },
  },
})
