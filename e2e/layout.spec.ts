import { expect, test, waitForPet } from './fixtures';

for (const path of ['/', '/pet/demo/haunted']) {
  test(`${path} has no horizontal overflow`, async ({ page }) => {
    await page.goto(path);
    await waitForPet(page);
    const { scrollWidth, width } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      width: window.innerWidth,
    }));
    expect(scrollWidth).toBeLessThanOrEqual(width);
  });
}
