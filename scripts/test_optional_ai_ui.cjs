const { test } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright-core');

async function setup(page, onAI) {
  const user = { id: 'ai-buttons', name: 'AI Buttons', email: 'buttons@example.com', role: 'member' };
  const app = { id: 'retail', owner: user.id, company_name: 'Example', role_title: 'Retail Associate', status: 'APPLIED', job_type: 'FULL_TIME', work_model: 'ON_SITE', priority: 'MEDIUM', salary_currency: 'PHP', date_applied: '2026-10-01', created_at: '2026-10-01', updated_at: '2026-10-14' };
  await page.addInitScript(() => {
    const original = window.fetch; window.__aiSignals = [];
    window.fetch = (input, options) => {
      if (options?.method === 'POST' && ['/api/leads/generate', '/api/analytics/analyze'].includes(String(input))) window.__aiSignals.push(Boolean(options.signal));
      return original(input, options);
    };
  });
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url()); let data = { success: true, data: [] };
    if (['/api/leads/generate', '/api/analytics/analyze'].includes(url.pathname)) return onAI(route);
    if (url.pathname === '/api/role-fit') throw Error('Role fit must not be called by these buttons');
    if (url.pathname === '/api/auth/session') data = { user, expires: '2099-01-01' };
    else if (url.pathname === '/api/users') data.data = [user];
    else if (url.pathname === '/api/applications') data.data = [app];
    else if (url.pathname === '/api/profile') data = { success: true, resumeText: 'Saved retail customer service resume.' };
    else if (url.pathname === '/api/notion/sync') data = { configured: false };
    else if (url.pathname === '/api/preferences') data.data = { default_view: 'ALL', target_roles: [], target_companies: [], preferred_locations: [], work_models: [], job_types: [], dealbreakers: '', salary_currency: 'PHP' };
    else if (url.pathname === '/api/analytics/insights') data.data = { report: null, currentVersion: 'test', outdated: false };
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(data) });
  });
  await page.goto(process.env.PIPELINE_TEST_URL || 'http://localhost:3100');
}

test('Job Scout runs only on click, blocks duplicate submits, retains keywords through navigation and failures', async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage(); let calls = 0, pending;
    await setup(page, route => { calls++; pending = route; });
    await page.getByRole('button', { name: /^Leads \(/ }).click();
    await page.getByRole('button', { name: 'Discover', exact: true }).click();
    await page.getByLabel('Target role', { exact: true }).fill('Retail Associate');
    assert.equal(calls, 0);
    const generate = page.getByRole('button', { name: 'Generate keywords', exact: true });
    const request = page.waitForRequest('**/api/leads/generate'); await generate.click(); await request;
    await page.locator('form').filter({ has: page.getByLabel('Target role', { exact: true }) }).evaluate(form => { form.requestSubmit(); form.requestSubmit(); });
    assert.equal(calls, 1); assert.ok(await page.getByRole('button', { name: 'Generating...', exact: true }).isDisabled());
    await pending.fulfill({ contentType: 'application/json', body: JSON.stringify({ success: true, data: [{ id: 'retail', title: 'Retail Customer Service', description: 'Customer service roles', tags: [] }] }) });
    const result = page.getByRole('heading', { name: 'Retail Customer Service', exact: true }); await result.waitFor();
    await page.getByRole('button', { name: 'Use these keywords', exact: true }).click();
    assert.equal(await page.getByLabel('Target role', { exact: true }).inputValue(), 'Retail Customer Service');
    assert.match(await page.getByRole('link', { name: 'Search Retail Customer Service on LinkedIn Jobs', exact: true }).getAttribute('href'), /Retail/);
    await page.getByRole('button', { name: 'Guide', exact: true }).click();
    await page.getByRole('button', { name: /^Leads \(/ }).first().click(); assert.ok(await result.isVisible());
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); assert.ok(await result.isVisible());
    const retry = page.waitForRequest('**/api/leads/generate'); await generate.click(); await retry;
    await pending.fulfill({ status: 504, contentType: 'text/html', body: 'Gateway timeout' });
    await page.getByText('The AI service did not finish in time. Try again later. Your last result is still available.', { exact: true }).waitFor();
    assert.ok(await result.isVisible()); assert.ok(await generate.isEnabled());
    const missingKey = page.waitForRequest('**/api/leads/generate'); await generate.click(); await missingKey;
    await pending.fulfill({ status: 502, contentType: 'application/json', body: JSON.stringify({ success: false, error: 'The AI service is not configured.' }) });
    await page.getByText('The AI service is not configured.', { exact: true }).waitFor(); assert.ok(await result.isVisible()); assert.equal(calls, 3);
    assert.deepEqual(await page.evaluate(() => window.__aiSignals), [true, true, true]);
  } finally { await browser.close(); }
});

test('Pipeline insights finish across section switches and preserve successful interpretation after a gateway error', async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage(); let calls = 0, pending;
    await setup(page, route => { calls++; pending = route; });
    await page.getByRole('button', { name: 'Analytics', exact: true }).click();
    const analyze = page.getByRole('button', { name: 'Analyze my pipeline with AI', exact: true }); await analyze.waitFor(); assert.equal(calls, 0);
    const request = page.waitForRequest('**/api/analytics/analyze'); await analyze.click(); await request;
    await page.getByRole('button', { name: 'Guide', exact: true }).click();
    await pending.fulfill({ contentType: 'application/json', body: JSON.stringify({ success: true, data: { report: { summary: 'Saved retail pipeline guidance.', observations: [], implications: [], recommendations: [], limitations: [], scope: 'ALL', generatedAt: '2026-10-14', snapshotVersion: 'test', reportingDate: '2026-10-14' }, currentVersion: 'test', outdated: false } }) });
    await page.getByRole('button', { name: 'Analytics', exact: true }).first().click();
    const result = page.getByText('Saved retail pipeline guidance.', { exact: true }); await result.waitFor(); assert.equal(calls, 1);
    const retry = page.waitForRequest('**/api/analytics/analyze'); await page.getByRole('button', { name: 'Analyze again with AI', exact: true }).click(); await retry;
    await pending.fulfill({ status: 504, contentType: 'text/html', body: 'Gateway timeout' });
    await page.getByText('The AI service did not finish in time. Try again later. Your last result is still available.', { exact: true }).waitFor(); assert.ok(await result.isVisible());
    assert.ok(await page.getByRole('button', { name: 'Analyze again with AI', exact: true }).isEnabled()); assert.equal(calls, 2);
    assert.deepEqual(await page.evaluate(() => window.__aiSignals), [true, true]);
  } finally { await browser.close(); }
});
