const { test } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright-core');

test('extension credential controls show a secret once, hide on close, and revoke without changing preferences', async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1000, height: 900 } });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    const user = { id: 'credential-test', name: 'Credential Tester', email: 'credential-test@example.com', role: 'member' };
    const token = 'jh_capture_' + 'x'.repeat(43);
    let credentials = [], issued = 0, revoked = 0, preferencesWrites = 0;
    await page.route('**/api/**', async route => {
      const request = route.request(), url = new URL(request.url());
      let result = { success: true, data: [] };
      if (url.pathname === '/api/auth/session') result = { user, expires: '2099-01-01' };
      else if (url.pathname === '/api/users') result.data = [user];
      else if (url.pathname === '/api/profile') result = { success: true, resumeText: '' };
      else if (url.pathname === '/api/notion/sync') result = { configured: false };
      else if (url.pathname === '/api/preferences') {
        if (request.method() !== 'GET') preferencesWrites++;
        result.data = { default_view: 'ALL', work_models: [], job_types: [], target_companies: [], target_roles: [], preferred_locations: [], dealbreakers: '', salary_currency: 'PHP' };
      } else if (url.pathname === '/api/extension-credentials') {
        if (request.method() === 'POST') {
          issued++;
          assert.equal(new URL(request.url()).origin, request.headers().origin);
          const credential = { id: '11111111-2222-4333-8444-555555555555', label: request.postDataJSON().label, expires_at: '2099-01-01T00:00:00Z', revoked_at: null };
          credentials = [credential]; result = { success: true, token, credential };
        } else if (request.method() === 'DELETE') {
          revoked++; credentials = credentials.map(c => ({ ...c, revoked_at: '2026-10-18T00:00:00Z' })); result = { success: true };
        } else result.data = credentials;
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(result) });
    });
    await page.goto(process.env.PIPELINE_TEST_URL || 'http://localhost:3100', { timeout: 90000 });
    await page.getByRole('button', { name: 'My preferences', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'My preferences', exact: true });
    await dialog.getByLabel('Extension connection label', { exact: true }).fill('My browser');
    await dialog.getByRole('button', { name: 'Create extension credential', exact: true }).click();
    const secret = dialog.getByLabel('New extension credential', { exact: true });
    await secret.waitFor(); assert.equal(await secret.inputValue(), token); assert.equal(issued, 1);
    await dialog.getByRole('button', { name: 'Close preferences', exact: true }).click();
    await page.getByRole('button', { name: 'My preferences', exact: true }).click();
    await dialog.getByRole('button', { name: 'Revoke My browser', exact: true }).waitFor();
    assert.equal(await dialog.getByLabel('New extension credential', { exact: true }).count(), 0);
    assert.equal((await page.content()).includes(token), false);
    await dialog.getByRole('button', { name: 'Revoke My browser', exact: true }).click();
    await dialog.getByText('Revoked', { exact: true }).waitFor();
    assert.equal(revoked, 1); assert.equal(preferencesWrites, 0);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
