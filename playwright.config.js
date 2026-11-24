/* S10: konfigurasi E2E. Satu worker supaya localStorage tiap tes tidak bercampur. */
const { defineConfig, devices } = require('@playwright/test');

const PORT = 8099;

module.exports = defineConfig({
  testDir: './tests/e2e',
  timeout: 45_000,
  expect: { timeout: 7_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    // Diperlukan untuk menyuntik axe-core di bawah CSP aplikasi.
    bypassCSP: true,
    timezoneId: 'Asia/Jakarta',
    locale: 'id-ID',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } }
    },
    {
      name: 'mobile',
      use: {
        ...devices['Pixel 7'],
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 3
      }
    }
  ],
  webServer: {
    command: 'node scripts/serve.js',
    env: { PORT: String(PORT) },
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000
  }
});
