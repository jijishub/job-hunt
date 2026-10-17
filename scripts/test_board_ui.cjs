const { test } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright-core');
const fs = require('node:fs');

async function dashboard(browser, role = 'admin') {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const user = { id: 'board_owner', name: 'Board Owner', email: 'board@example.com', role };
  const statuses = [
    { id: 'lead', name: 'Not started', category: 'LEAD', color: 'gray' },
    { id: 'applied', name: 'Applied', category: 'APPLIED', color: 'blue' },
    { id: 'interview', name: 'Initial Interview', category: 'INTERVIEWING', color: 'orange' },
    { id: 'offer', name: 'Accepted - Not Proceeding', category: 'OFFER', color: 'purple' },
    { id: 'accepted', name: 'Accepted', category: 'ACCEPTED', color: 'green' },
    { id: 'rejected', name: 'Not Accepted', category: 'REJECTED', color: 'gray' },
    { id: 'withdrawn', name: 'Not Proceeding', category: 'WITHDRAWN', color: 'red' }
  ];
  const sample = { owner: user.id, company_name: 'Example', priority: 'MEDIUM', job_type: 'FULL_TIME', work_model: 'REMOTE', created_at: '2026-10-10', updated_at: '2026-10-10', sync_status: 'SYNCED' };
  const apps = statuses.map(status => ({ ...sample, id: status.id, role_title: `${status.id} engineer`, status: status.category, notion_status: status.name }));
  Object.assign(apps[1], { salary_min: '60000.00', salary_max: '80000.00', salary_currency: null, role_fit: 'STRONG', role_fit_source: 'manual', analytics_stage: 'INTERVIEW' });
  Object.assign(apps[2], { salary_min: 1200, salary_max: 2000, salary_currency: 'USD' });
  const state = { statuses, apps, writes: [], failNextMove: false, aiCalls: 0, preferences: {} };
  await page.route('**/api/**', async route => {
    const request = route.request(); const url = new URL(request.url());
    let data = { success: true, data: [] }, status = 200;
    if (url.pathname === '/api/auth/session') data = { user, expires: '2099-01-01' };
    else if (url.pathname === '/api/users') data = { success: true, data: [user] };
    else if (url.pathname === '/api/notion/sync') data = { configured: false };
    else if (url.pathname === '/api/statuses') data = { success: true, data: statuses };
    else if (url.pathname === '/api/profile') data = { success: true, resumeText: 'Python developer' };
    else if (url.pathname === '/api/preferences') {
      if (request.method() === 'PUT') state.preferences = request.postDataJSON();
      data = { success: true, data: state.preferences };
    }
    else if (url.pathname === '/api/role-fit') state.aiCalls++;
    else if (url.pathname === '/api/applications') data = { success: true, data: apps };
    else if (url.pathname.startsWith('/api/applications/') && request.method() === 'PUT') {
      const payload = request.postDataJSON(); state.writes.push(payload);
      if (state.failNextMove) { state.failNextMove = false; status = 400; data = { success: false, error: 'Cannot save status' }; }
      else {
        const app = apps.find(app => app.id === url.pathname.split('/').pop());
        Object.assign(app, payload);
        data = { success: true, data: app };
      }
    }
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
  });
  await Promise.all([
    page.waitForResponse(response => new URL(response.url()).pathname === '/api/preferences'),
    page.goto(process.env.PIPELINE_TEST_URL || 'http://localhost:3100'),
  ]);
  await page.getByRole('button', { name: 'Board View', exact: true }).waitFor();
  return { page, state };
}

test('board columns, custom moves, failed moves, add defaults and currency previews match saved data', async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const { page, state } = await dashboard(browser);
    await page.getByText('PHP 60,000.00 – 80,000.00', { exact: true }).waitFor();
    assert.equal(await page.getByText('USD 1,200.00 – 2,000.00', { exact: true }).count(), 1);
    await page.getByLabel('Application visibility').selectOption('ALL');await page.getByRole('button', { name: 'Board View', exact: true }).click();
    await page.getByLabel('Move applied engineer at Example').waitFor();
    assert.equal(await page.locator('h4').count(), state.apps.length);
    assert.equal(await page.getByRole('heading', { name: 'Screening', exact: true }).count(), 0);
    assert.equal(await page.getByRole('heading', { name: 'Screening Call', exact: true }).count(), 0);
    assert.equal(await page.getByText('PHP 60,000.00 – 80,000.00', { exact: true }).count(), 1);
    await page.getByRole('button', { name: 'Add application to Applied', exact: true }).click();
    assert.equal(await page.getByLabel('Application stage', { exact: true }).inputValue(), 'Applied');
    assert.equal(await page.getByLabel('Salary currency', { exact: true }).inputValue(), 'PHP');
    assert.deepEqual(await page.getByLabel('Salary currency', { exact: true }).locator('option').allTextContents(), ['PHP', 'USD']);
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    // The category deliberately cannot be inferred from this name.
    state.statuses.push({ id: 'custom_review', name: 'Phone review', category: 'SCREENING', color: 'orange' });
    await page.getByRole('button', { name: 'Table View', exact: true }).click();
    await page.getByLabel('Application visibility').selectOption('ALL');await page.getByRole('button', { name: 'Board View', exact: true }).click();
    await page.getByRole('heading', { name: 'Screening / Interview', exact: true }).waitFor();
    assert.equal(await page.getByRole('heading', { name: 'Screening', exact: true }).count(), 0);
    await page.getByLabel('Move applied engineer at Example').selectOption('Phone review');
    await page.waitForFunction(() => document.querySelector('select[aria-label="Move applied engineer at Example"]')?.value === 'Phone review');
    await page.getByLabel('Move applied engineer at Example').waitFor();
    assert.deepEqual(state.writes[0], { status: 'SCREENING', notion_status: 'Phone review' });
    assert.equal(state.apps[1].role_fit, 'STRONG');assert.equal(state.apps[1].analytics_stage, 'INTERVIEW');
    const screeningColumn = page.getByRole('heading', { name: 'Screening / Interview', exact: true }).locator('..').locator('..').locator('..');
    assert.equal(await screeningColumn.getByRole('heading', { name: 'applied engineer', exact: true }).count(), 1);
    assert.equal(await screeningColumn.getByRole('heading', { name: 'interview engineer', exact: true }).count(), 1);
    const appliedColumn = page.getByRole('heading', { name: 'Applied', exact: true }).locator('..').locator('..').locator('..');
    assert.equal(await appliedColumn.getByRole('heading', { name: 'applied engineer', exact: true }).count(), 0);
    await page.getByRole('button', { name: 'Add application to Screening / Interview', exact: true }).click();
    assert.equal(await page.getByLabel('Application stage', { exact: true }).inputValue(), 'Initial Interview');
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    state.failNextMove = true;
    await page.getByLabel('Move applied engineer at Example').selectOption('Not Accepted');
    await page.getByRole('alert').filter({ hasText: 'Cannot save status' }).waitFor();
    await page.waitForFunction(() => document.querySelector('select[aria-label="Move applied engineer at Example"]')?.value === 'Phone review');
    assert.equal(await page.locator('h4').count(), state.apps.length);
    assert.equal(state.aiCalls, 0);
    fs.mkdirSync('.data', { recursive: true });
    await page.screenshot({ path: '.data/board-status-review.png', fullPage: true });
  } finally { await browser.close(); }
});

test('member board shows every saved category once, including rejected and offer records', async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const { page, state } = await dashboard(browser, 'member');
    state.apps.push({ ...state.apps[1], id: 'assessment', role_title: 'assessment engineer', status: 'SCREENING', notion_status: 'Online Assessment' });
    await Promise.all([page.waitForResponse(response => new URL(response.url()).pathname === '/api/preferences'), page.reload()]);
    await page.getByLabel('Application visibility').selectOption('ALL');await page.getByRole('button', { name: 'Board View', exact: true }).click();
    await page.getByLabel('Move rejected engineer at Example').waitFor();
    await page.waitForFunction(count => document.querySelectorAll('h4').length === count, state.apps.length);
    assert.equal(await page.locator('h4').count(), state.apps.length);
    for (const app of state.apps) assert.equal(await page.getByRole('heading', { name: app.role_title, exact: true }).count(), 1);
    const screeningColumn = page.getByRole('heading', { name: 'Screening / Interview', exact: true }).locator('..').locator('..').locator('..');
    assert.equal(await screeningColumn.getByRole('heading', { name: 'assessment engineer', exact: true }).count(), 1);
    assert.equal(await screeningColumn.getByRole('heading', { name: 'interview engineer', exact: true }).count(), 1);
    assert.equal(await page.getByRole('heading', { name: 'Screening', exact: true }).count(), 0);
  } finally { await browser.close(); }
});

test('assessment cards leave Applied and rejection preferences update the board immediately', async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const { page, state } = await dashboard(browser);
    state.statuses.push(
      { id: 'assessment', name: 'Online Assessment', category: 'APPLIED', color: 'blue' },
      { id: 'failed', name: 'Failed Assessment', category: 'APPLIED', color: 'red' },
      { id: 'physical', name: 'In Person Assessment', category: 'APPLIED', color: 'blue' },
      { id: 'review', name: 'Company review', category: 'APPLIED', color: 'blue' },
    );
    for (const [id, name] of [['assessment','Online Assessment'],['failed','Failed Assessment'],['physical','In Person Assessment'],['review','Company review']]) state.apps.push({ ...state.apps[0], id, role_title: `${id} role`, status: 'APPLIED', notion_status: name });
    state.preferences = { analytics_status_stages: { 'company review': 'SCREENING' }, analytics_rejection_statuses: ['Not Accepted','Failed Assessment'] };
    await Promise.all([page.waitForResponse(response => new URL(response.url()).pathname === '/api/preferences'), page.reload()]);
    await page.getByRole('button', { name: 'Board View', exact: true }).click();
    const column = title => page.getByRole('heading', { name: title, exact: true }).locator('..').locator('..').locator('..');
    await column('Screening / Interview').getByRole('heading', { name: 'assessment role', exact: true }).waitFor();
    await column('Screening / Interview').getByRole('heading', { name: 'physical role', exact: true }).waitFor();
    await column('Screening / Interview').getByRole('heading', { name: 'review role', exact: true }).waitFor();
    await column('Archived / Rejected').getByRole('heading', { name: 'failed role', exact: true }).waitFor();
    assert.equal(await column('Applied').getByRole('heading', { name: /^(assessment|failed|physical|review) role$/ }).count(), 0);
    await page.getByRole('button', { name: 'My preferences', exact: true }).click();
    await page.getByLabel('Count Company review as rejection', { exact: true }).check();
    await page.getByRole('button', { name: 'Save preferences', exact: true }).click();
    await page.getByText('Preferences saved.', { exact: false }).waitFor();
    await page.getByRole('button', { name: 'Close preferences', exact: true }).click();
    await column('Archived / Rejected').getByRole('heading', { name: 'review role', exact: true }).waitFor();
    assert.equal(await column('Screening / Interview').getByRole('heading', { name: 'review role', exact: true }).count(), 0);
    await Promise.all([page.waitForResponse(response => new URL(response.url()).pathname === '/api/preferences'), page.reload()]);
    await page.getByRole('button', { name: 'Board View', exact: true }).click();
    await column('Archived / Rejected').getByRole('heading', { name: 'review role', exact: true }).waitFor();
  } finally { await browser.close(); }
});
