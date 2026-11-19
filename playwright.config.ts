import { defineConfig } from '@playwright/test';

// Browser pass (haunted-ui task 11) against the production build. Port 3100 so it does not collide
// with `npm run dev` on 3000. Run with `npm run test:e2e`; it is not part of `npm test`.
const PORT = 3100;

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: `http://localhost:${PORT}`, browserName: 'chromium', trace: 'retain-on-failure' },
  projects: [
    { name: 'mobile', testMatch: /\.spec\.ts$/, use: { viewport: { width: 390, height: 844 } } },
    { name: 'desktop', testMatch: /\.spec\.ts$/, use: { viewport: { width: 1280, height: 800 } } },
  ],
  webServer: {
    command: `npm run build && npm run start -- -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
