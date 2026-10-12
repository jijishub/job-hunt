const { test } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright-core');

test('mobile menus, lead cards, details and model choices stay inside the viewport', async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    for (const width of [320, 375, 390, 480, 1440]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      const user = { id: 'mobile_owner', name: 'Mobile Owner', email: 'mobile@example.com', role: 'admin' };
      const app = { id: 'mobile_lead', owner: user.id, company_name: 'Thinking Machines Data Science', role_title: 'Graduate Development Program (E-commerce, Philippines) - 2027 Start', status: 'LEAD', notion_status: 'Not started', priority: 'MEDIUM', job_type: 'FULL_TIME', work_model: 'REMOTE', notion_page_id: 'abc123', created_at: '2026-10-10', updated_at: '2026-10-10', sync_status: 'SYNCED' };
      app.role_fit = 'STRONG';
      app.role_fit_source = 'ai';
      app.role_fit_analysis = { fit: 'STRONG', explanation: 'Your experience matches this lead.', strengths: ['Relevant experience'], gaps: [], analyzed_at: '2026-10-10' };
      await page.route('**/api/**', async route => {
        const path = new URL(route.request().url()).pathname;
        let data = { success: true, data: [] };
        if (path === '/api/auth/session') data = { user, expires: '2099-01-01' };
        if (path === '/api/users') data = { success: true, data: [user] };
        if (path === '/api/applications') data = { success: true, data: [app] };
        if (path === '/api/notion/sync') data = { configured: true, status: { success: true } };
        if (path === '/api/profile') data = { success: true, resumeText: 'Python developer' };
        await route.fulfill({ contentType: 'application/json', body: JSON.stringify(data) });
      });
      const inside = async locator => {
        const box = await locator.boundingBox();
        assert.ok(box && box.x >= -1 && box.x + box.width <= width + 1, `Element outside ${width}px viewport: ${JSON.stringify(box)}`);
      };
      const noOverflow = async () => assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Page overflow at ${width}px`);
      await page.goto(process.env.PIPELINE_TEST_URL || 'http://localhost:3100');
      await page.getByRole('button', { name: 'Table View', exact: true }).waitFor();
      await noOverflow();
      await page.locator('header button').filter({ has: page.locator('svg.lucide-chevron-down') }).click();
      await inside(page.getByText('Google SSO Invite-Only').locator('..').locator('..'));
      await page.locator('header button').filter({ has: page.locator('svg.lucide-chevron-down') }).click();
      await page.getByRole('button', { name: 'Leads (1)', exact: true }).click();
      const quickAdd = page.getByRole('button', { name: 'Quick Add', exact: true });
      assert.equal((await quickAdd.boundingBox()).y, (await page.getByRole('button', { name: 'Discover', exact: true }).boundingBox()).y);
      await quickAdd.click();
      const addDialog = page.getByRole('dialog', { name: 'Quick Add a real lead' });
      await inside(addDialog);
      await addDialog.getByLabel('Role title', { exact: true }).fill('Test engineer');
      await addDialog.getByLabel('Company', { exact: true }).fill('Test company');
      await page.keyboard.press('Escape');
      assert.equal(await addDialog.isVisible(), false);
      await quickAdd.click();
      assert.equal(await addDialog.getByLabel('Role title', { exact: true }).inputValue(), 'Test engineer');
      await addDialog.getByRole('button', { name: 'Close Quick Add' }).click();
      await inside(page.locator('article'));
      await noOverflow();
      const profileFit = page.getByRole('button', { name: `View profile fit for ${app.role_title} at ${app.company_name}`, exact: true });
      assert.match(await profileFit.textContent(), /Strong fit/);
      await inside(profileFit);
      await profileFit.click();
      const dialog = page.getByRole('dialog', { name: 'Application details' });
      await inside(dialog);
      await inside(dialog.getByRole('heading', { name: app.role_title }));
      assert.equal(await dialog.getByText(app.role_fit_analysis.explanation, { exact: true }).count(), 1);
      await inside(dialog.getByRole('button', { name: 'AI Match', exact: true }));
      await inside(dialog.getByRole('button', { name: 'Edit', exact: true }));
      await dialog.getByRole('button', { name: 'AI Match', exact: true }).click();
      await page.getByRole('heading', { name: 'AI Resume & ATS Matcher' }).waitFor();
      for (const name of ['ChatGPT 5.6 Luna', 'Antigravity 3.8 Flash', 'Antigravity 3.1 Pro High', 'Thinking', 'Web Pro']) {
        await inside(page.getByRole('button', { name, exact: true }));
      }
      await noOverflow();
      await page.close();
    }
  } finally { await browser.close(); }
});
