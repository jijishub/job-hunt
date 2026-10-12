const { test } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright-core');
const path = require('node:path');
const { applicationWorkflowUpdates } = require('./migrate_db.cjs').loadTypescript(path.resolve(__dirname, '../src/lib/application-workflow.ts'));

for (const role of ['admin', 'member']) test(`${role} archives and restores an interview with automatic analytics and unchanged backup status`, async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage();
    const user = { id: role === 'admin' ? 'user_ji' : 'archive_member', name: 'Archive Tester', email: `${role}@example.com`, role, notion_enabled: role === 'admin' };
    const label = role === 'admin' ? 'Initial Interview' : 'Interview';
    let app = { id: 'archive_job', owner: user.id, company_name: 'Example', role_title: 'Archive Test Role', status: 'INTERVIEWING', notion_status: label, priority: 'MEDIUM', job_type: 'FULL_TIME', work_model: 'REMOTE', salary_currency: 'PHP', sync_status: 'SYNCED', last_synced_at: '2026-10-10', created_at: '2026-10-10', updated_at: '2026-10-10' };
    let notionWrites = 0;
    await page.route('**/api/**', async route => {
      const request = route.request(), pathname = new URL(request.url()).pathname;
      let data = { success: true, data: [] };
      if (pathname === '/api/auth/session') data = { user, expires: '2099-01-01' };
      if (pathname === '/api/users') data = { success: true, data: [user] };
      if (pathname === '/api/preferences') data = { success: true, data: {} };
      if (pathname === '/api/notion/sync') { if (request.method() !== 'GET') notionWrites++; data = { configured: false }; }
      if (pathname === '/api/applications') data = { success: true, data: [app] };
      if (pathname === '/api/applications/archive_job' && request.method() === 'PUT') {
        const body = request.postDataJSON();
        assert.equal(Object.hasOwn(body, 'analytics_stage'), false);
        app = { ...app, ...applicationWorkflowUpdates(app, body) };
        data = { success: true, data: app };
      }
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(data) });
    });
    await page.goto(process.env.PIPELINE_TEST_URL || 'http://localhost:3100');
    await page.getByText(app.role_title, { exact: true }).last().click();
    await page.getByRole('button', { name: 'Edit', exact: true }).click();
    assert.equal(await page.getByLabel('Analytics phase reached').innerText(), 'Interview');
    assert.equal(await page.locator('select[aria-label="Analytics phase reached"]').count(), 0);
    await page.getByLabel('Not Proceeding', { exact: true }).check();
    assert.equal(await page.getByLabel('Application stage', { exact: true }).isDisabled(), true);
    await page.getByRole('button', { name: 'Save Changes', exact: true }).click();
    await page.getByRole('heading', { name: 'Edit Application', exact: true }).waitFor({ state: 'hidden' });
    assert.equal(app.not_proceeding, true);assert.equal(app.status, 'INTERVIEWING');assert.equal(app.notion_status, label);assert.equal(app.analytics_stage, 'INTERVIEW');
    await page.reload();
    await page.getByLabel('Application visibility').waitFor();
    assert.equal(await page.locator('tbody tr').count(), 0);
    await page.getByLabel('Application visibility').selectOption('ARCHIVED');
    await page.getByText(app.role_title, { exact: true }).last().click();
    await page.getByText(`Last recorded job status: ${label}`, { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Edit', exact: true }).click();
    assert.equal(await page.getByLabel('Not Proceeding', { exact: true }).isChecked(), true);
    await page.getByLabel('Not Proceeding', { exact: true }).uncheck();
    await page.getByRole('button', { name: 'Save Changes', exact: true }).click();
    await page.getByRole('heading', { name: 'Edit Application', exact: true }).waitFor({ state: 'hidden' });
    assert.equal(app.not_proceeding, false);assert.equal(app.notion_status, label);assert.equal(app.analytics_stage, 'INTERVIEW');assert.equal(app.last_synced_at, '2026-10-10');assert.equal(notionWrites, 0);
    await page.reload();
    await page.getByRole('table').getByText(app.role_title, { exact: true }).waitFor();
    assert.equal(await page.locator('tbody tr').count(), 1);
  } finally { await browser.close(); }
});
