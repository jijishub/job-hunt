const { test } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright-core');
const fs = require('node:fs');
const path = require('node:path');

test('rejection preferences update metrics and PDF; structured job JSON fills a draft without AI', async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const user = { id: 'test_owner', name: 'Jizelle Casia', email: 'test@example.com', role: 'admin' };
    const statuses = [
      { id: 'not_started', name: 'Not started', category: 'LEAD', color: 'gray' },
      { id: 'not_accepted', name: 'Not Accepted', category: 'REJECTED', color: 'red' },
      { id: 'rejected', name: 'Rejected', category: 'REJECTED', color: 'red' },
      { id: 'not_proceeding', name: 'Not Proceeding', category: 'WITHDRAWN', color: 'red' }
    ];
    const sample = { owner: user.id, company_name: 'Example', role_title: 'Engineer', priority: 'MEDIUM', job_type: 'FULL_TIME', work_model: 'REMOTE', salary_currency: 'PHP', created_at: '2026-10-10', updated_at: '2026-10-10', sync_status: 'SYNCED' };
    const apps = [
      { ...sample, id: 'default', status: 'REJECTED', notion_status: 'Not Accepted', analytics_stage: 'INTERVIEW', role_fit: 'STRONG' },
      { ...sample, id: 'custom', status: 'REJECTED', notion_status: 'Rejected', role_fit: 'STRONG' },
      { ...sample, id: 'withdrawn', status: 'WITHDRAWN', notion_status: 'Not Proceeding' }
    ];
    let preferences = { target_companies: [], target_roles: [], preferred_locations: [], work_models: [], job_types: [], salary_currency: 'PHP', dealbreakers: '', portfolio_summary: '' };
    let aiCalls = 0;
    let applicationWrites = 0;
    await page.route('**/api/**', async route => {
      const request = route.request();
      const url = new URL(request.url());
      let data = { success: true, data: [] };
      if (url.pathname === '/api/auth/session') data = { user, expires: '2099-01-01' };
      else if (url.pathname === '/api/users') data = { success: true, data: [user] };
      else if (url.pathname === '/api/notion/sync') data = { configured: false };
      else if (url.pathname === '/api/statuses') data = { success: true, data: statuses };
      else if (url.pathname === '/api/preferences') {
        if (request.method() === 'PUT') preferences = request.postDataJSON();
        data = { success: true, data: preferences };
      } else if (url.pathname === '/api/profile') data = { success: true, resumeText: 'Python and SQL developer.' };
      else if (url.pathname === '/api/applications') {
        if (request.method() !== 'GET') applicationWrites++;
        data = { success: true, data: apps };
      } else if (url.pathname === '/api/role-fit') aiCalls++;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
    });
    await page.goto(process.env.PIPELINE_TEST_URL || 'http://localhost:3100');
    await page.getByRole('button', { name: 'My preferences', exact: true }).click();
    const defaultRejection = page.getByLabel('Count Not Accepted as rejection', { exact: true });
    await defaultRejection.waitFor();
    assert.equal(await defaultRejection.isChecked(), true);
    assert.equal(await page.getByLabel('Count Rejected as rejection', { exact: true }).isChecked(), false);
    assert.equal(await page.getByLabel('Count Not Proceeding as rejection', { exact: true }).isChecked(), false);
    await page.getByRole('button', { name: 'Close preferences' }).click();
    await page.getByRole('button', { name: /Analytics/ }).click();
    const rejectionCard = page.getByText('Rejections', { exact: true }).first().locator('..');
    await rejectionCard.waitFor();
    assert.equal(await rejectionCard.locator('p').nth(1).innerText(), '1');
    assert.match(await rejectionCard.innerText(), /33% of submitted/);
    await page.getByRole('button', { name: 'My preferences', exact: true }).click();
    await page.getByLabel('Count Rejected as rejection', { exact: true }).check();
    await page.getByRole('button', { name: 'Save preferences', exact: true }).click();
    await page.getByText(/Preferences saved/).waitFor();
    assert.deepEqual(preferences.analytics_rejection_statuses, ['not accepted', 'rejected']);
    await page.getByRole('button', { name: 'Close preferences' }).click();
    await page.waitForFunction(() => [...document.querySelectorAll('p')].some(p => p.textContent === 'Rejections' && p.nextElementSibling?.textContent === '2'));
    assert.match(await rejectionCard.innerText(), /67% of submitted/);
    const downloadEvent = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export PDF', exact: true }).click();
    const download = await downloadEvent;
    fs.mkdirSync('.data', { recursive: true });
    const pdfPath = path.resolve('.data/rejection-analytics-test.pdf');
    await download.saveAs(pdfPath);
    const { extractText } = require('unpdf');
    const pdf = await extractText(new Uint8Array(fs.readFileSync(pdfPath)), { mergePages: true });
    assert.match(pdf.text, /Rejections\s+2\s+67% of submitted/);
    await page.getByRole('button', { name: 'New App', exact: true }).click();
    await page.getByRole('button', { name: 'Import job JSON', exact: true }).click();
    await page.getByLabel('Job posting JSON').fill(JSON.stringify({ job_title: 'AI Forward Deployed Engineer', company: 'Globe Telecom', location: 'Taguig', workplace_type: 'On-site', employment_type: 'Full-time', description: { overview: 'Build enterprise AI systems.', responsibilities: ['Deploy models.', 'Integrate business APIs.'] }, qualifications: { required: ['Python', 'SQL'] } }));
    await page.getByRole('button', { name: 'Fill draft from JSON', exact: true }).click();
    assert.equal(await page.getByPlaceholder('e.g. Senior Frontend Engineer').inputValue(), 'AI Forward Deployed Engineer');
    assert.equal(await page.getByLabel('Work model', { exact: true }).inputValue(), 'ON_SITE');
    assert.match(await page.getByLabel('Job description', { exact: true }).inputValue(), /Responsibilities:\n- Deploy models\./);
    assert.match(await page.getByLabel('Job description', { exact: true }).inputValue(), /Required:\n- Python\n- SQL/);
    assert.equal(await page.getByText('Description must be text.', { exact: true }).count(), 0);
    assert.equal(aiCalls, 0);
    assert.equal(applicationWrites, 0);
    await page.screenshot({ path: '.data/structured-job-import-review.png', fullPage: true });
  } finally {
    await browser.close();
  }
});
