import { expect, test, waitForPet } from './fixtures';

const hpOf = async (page: import('@playwright/test').Page) => {
  const res = await page.evaluate(() => localStorage.getItem('gitgotchi:demo:demo/healthy'));
  return res ? (JSON.parse(res) as { pet: { hp: number } }).pet.hp : null;
};

// accounts R7.1: a demo pet changed in one browser is untouched in another.
test('two browsers keep their own demo pet', async ({ browser }) => {
  const a = await browser.newContext();
  const b = await browser.newContext();
  const pa = await a.newPage();
  const pb = await b.newPage();

  await pa.goto('/pet/demo/healthy');
  await waitForPet(pa);
  const sim = pa.getByRole('button', { name: 'Simulate: check run fails' });
  await sim.click();
  await sim.click();
  await expect.poll(() => hpOf(pa)).toBeLessThan(100);

  await pb.goto('/pet/demo/healthy');
  await waitForPet(pb);
  await expect.poll(() => hpOf(pb)).toBe(100);
  await expect(pb.locator('.lcd-ticker')).not.toContainText('CI FAILED');

  // RESET DEMO restores the fixture in that browser only.
  await pa.getByRole('button', { name: 'RESET DEMO' }).click();
  await expect.poll(() => hpOf(pa)).toBe(100);

  await a.close();
  await b.close();
});

test('the privacy page is reachable from the footer', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Privacy' }).click();
  await expect(page.getByRole('heading', { name: 'PRIVACY' })).toBeVisible();
});
