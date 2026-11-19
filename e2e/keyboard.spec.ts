import type { Page } from '@playwright/test';
import { expect, test, waitForPet } from './fixtures';

const button = (page: Page, id: 'A' | 'B' | 'C') => page.getByRole('button', { name: new RegExp(`^Button ${id}:`) });

/** Presses Tab until `target` has focus; fails after `max` presses. */
async function tabTo(page: Page, target: ReturnType<typeof button>, max = 60) {
  for (let i = 0; i < max; i++) {
    await page.keyboard.press('Tab');
    if (await target.evaluate((el) => el === document.activeElement)) return;
  }
  throw new Error('Tab never reached the target');
}

test('Tab reaches buttons A, B and C, each with a visible focus indicator', async ({ page }) => {
  await page.goto('/pet/demo/haunted');
  await waitForPet(page);
  for (const id of ['A', 'B', 'C'] as const) {
    const b = button(page, id);
    await tabTo(page, b);
    const style = await b.evaluate((el) => {
      const s = getComputedStyle(el);
      return { outline: s.outlineStyle, shadow: s.boxShadow };
    });
    expect(style.outline !== 'none' || style.shadow !== 'none', `focus style of ${id}: ${JSON.stringify(style)}`).toBe(true);
  }
});

test('Left moves the menu selection, Enter runs it and Esc toggles stats', async ({ page }) => {
  await page.goto('/pet/demo/haunted');
  await waitForPet(page);
  const selected = page.locator('.lcd-menu-item-on');
  await expect(selected).toHaveText('REVIVE');

  await page.keyboard.press('ArrowLeft');
  await expect(selected).toHaveText('HEAL');

  // Enter runs HEAL, which opens the SUMMON KIRO dialog; Esc closes it.
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: /SUMMON KIRO/ });
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();

  const stats = page.getByText('REPO METRICS');
  await expect(stats).toBeHidden();
  await page.keyboard.press('Escape');
  await expect(stats).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(stats).toBeHidden();
});

test('the SUMMON KIRO dialog traps Tab, closes on Esc and returns focus to its opener', async ({ page }) => {
  await page.goto('/pet/demo/haunted');
  await waitForPet(page);
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('.lcd-menu-item-on')).toHaveText('HEAL');

  const b = button(page, 'B');
  await tabTo(page, b);
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: /SUMMON KIRO/ });
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute('aria-busy', 'false');

  for (let i = 0; i < 15; i++) {
    await page.keyboard.press('Tab');
    expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true);
  }
  await page.keyboard.press('Shift+Tab');
  expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true);

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(b).toBeFocused();
});
