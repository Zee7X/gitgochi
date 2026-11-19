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

// A long event log must scroll inside its panel, not stretch the page below the footer.
test('a long event log does not add empty space below the footer', async ({ page }) => {
  await page.goto('/pet/demo/healthy');
  await waitForPet(page);
  const push = page.getByRole('button', { name: 'Simulate: one commit lands' });
  for (let i = 0; i < 20; i++) await push.click();
  const { doc, limit } = await page.evaluate(() => ({
    doc: document.documentElement.scrollHeight,
    limit: Math.max(Math.ceil((document.querySelector('footer')?.getBoundingClientRect().bottom ?? 0) + window.scrollY), window.innerHeight),
  }));
  expect(doc).toBeLessThanOrEqual(limit + 2);
});
