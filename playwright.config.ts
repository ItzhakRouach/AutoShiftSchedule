import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  // Serialize: the e2e suite shares one cloud Supabase project, so parallel
  // workers creating users/orgs concurrently race each other. One worker is
  // reliable (the suite is fast enough).
  workers: 1,
  fullyParallel: false,
  use: { baseURL: 'http://localhost:3000' },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
