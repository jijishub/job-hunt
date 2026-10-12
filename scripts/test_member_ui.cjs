const { test } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright-core');
const fs = require('node:fs');

test('members can use Guide, master resume, company search, charts, ATS and real leads without admin access', async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    const user = { id: 'member', email: 'member@example.com', name: 'Member Tester', role: 'member', industry: 'Finance', notion_enabled: false };
    const base = { owner: user.id, company_id: 'finance', company_name: 'Finance Company', priority: 'MEDIUM', job_type: 'FULL_TIME', work_model: 'REMOTE', salary_currency: 'PHP', created_at: '2026-10-10', updated_at: '2026-10-10' };
    let apps = [
      { ...base, id: 'offer', role_title: 'Finance Analyst', status: 'ACCEPTED', notion_status: 'Accepted', role_fit: 'STRONG', date_applied: '2026-10-10', information: 'Build accurate financial reports and analyze business performance.', notes: 'My private interview feedback.' },
      { ...base, id: 'reject', role_title: 'Audit Analyst', status: 'REJECTED', notion_status: 'Not Accepted', role_fit: 'WEAK', date_applied: '2026-10-09' },
      { ...base, id: 'lead', role_title: 'Saved Finance Lead', status: 'LEAD', notion_status: 'Not started' },
      ...Array.from({ length: 10 }, (_, i) => ({ ...base, id: 'pending' + i, role_title: 'Pending Analyst ' + i, status: 'APPLIED', date_applied: '2026-10-08' })),
      { ...base, id: 'foreign', owner: 'other', company_id: 'foreign', company_name: 'Other Private Company', role_title: 'Other Private Job', status: 'ACCEPTED' },
    ];
    const companies = [{ id: 'finance', name: 'Finance Company', created_by: 'member', industry: 'Finance', website: 'https://example.com', applicationCount: 13 }, { id: 'travel', name: 'Travel Company', created_by: 'member', industry: 'Tourism', applicationCount: 0 }, { id: 'foreign', name: 'Other Private Company', created_by: 'other' }];
    let profile = 'Member master resume: financial reporting and business analysis.';
    let fitCalls = 0, atsCalls = [], scoutCalls = [], pdfAttempts = 0, creations = [], statusWrites = [], companyWrites = [], preferences = { target_companies: [], target_roles: [], preferred_locations: [], work_models: [], job_types: [], salary_currency: 'PHP', dealbreakers: '', portfolio_summary: '' };
    await page.route('**/api/**', async route => {
      const request = route.request(), pathname = new URL(request.url()).pathname, method = request.method();
      let data = { success: true, data: [] };
      if (pathname === '/api/auth/session') data = { user, expires: '2099-01-01' };
      else if (pathname === '/api/users') data = { success: true, data: [user] };
      else if (pathname === '/api/profile') { if (method === 'PUT') profile = request.postDataJSON().resumeText; data = { success: true, resumeText: profile }; }
      else if (pathname === '/api/preferences') { if (method === 'PUT') preferences = request.postDataJSON(); data = { success: true, data: preferences }; }
      else if (pathname === '/api/companies') {
        if (method === 'POST') { const body = request.postDataJSON(); companyWrites.push(body); const company = companies.find(company => company.id === body.id); Object.assign(company, body); data = { success: true, data: company }; }
        else data = { success: true, data: companies };
      }
      else if (pathname === '/api/statuses') data = { success: true, data: [{ id: 'not-started', name: 'Not started', category: 'LEAD' }, { id: 'applied', name: 'Applied', category: 'APPLIED' }] };
      else if (pathname === '/api/applications') {
        if (method === 'POST') { const app = { ...base, ...request.postDataJSON(), id: 'new' }; creations.push(app); apps.push(app); data = { success: true, data: app }; }
        else data = { success: true, data: apps };
      } else if (pathname.startsWith('/api/applications/') && method === 'PUT') {
        const id = pathname.split('/').at(-1), body = request.postDataJSON(); statusWrites.push(body); const app = apps.find(a => a.id === id); Object.assign(app, body); data = { success: true, data: app };
      } else if (pathname === '/api/role-fit') fitCalls++;
      else if (pathname === '/api/ai/analyze') { atsCalls.push(request.postDataJSON()); data = { success: true, data: { matchScore: 80, matchTier: 'Strong Match', summary: 'Saved master resume matches financial reporting requirements.', matchingSkills: ['Reporting'], missingKeywords: [], strengths: ['Financial reporting'], gaps: [], bulletRewrites: [], interviewTips: ['Explain a reporting project.'], tailoredPitch: 'A pitch using only saved evidence.', modelUsed: 'luna', analyzedAt: '2026-10-12T00:00:00Z' } }; }
      else if (pathname === '/api/leads/generate') { scoutCalls.push(request.postDataJSON()); data = { success: true, kind: 'SEARCH_IDEAS', data: [{ id: 'idea', title: 'Financial Reporting Analyst', company_name: 'Employer Idea', description: 'Research reporting roles.', ai_verdict: 'Explore reporting experience.', match_score: 98, salary_range: 'PHP 999,999' }] }; }
      else if (pathname === '/api/resume/parse-pdf') data = ++pdfAttempts === 1 ? { success: false, error: 'PDF could not be parsed.' } : { success: true, text: 'Discovery uploaded master resume', totalPages: 1 };
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
    });
    await page.goto(process.env.PIPELINE_TEST_URL || 'http://localhost:3100');
    await page.waitForFunction(() => document.querySelector('[aria-label="Application type"]')?.value === 'ALL');
    await page.getByRole('button', { name: 'Guide', exact: true }).click();
    await page.getByRole('heading', { name: 'Your quick-start guide' }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Notion settings', exact: true }).count(), 0);
    assert.equal(await page.getByRole('button', { name: 'Sync Notion', exact: true }).count(), 0);
    await page.getByRole('button', { name: 'My preferences', exact: true }).last().click();
    assert.equal(await page.getByLabel('Default view', { exact: true }).inputValue(), 'ALL');
    await page.getByLabel('Account resume text').fill('Updated member master resume with financial reporting experience.');
    await page.getByRole('button', { name: 'Save resume', exact: true }).click();
    await page.getByText('Resume saved to your account. New analyses will use this version.').waitFor();
    await page.getByRole('button', { name: 'Close preferences', exact: true }).click();
    await page.getByRole('button', { name: /^Companies/ }).click();
    await page.getByLabel('Search companies').fill('tourism');
    await page.getByText('Travel Company', { exact: true }).waitFor();
    assert.equal(await page.getByText('Finance Company', { exact: true }).count(), 0);
    await page.getByTitle('Edit Company', { exact: true }).click();
    const companyDialog = page.getByRole('dialog', { name: 'Edit Company', exact: true });
    await companyDialog.waitFor();
    for (const viewport of [{ width: 1280, height: 720 }, { width: 390, height: 600 }]) {
      await page.setViewportSize(viewport);
      const bounds = await companyDialog.boundingBox();
      assert.ok(bounds.y >= 15 && bounds.y + bounds.height <= viewport.height - 15);
      const saveBounds = await companyDialog.getByRole('button', { name: 'Save Changes', exact: true }).boundingBox();
      assert.ok(saveBounds.y >= 0 && saveBounds.y + saveBounds.height <= viewport.height);
      assert.ok(await companyDialog.locator('form > div').first().evaluate(node => node.scrollHeight > node.clientHeight));
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
    }
    await companyDialog.getByPlaceholder('e.g. Design, FinTech, Developer Tools').fill('Tourism and travel');
    await companyDialog.getByRole('button', { name: 'Save Changes', exact: true }).click();
    await companyDialog.waitFor({ state: 'hidden' });
    assert.equal(companyWrites[0].id, 'travel');assert.equal(companyWrites[0].industry, 'Tourism and travel');
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.getByLabel('Search companies').fill('no such company');
    await page.getByText('No companies match your search.').waitFor();
    await page.getByRole('button', { name: 'Analytics', exact: true }).click();
    await page.getByRole('heading', { name: 'Member Tester’s job-search analytics' }).waitFor();
    await page.getByRole('button', { name: 'Review Strong fit applications', exact: true }).click();
    const review = page.locator('#analytics-role-review');
    assert.match(await review.innerText(), /Finance Analyst/);assert.doesNotMatch(await review.innerText(), /Audit Analyst|Other Private/);
    await page.getByRole('button', { name: 'Review 1 inferred Final interview roles', exact: true }).click();
    assert.match(await review.innerText(), /1 roles in this review/);
    await page.getByRole('button', { name: 'Show all', exact: true }).click();
    await review.getByRole('button', { name: 'Next', exact: true }).click();
    assert.match(await review.innerText(), /2 \/ 2/);
    await page.getByLabel('Analytics job type').selectOption('INTERNSHIP');
    await page.getByRole('heading', { name: 'Your charts start here' }).waitFor();
    await page.getByLabel('Analytics job type').selectOption('ALL');
    await page.setViewportSize({ width: 390, height: 844 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
    fs.mkdirSync('.data', { recursive: true }); await page.screenshot({ path: '.data/member-analytics-mobile.png', fullPage: true });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.getByRole('button', { name: 'AI Resume & ATS', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('[aria-label="ATS resume"]')?.value.startsWith('Updated member'));
    assert.equal(await page.getByLabel('ATS resume').getAttribute('readonly'), '');
    assert.equal(await page.getByRole('button', { name: 'Use live portfolio for this match', exact: true }).count(), 0);
    await page.getByLabel('ATS tracked opportunity').selectOption('offer');
    assert.equal(await page.getByLabel('ATS job requirements').inputValue(), apps[0].information);
    await page.getByRole('button', { name: /Run AI ATS Match/ }).click();
    await page.getByText('Saved master resume matches financial reporting requirements.', { exact: true }).first().waitFor();
    assert.equal(atsCalls[0].applicationId, 'offer'); assert.equal(atsCalls[0].resumeText, undefined);
    await page.getByRole('button', { name: 'My preferences', exact: true }).last().click();
    await page.getByLabel('Account resume text').fill('Fresh member master resume version three.');
    await page.getByRole('button', { name: 'Save resume', exact: true }).click();
    await page.getByText('Resume saved to your account. New analyses will use this version.').waitFor();
    await page.getByRole('button', { name: 'Close preferences', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('[aria-label="ATS resume"]')?.value.startsWith('Fresh member'));
    assert.equal(await page.getByText('Saved master resume matches financial reporting requirements.', { exact: true }).count(), 0);
    await page.getByRole('button', { name: /^Leads/ }).click();
    assert.equal(await page.getByText('Your lead workspace', { exact: true }).count(), 0);
    assert.equal(await page.getByLabel('Company', { exact: true }).getAttribute('list'), 'lead-company-options');
    assert.ok(await page.locator('#lead-company-options option[value="Finance Company"]').count());
    const writesBeforeCancel = statusWrites.length;
    page.once('dialog', dialog => dialog.dismiss());
    await page.getByRole('button', { name: 'Mark applied', exact: true }).click();
    assert.equal(statusWrites.length, writesBeforeCancel);
    await page.getByText('Saved Finance Lead', { exact: true }).waitFor();
    page.once('dialog', async dialog => {
      assert.match(dialog.message(), /Saved Finance Lead at Finance Company/);
      await dialog.accept();
    });
    await page.getByRole('button', { name: 'Mark applied', exact: true }).click();
    await page.getByText('No saved leads yet. Use Quick Add to save a real posting.').waitFor();
    assert.equal(statusWrites.at(-1).notion_status, 'Applied');
    await page.getByRole('button', { name: 'Quick Add', exact: true }).click();
    await page.getByLabel('Role title', { exact: true }).fill('Verified Lead');
    await page.getByLabel('Company', { exact: true }).fill('Verified Employer');
    await page.getByLabel('Posting URL', { exact: true }).fill('https://example.com/careers/123');
    await page.getByRole('button', { name: 'Save lead', exact: true }).click();
    await page.getByText('Verified Lead', { exact: true }).waitFor();assert.equal(creations[0].notion_status, 'Not started');
    await page.getByRole('button', { name: 'Discover', exact: true }).click();
    const launchpads = page.getByRole('region', { name: 'Direct Sourcing Launchpads', exact: true });
    await page.getByLabel('Launchpad keywords').fill('Hospitality Management');
    assert.equal(await launchpads.getByRole('link', { name: 'Search JobStreet', exact: true }).getAttribute('href'), 'https://ph.jobstreet.com/hospitality-management-jobs');
    await page.getByLabel('Scout location').fill('Metro Manila');
    assert.equal(new URL(await launchpads.getByRole('link', { name: 'Search LinkedIn Jobs', exact: true }).getAttribute('href')).searchParams.get('keywords'), 'Hospitality Management');
    assert.equal(new URL(await launchpads.getByRole('link', { name: 'Search Indeed', exact: true }).getAttribute('href')).searchParams.get('l'), 'Metro Manila');
    await page.getByRole('button', { name: 'Software Engineer', exact: true }).click();
    assert.equal(await page.getByLabel('Target role', { exact: true }).inputValue(), 'Software Engineer');
    const beforeIdeas = creations.length;
    await page.getByRole('button', { name: 'Generate keywords', exact: true }).click();
    await page.getByText('Financial Reporting Analyst', { exact: true }).waitFor();
    assert.equal(scoutCalls.at(-1).targetRole, 'Software Engineer');
    assert.equal(scoutCalls.at(-1).useResumeContext, true);
    assert.equal(scoutCalls.at(-1).profileText, undefined);
    const keywords = page.getByRole('region', { name: 'Generated keywords', exact: true });
    assert.equal(await keywords.getByRole('link').count(), 4);
    const urls = await keywords.getByRole('link').evaluateAll(links => links.map(link => link.href));
    assert.equal(new URL(urls[0]).searchParams.get('keywords'), 'Financial Reporting Analyst');
    assert.equal(urls[1], 'https://ph.jobstreet.com/financial-reporting-analyst-jobs');
    assert.equal(new URL(urls[2]).searchParams.get('q'), 'Financial Reporting Analyst');
    assert.equal(new URL(urls[3]).searchParams.get('q'), 'Financial Reporting Analyst Metro Manila jobs');
    assert.equal(await browser.contexts()[0].pages().length, 1);
    assert.equal(creations.length, beforeIdeas);
    await page.getByRole('button', { name: 'Use these keywords', exact: true }).click();
    assert.equal(await page.getByLabel('Launchpad keywords').inputValue(), 'Financial Reporting Analyst');
    await page.getByRole('button', { name: /^Saved leads/ }).click();
    await page.getByRole('button', { name: 'Discover', exact: true }).click();
    await page.getByText('Financial Reporting Analyst', { exact: true }).waitFor();
    await page.getByLabel('Use my master resume', { exact: true }).uncheck();
    await page.getByRole('button', { name: 'Generate keywords', exact: true }).click();
    await page.waitForFunction(() => [...document.querySelectorAll('button')].some(button => button.textContent === 'Generate keywords' && !button.disabled));
    assert.equal(scoutCalls.at(-1).useResumeContext, false);
    const pdf = { name: 'member.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF mocked') };
    await page.getByLabel('Scout resume PDF').setInputFiles(pdf);
    await page.getByText('PDF could not be parsed.', { exact: true }).waitFor();
    assert.notEqual(profile, 'Discovery uploaded master resume');
    await page.getByLabel('Scout resume PDF').setInputFiles(pdf);
    await page.getByText('Master resume updated. New keywords will use this version.', { exact: true }).waitFor();
    assert.equal(profile, 'Discovery uploaded master resume');
    assert.equal(await keywords.count(), 0);
    await page.getByLabel('Use my master resume', { exact: true }).check();
    await page.getByRole('button', { name: 'Generate keywords', exact: true }).click();
    await page.getByText('Financial Reporting Analyst', { exact: true }).waitFor();
    await page.screenshot({ path: '.data/discovery-hub-desktop.png', fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
    await page.screenshot({ path: '.data/discovery-hub-mobile.png', fullPage: true });
    await page.setViewportSize({ width: 1440, height: 1000 });
    assert.equal(await page.getByText('98% Fit', { exact: true }).count(), 0);assert.equal(await page.getByRole('button', { name: 'Add as Lead', exact: true }).count(), 0);
    await page.getByRole('button', { name: 'New App', exact: true }).click();
    const today = await page.evaluate(() => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`; });
    assert.equal(await page.getByLabel('Date Applied', { exact: true }).inputValue(), today);
    await page.getByLabel('Date Applied', { exact: true }).fill('2026-10-01');
    assert.equal(await page.getByLabel('Date Applied', { exact: true }).inputValue(), '2026-10-01');
    await page.getByRole('button', { name: 'Close', exact: true }).click();
    await page.getByRole('button', { name: 'New App', exact: true }).click();
    assert.equal(await page.getByLabel('Date Applied', { exact: true }).inputValue(), today);
    assert.equal(fitCalls, 0);assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
