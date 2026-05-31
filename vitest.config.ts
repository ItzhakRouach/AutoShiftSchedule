import { defineConfig } from 'vitest/config'
import path from 'path'
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // Allow server-only imports in the Node test environment
      'server-only': path.resolve(__dirname, './src/__mocks__/server-only.ts'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    setupFiles: ['./vitest.setup.ts'],
  },
})
