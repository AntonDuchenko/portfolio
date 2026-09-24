import { defineConfig, devices } from '@playwright/test';

// Smoke tests against the production build (`npm run build` first). WebGL runs on
// SwiftShader: slow, so the scene is driven by a virtual clock (tests/helpers.ts).
export default defineConfig({
  testDir: 'tests',
  timeout: 10 * 60_000,
  expect: { timeout: 30_000 },
  retries: 0,
  workers: 1,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:4173/',
    ...devices['Desktop Chrome'],
    viewport: { width: 640, height: 360 },
    launchOptions: {
      args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
        '--autoplay-policy=no-user-gesture-required']
    }
  },
  webServer: {
    command: 'npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173/',
    reuseExistingServer: !process.env.CI
  }
});
