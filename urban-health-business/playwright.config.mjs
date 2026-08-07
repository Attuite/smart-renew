import { defineConfig } from '@playwright/test';

const businessPort = Number(process.env.E2E_BUSINESS_PORT || 4282);
const baseURL = `http://127.0.0.1:${businessPort}`;

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: /.*\.spec\.mjs/,
  outputDir: 'test-results/e2e',
  snapshotPathTemplate: '{testDir}/__screenshots__/{testFilePath}/{arg}-{projectName}-{platform}{ext}',
  timeout: 45_000,
  expect: {
    timeout: 10_000,
    toHaveScreenshot: {
      animations: 'disabled',
      caret: 'hide',
      maxDiffPixelRatio: 0.01
    }
  },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['line'], ['html', { open: 'never' }]] : 'line',
  use: {
    baseURL,
    browserName: 'chromium',
    colorScheme: 'dark',
    locale: 'zh-CN',
    timezoneId: 'Asia/Shanghai',
    viewport: { width: 1440, height: 1000 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure'
  },
  webServer: {
    command: 'node tests/e2e/support/start-e2e-server.mjs',
    url: `${baseURL}/api/ready`,
    timeout: 120_000,
    reuseExistingServer: false,
    stdout: 'pipe',
    stderr: 'pipe',
    env: {
      ...process.env,
      E2E_BUSINESS_PORT: String(businessPort)
    }
  },
  projects: [{ name: 'chromium' }]
});
