import { test, expect } from '@playwright/test';

for (const plan of ['Bloom', 'Thrive']) {
  test(`${plan} keeps its plan action available while reading and leaves footer links accessible`, async ({ page }) => {
    await page.route('**/rest/v1/**', route => route.fulfill({ json: [] }));
    await page.goto(`/the-little-garden/${plan.toLowerCase()}/`);
    await expect(page.getByRole('figure', { name: `Example ${plan} business listing` })).toContainText('Plan a little visit.');
    await page.getByRole('heading', { name: 'A few things you might be wondering.', exact: true }).scrollIntoViewIfNeeded();
    const mobile = page.viewportSize().width <= 900;
    const purchase = mobile ? page.getByRole('region', { name: `${plan} quick signup` }) : page.getByRole('complementary', { name: `${plan} plan details` });
    const action = purchase.getByRole('link', { name: plan === 'Bloom' ? mobile ? 'Get Bloom' : 'Get Started with Bloom' : mobile ? 'Ask About Pilot' : 'Ask About the Thrive Pilot', exact: true });
    await expect(action).toBeVisible();
    await expect(action).toHaveAttribute('href', plan === 'Bloom' ? '/the-little-garden/start?plan=bloom' : /^mailto:/);
    const box = await action.boundingBox();
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(page.viewportSize().height);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const footerLinks = page.locator('footer').getByRole('link');
    const lastLink = footerLinks.last(); await lastLink.scrollIntoViewIfNeeded();
    if (mobile) { const bar = await purchase.boundingBox(); const link = await lastLink.boundingBox(); expect(link.y + link.height).toBeLessThanOrEqual(bar.y); }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test('route headings keep navigation focus without a green box, while keyboard controls stay outlined', async ({ page }) => {
  await page.route('**/rest/v1/**', route => route.fulfill({ json: [] }));
  for (const [plan, heading] of [['Bloom', 'Help the right people choose your place.'], ['Thrive', 'Give people a reason to shop, book, or join you.']]) {
    await page.goto('/the-little-garden/');
    const entry = page.getByRole('link', { name: plan === 'Bloom' ? 'Explore Bloom' : 'Explore the Thrive Pilot', exact: true });
    await entry.focus(); await entry.press('Enter');
    const title = page.getByRole('heading', { name: heading, level: 1 });
    await expect(title).toBeFocused(); await expect(title).toHaveCSS('outline-style', 'none');
    const primary = page.getByRole('complementary', { name: `${plan} plan details` }).getByRole('link', { name: plan === 'Bloom' ? 'Get Started with Bloom' : 'Ask About the Thrive Pilot', exact: true });
    await primary.focus(); await expect(primary).toHaveCSS('outline-style', 'solid');
  }
  await page.goto('/the-little-garden/bloom/'); await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to content', exact: true })).toBeFocused();
  await expect(page.getByRole('link', { name: 'Skip to content', exact: true })).toHaveCSS('clip-path', 'none');
});
