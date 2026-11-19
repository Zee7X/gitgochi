import { test as base, expect } from '@playwright/test';

/** Every test fails on a console error or warning, or an uncaught page exception (haunted-ui R4). */
export const test = base.extend<{ consoleProblems: string[] }>({
  consoleProblems: [
    async ({ page }, use) => {
      const problems: string[] = [];
      page.on('console', (m) => {
        if (m.type() === 'error' || m.type() === 'warning') problems.push(`console.${m.type()}: ${m.text()}`);
      });
      page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
      await use(problems);
      expect(problems, 'console must stay clean').toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

/** The LCD has loaded a pet once the loading ticker is gone. */
export async function waitForPet(page: import('@playwright/test').Page) {
  await expect(page.locator('.lcd-ticker')).not.toContainText('LOADING', { timeout: 15_000 });
}
