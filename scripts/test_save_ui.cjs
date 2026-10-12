const { test } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright-core');

test('save closes the form while company refresh is still waiting', async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  let release;
  const companyWait = new Promise(resolve => { release = resolve; });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
    const user = { id: 'save_owner', name: 'Save Owner', email: 'save@example.com', role: 'admin', notion_enabled: true };
    let app = { id: 'save_app', owner: user.id, company_name: 'Example', role_title: 'Save Test Engineer', status: 'APPLIED', notion_status: 'Applied', priority: 'MEDIUM', work_model: 'REMOTE', job_type: 'FULL_TIME', created_at: '2026-10-12', updated_at: '2026-10-12' };
    let holdCompanies = false;
    let companyRefreshStarted = false;
    let writes = 0;
    await page.route('**/api/**', async route => {
      const request = route.request();
      const pathname = new URL(request.url()).pathname;
      let data = { success: true, data: [] };
      if (pathname === '/api/auth/session') data = { user, expires: '2099-01-01' };
      if (pathname === '/api/users') data = { success: true, data: [user] };
      if (pathname === '/api/notion/sync') data = { configured: false };
      if (pathname === '/api/applications') data = { success: true, data: [app] };
      if (pathname === '/api/companies' && holdCompanies) { companyRefreshStarted = true; await companyWait; }
      if (pathname === '/api/applications/save_app' && request.method() === 'PUT') {
        writes++;
        app = { ...app, ...request.postDataJSON(), sync_status: 'PENDING' };
        data = { success: true, data: app };
      }
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(data) });
    });
    await page.goto(process.env.PIPELINE_TEST_URL || 'http://localhost:3100');
    await page.getByText(app.role_title, { exact: true }).last().click();
    await page.getByRole('button', { name: 'Edit', exact: true }).click();
    await page.getByLabel('Personal comments', { exact: true }).fill('Saved without waiting for the directory.');
    holdCompanies = true;
    await page.getByRole('button', { name: 'Save Changes', exact: true }).click();
    await page.getByRole('heading', { name: 'Edit Application', exact: true }).waitFor({ state: 'hidden', timeout: 5000 });
    assert.equal(writes, 1);
    assert.equal(app.notes, 'Saved without waiting for the directory.');
    assert.equal(companyRefreshStarted, true);
    release();
  } finally { release(); await browser.close(); }
});
