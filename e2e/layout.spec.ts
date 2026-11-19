import { expect, test, waitForPet } from './fixtures';

for (const path of ['/', '/pet/demo/haunted', '/privacy', '/me']) {
  test(`${path} has no horizontal overflow`, async ({ page }) => {
    await page.goto(path);
    if (path === '/' || path.startsWith('/pet/')) await waitForPet(page);
    else await page.waitForLoadState('networkidle');
    const { scrollWidth, width } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      width: window.innerWidth,
    }));
    expect(scrollWidth).toBeLessThanOrEqual(width);
  });
}
