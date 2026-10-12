const { test } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright-core');

test('saved leads always show strongest role fits first, including search results', async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage();
    const user = { id: 'fit_member', email: 'fit@example.com', name: 'Fit Tester', role: 'member' };
    const leads = [
      ['Weak role', 'WEAK'], ['Unassessed role', null], ['Strong first', 'STRONG'],
      ['Possible role', 'POSSIBLE'], ['Strong second', 'STRONG'],
    ].map(([role_title, role_fit], index) => ({
      id: `fit_${index}`, owner: user.id, company_name: 'Example', role_title, role_fit,
      status: 'LEAD', priority: 'MEDIUM', job_type: 'FULL_TIME', work_model: 'REMOTE',
      salary_currency: 'PHP', created_at: '2026-10-13', updated_at: '2026-10-13',
    }));
    let writes = 0;
    await page.route('**/api/**', async route => {
      const request = route.request();
      if (!['GET', 'HEAD'].includes(request.method())) writes++;
      const path = new URL(request.url()).pathname;
      let data = { success: true, data: [] };
      if (path === '/api/auth/session') data = { user, expires: '2099-01-01' };
      if (path === '/api/users') data = { success: true, data: [user] };
      if (path === '/api/applications') data = { success: true, data: leads };
      if (path === '/api/notion/sync') data = { configured: false };
      if (path === '/api/preferences') data = { success: true, data: {} };
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(data) });
    });
    await page.goto(process.env.PIPELINE_TEST_URL || 'http://localhost:3100');
    await page.getByRole('button', { name: /^Leads/ }).click();
    await page.getByLabel('Search saved leads').waitFor();
    await page.getByText('Strong first', { exact: true }).waitFor();
    assert.deepEqual(await page.locator('article h3').allTextContents(), ['Strong first', 'Strong second', 'Possible role', 'Weak role', 'Unassessed role']);
    await page.getByLabel('Search saved leads').fill('Strong');
    await page.getByText('Possible role', { exact: true }).waitFor({ state: 'hidden' });
    assert.deepEqual(await page.locator('article h3').allTextContents(), ['Strong first', 'Strong second']);
    assert.equal(writes, 0);
  } finally {
    await browser.close();
  }
});
