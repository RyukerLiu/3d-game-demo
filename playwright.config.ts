import { defineConfig } from '@playwright/test'

const liveBaseURL = process.env.PLAYWRIGHT_BASE_URL

export default defineConfig({
  testDir: './tests',
  timeout: 45_000,
  use: {
    baseURL: liveBaseURL ?? 'http://127.0.0.1:4173',
    viewport: { width: 1440, height: 900 },
    screenshot: 'only-on-failure',
  },
  webServer: liveBaseURL ? undefined : {
    command: 'npm run preview -- --host 127.0.0.1',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: true,
  },
})
