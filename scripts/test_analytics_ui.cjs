const { test } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright-core');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const cache = new Map();
function load(file) {
  const filename = path.resolve(root, file);
  if (cache.has(filename)) return cache.get(filename).exports;
  const m = new Module(filename, module); m.filename = filename; m.paths = Module._nodeModulePaths(path.dirname(filename)); cache.set(filename, m);
  const original = m.require.bind(m);
  m.require = id => {
    const target = id.startsWith('@/') ? path.join(root, 'src', id.slice(2)) : id.startsWith('.') ? path.resolve(path.dirname(filename), id) : null;
    return target && fs.existsSync(target + '.ts') ? load(target + '.ts') : original(id);
  };
  m._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, filename);
  return m.exports;
}
const { pipelineAnalytics, isInternship } = load('src/lib/analytics.ts');
const { analyticsFieldUpdates } = load('src/lib/application-analytics-fields.ts');
const { validatePreferences } = load('src/lib/preferences.ts');

test('AI is optional: filters and PDF work during requests and after failures; last interpretation survives', async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const user = { id: 'member', name: 'Analytics Member', email: 'member@example.com', role: 'member', notion_enabled: false };
    const apps = [
      { id: 'regular', owner: 'member', company_name: 'Example', role_title: 'Junior Software Developer', status: 'APPLIED', date_applied: '2026-10-01', job_type: 'FULL_TIME', work_model: 'REMOTE', priority: 'MEDIUM', salary_currency: 'PHP', created_at: '2026-10-01', updated_at: '2026-10-13' },
      { id: 'intern', owner: 'member', company_name: 'Historical', role_title: 'IT Intern', status: 'OFFER', job_type: 'INTERNSHIP', work_model: 'ON_SITE', priority: 'MEDIUM', salary_currency: 'PHP', created_at: '2026-10-01', updated_at: '2026-10-13' },
    ];
    let aiCalls = 0, assessmentCalls = 0, pending;
    let preferences = validatePreferences({ default_view: 'ALL', analytics_age_boundaries: [7,14,30] });
    await page.route('**/api/**', async route => {
      const url = new URL(route.request().url()); let data = { success: true, data: [] };
      if (url.pathname === '/api/auth/session') data = { user, expires: '2099-01-01' };
      else if (url.pathname === '/api/users') data.data = [user];
      else if (url.pathname === '/api/profile') data = { success: true, resumeText: '' };
      else if (url.pathname === '/api/applications') data.data = apps;
      else if (url.pathname.startsWith('/api/applications/')) {
        const app = apps.find(item => item.id === url.pathname.split('/').pop());
        if (route.request().method() === 'PUT') {
          const updates = route.request().postDataJSON();
          Object.assign(app, updates, analyticsFieldUpdates(app, updates), { updated_at: new Date().toISOString() });
        }
        data.data = app;
      }
      else if (url.pathname === '/api/notion/sync') data = { configured: false };
      else if (url.pathname === '/api/preferences') {
        if (route.request().method() === 'PUT') preferences = validatePreferences(route.request().postDataJSON());
        data.data = preferences;
      }
      else if (url.pathname === '/api/analytics') {
        const scope = url.searchParams.get('scope');
        data.data = pipelineAnalytics(apps.filter(app => scope === 'INTERNSHIP' ? isInternship(app) : scope === 'OTHER' ? !isInternship(app) : true), preferences.analytics_status_stages, preferences.analytics_rejection_statuses, new Date(), preferences.analytics_age_boundaries);
      } else if (url.pathname === '/api/analytics/analyze') { aiCalls++; pending = route; return; }
      else if (url.pathname.includes('role-fit') || url.pathname.startsWith('/api/ai/')) { assessmentCalls++; return route.abort(); }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
    });
    await page.goto(process.env.PIPELINE_TEST_URL || 'http://localhost:3100');
    await page.getByRole('button', { name: 'Analytics', exact: true }).click();
    await page.getByRole('heading', { name: 'Analytics Member’s job-search analytics' }).waitFor();
    await page.getByText('Application effectiveness comparisons', { exact: true }).click();
    await page.getByText('software engineer', { exact: true }).waitFor();
    assert.equal(aiCalls, 0); assert.equal(assessmentCalls, 0);
    const aging = page.getByRole('region', { name: 'Application aging', exact: true });
    assert.ok(await aging.isVisible());
    assert.match(await aging.innerText(), /1 active submitted applications/);
    await page.getByRole('button', { name: 'My preferences', exact: true }).click();
    await page.getByLabel('Application age boundary 1', { exact: true }).fill('3');
    await page.getByLabel('Application age boundary 2', { exact: true }).fill('10');
    await page.getByLabel('Application age boundary 3', { exact: true }).fill('20');
    await page.getByRole('button', { name: 'Save preferences', exact: true }).click();
    await page.getByText(/Preferences saved/).waitFor();
    await page.getByRole('button', { name: 'Close preferences', exact: true }).click();
    await aging.getByText('21+ days', { exact: true }).first().waitFor();
    const selected = pipelineAnalytics(apps, {}, undefined, new Date(), [3,10,20]).timing.buckets.find(bucket => bucket.pending);
    assert.ok(selected);
    await aging.getByRole('button', { name: `Review unanswered applications aged ${selected.label}`, exact: true }).click();
    const review = page.locator('#analytics-role-review');
    assert.match(await review.innerText(), /Junior Software Developer/);assert.doesNotMatch(await review.innerText(), /IT Intern/);assert.match(await review.innerText(), /Age since submission:/);
    await review.getByRole('button', { name: 'Show all', exact: true }).click();
    assert.equal(aiCalls, 0); assert.equal(assessmentCalls, 0);
    const analyze = page.getByRole('button', { name: 'Analyze my pipeline with AI', exact: true });
    const firstRequest = page.waitForRequest('**/api/analytics/analyze');
    await analyze.click(); await firstRequest;
    assert.equal(aiCalls, 1);
    await page.getByLabel('Analytics job type').selectOption('INTERNSHIP');
    await page.getByLabel('Analytics job type').selectOption('ALL');
    const downloadEvent = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export PDF', exact: true }).click();
    const download = await downloadEvent; assert.equal(download.suggestedFilename(), 'my-job-search-analytics.pdf');
    const { extractText } = require('unpdf');
    const text = (await extractText(new Uint8Array(fs.readFileSync(await download.path())), { mergePages: true })).text;
    assert.match(text, /Application aging/);assert.match(text, /Within 7 days/);assert.match(text, /21\+ days/);
    assert.equal(aiCalls, 1); assert.equal(assessmentCalls, 0);
    await pending.fulfill({ status: 502, contentType: 'application/json', body: JSON.stringify({ success: false, error: 'AI unavailable' }) });
    await page.getByText('AI unavailable', { exact: true }).waitFor();
    const secondRequest = page.waitForRequest('**/api/analytics/analyze');
    await analyze.click(); await secondRequest;
    await pending.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { summary: 'Recorded observations.', nextSteps: ['Suggested review.'] } }) });
    await page.getByText('Recorded observations.', { exact: true }).waitFor();
    for (const error of ['API key missing', 'AI did not respond in time. Your analytics remain available.']) {
      const nextRequest = page.waitForRequest('**/api/analytics/analyze'); await analyze.click(); await nextRequest;
      await pending.fulfill({ status: 502, contentType: 'application/json', body: JSON.stringify({ success: false, error }) });
      await page.getByText(error, { exact: true }).waitFor();
      assert.ok(await page.getByText('Recorded observations.', { exact: true }).isVisible());
      assert.ok(await page.getByRole('button', { name: 'Export PDF', exact: true }).isEnabled());
    }
    assert.equal(assessmentCalls, 0);
    await page.getByRole('button', { name: 'Table View', exact: true }).click();
    await page.getByText('Junior Software Developer', { exact: true }).last().click();
    await page.getByRole('button', { name: 'Edit', exact: true }).click();
    assert.equal(await page.getByLabel('Seniority level', { exact: true }).inputValue(), '');
    await page.getByLabel('Job title', { exact: true }).fill('AI Engineer');
    assert.ok(await page.getByRole('option', { name: 'Automatic: Unspecified', exact: true }).count());
    await page.getByLabel('Seniority level', { exact: true }).selectOption('JUNIOR');
    await page.getByLabel('Role family', { exact: true }).fill('Applied AI');
    await page.getByLabel('Job platform', { exact: true }).fill('Bossjob');
    await page.getByLabel('First employer response', { exact: true }).fill('2026-10-05T12:30');
    await page.getByRole('button', { name: 'Save Changes', exact: true }).click();
    await page.getByRole('heading', { name: 'Edit Application', exact: true }).waitFor({ state: 'hidden' });
    assert.equal(apps[0].seniority_level, 'JUNIOR'); assert.equal(apps[0].seniority_level_source, 'manual');
    assert.equal(apps[0].job_platform, 'Bossjob'); assert.ok(apps[0].first_response_at.endsWith('Z'));
    await page.getByText('AI Engineer', { exact: true }).last().click(); await page.getByRole('button', { name: 'Edit', exact: true }).click();
    await page.getByLabel('Job title', { exact: true }).fill('Senior AI Engineer');
    assert.equal(await page.getByLabel('Seniority level', { exact: true }).inputValue(), 'JUNIOR');
    assert.equal(await page.getByLabel('Role family', { exact: true }).inputValue(), 'Applied AI');
    await page.getByLabel('Seniority level', { exact: true }).selectOption('');
    await page.getByRole('button', { name: 'Use automatic role family', exact: true }).click();
    assert.equal(await page.getByLabel('Role family', { exact: true }).inputValue(), 'ai engineer');
    await page.getByRole('button', { name: 'Save Changes', exact: true }).click();
    await page.getByRole('heading', { name: 'Edit Application', exact: true }).waitFor({ state: 'hidden' });
    assert.equal(apps[0].seniority_level, 'SENIOR'); assert.equal(apps[0].seniority_level_source, 'derived'); assert.equal(apps[0].role_family, 'ai engineer');
    assert.equal(assessmentCalls, 0);
  } finally { await browser.close(); }
});
