const { test } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright-core');
const { browserHelper } = require('./jobstreet_sequence.cjs');
const { inspectForms } = require('./jobstreet_inspect.cjs');

async function fixture(run) {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage();
    await page.route('https://ph.jobstreet.com/**', route => route.fulfill({ contentType: 'text/html', body: '<section id="personal"><h2>Personal details</h2><button id="personal-edit">Edit</button></section><section id="career"><h2>Career history</h2><article id="role-a"><h3>Engineer</h3><p>Same Company</p><button>Edit</button></article><article id="role-b"><h3>Intern</h3><p>Same Company</p><button>Edit</button></article></section><section id="resume"><h2>Resume</h2><input type="file"><p id="uploaded"></p></section><div id="editor"></div>' }));
    await page.goto('https://ph.jobstreet.com/profile/me');
    await page.evaluate(() => {
      window.events = [];
      window.failSave = false;
      const edit = id => {
        window.events.push(`open:${id}`);
        document.getElementById('editor').innerHTML = '<form><label>Full name<input id="name" value="Original"></label><label>Job title<input id="title"></label><label>Company name<input id="company"></label><label>Description<textarea></textarea></label><button type="submit">Save</button></form>';
        document.querySelector('form').onsubmit = event => {
          event.preventDefault();
          window.events.push(`save:${id}:${document.querySelector('#name').value}`);
          if (window.failSave) {
            document.querySelector('form').insertAdjacentHTML('beforeend', '<p role="alert">Required field is invalid</p>');
            return;
          }
          if (!window.holdSave) setTimeout(() => { document.getElementById('editor').innerHTML = ''; window.events.push(`saved:${id}`); }, 150);
        };
      };
      document.getElementById('personal-edit').onclick = () => edit('personal');
      document.querySelector('#role-a button').onclick = () => edit('a');
      document.querySelector('#role-b button').onclick = () => edit('b');
      document.querySelector('input[type=file]').onchange = event => {
        window.events.push('upload');
        setTimeout(() => { document.getElementById('uploaded').textContent = event.target.files[0].name; window.events.push('uploaded'); }, 150);
      };
    });
    await run(page);
  } finally { await browser.close(); }
}
function payload() {
  return {
    timeout_ms: 800,
    data: { variant: 'technical', profile: { name: 'Updated', role: { title: 'Intern', company: 'Same Company' } } },
    resume: Buffer.from('%PDF-test').toString('base64'), filename: 'resume.pdf',
    tasks: [
      { name: 'Name', open: { section: 'Personal details', button: 'Edit' }, steps: [{ action: 'fill', label: 'Full name', data: 'profile.name' }], save: { button: 'Save' } },
      { name: 'Intern role', open: { section: 'Career history', button: 'Edit', match_data: ['profile.role.title', 'profile.role.company'] }, steps: [{ action: 'fill', label: 'Job title', data: 'profile.role.title' }], save: { button: 'Save' } },
      { name: 'Resume', open: { section: 'Resume', selector: 'input[type=file]', action: 'upload' }, steps: [{ action: 'upload', selector: 'input[type=file]' }], complete: { section: 'Resume', text: '$filename' } },
    ],
  };
}
test('paste runs the entire queue and waits for each save before opening the next entry', async () => {
  await fixture(async page => {
    await page.evaluate(browserHelper, payload());
    await page.waitForFunction(() => document.getElementById('job-hunt-helper').dataset.state === 'complete');
    assert.deepEqual(await page.evaluate(() => window.events), ['open:personal', 'save:personal:Updated', 'saved:personal', 'open:b', 'save:b:Original', 'saved:b', 'upload', 'uploaded']);
    assert.equal(await page.locator('input[type=file]').evaluate(el => el.files[0].name), 'resume.pdf');
  });
});
test('missing field preflight stops before any field is changed or later task is opened', async () => {
  await fixture(async page => {
    const data = payload();
    data.tasks[0].steps.push({ action: 'fill', label: 'Missing', value: 'x' });
    await page.evaluate(browserHelper, data);
    await page.waitForFunction(() => document.getElementById('job-hunt-helper').dataset.state === 'stopped');
    assert.equal(await page.locator('#name').inputValue(), 'Original');
    assert.deepEqual(await page.evaluate(() => window.events), ['open:personal']);
  });
});
test('save validation errors prevent all subsequent tasks', async () => {
  await fixture(async page => {
    await page.evaluate(() => { window.failSave = true; });
    await page.evaluate(browserHelper, payload());
    await page.waitForFunction(() => document.getElementById('job-hunt-helper').dataset.state === 'stopped');
    assert.match(await page.locator('#job-hunt-helper').innerText(), /JobStreet rejected/);
    assert.deepEqual(await page.evaluate(() => window.events), ['open:personal', 'save:personal:Updated']);
  });
});
test('ambiguous entry identity cannot click a different career record', async () => {
  await fixture(async page => {
    await page.evaluate(() => { document.querySelector('#role-a h3').textContent = 'Intern'; });
    const data = payload();
    data.tasks = [data.tasks[1]];
    await page.evaluate(browserHelper, data);
    await page.waitForFunction(() => document.getElementById('job-hunt-helper').dataset.state === 'stopped');
    assert.match(await page.locator('#job-hunt-helper').innerText(), /Ambiguous/);
    assert.deepEqual(await page.evaluate(() => window.events), []);
  });
});
test('retry resumes the failed task without rerunning completed tasks', async () => {
  await fixture(async page => {
    const data = payload();
    data.tasks[1].steps.push({ action: 'fill', label: 'Missing', value: 'Now exists' });
    await page.evaluate(browserHelper, data);
    await page.waitForFunction(() => document.getElementById('job-hunt-helper').dataset.state === 'stopped');
    await page.evaluate(() => { document.querySelector('form').insertAdjacentHTML('beforeend', '<label>Missing<input></label>'); });
    await page.getByRole('button', { name: 'Retry remaining' }).click();
    await page.waitForFunction(() => document.getElementById('job-hunt-helper').dataset.state === 'complete');
    const events = await page.evaluate(() => window.events);
    assert.equal(events.filter(event => event === 'open:personal').length, 1);
    assert.equal(events.filter(event => event === 'open:b').length, 1);
    assert.ok(events.includes('uploaded'));
  });
});
test('Stop prevents opening subsequent tasks while a save is in flight', async () => {
  await fixture(async page => {
    await page.evaluate(() => { window.holdSave = true; });
    await page.evaluate(browserHelper, payload());
    await page.waitForFunction(() => window.events.some(event => event.startsWith('save:personal')));
    await page.getByRole('button', { name: 'Stop', exact: true }).click();
    await page.waitForFunction(() => document.getElementById('job-hunt-helper').dataset.state === 'stopped');
    assert.match(await page.locator('#job-hunt-helper').innerText(), /Stopped by user/);
    assert.equal(await page.evaluate(() => window.events.includes('open:b')), false);
  });
});
test('form inspector continues past offscreen drawers without filling or saving', async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage();
    await page.route('https://ph.jobstreet.com/**', route => route.fulfill({ contentType: 'text/html', body: '<button aria-label="Edit personal details">Personal</button><button id="edit-role-test">Role</button><button>Add or manage resumés (1)</button><div role="dialog" id="drawer" style="position:fixed;left:0;top:0;width:400px;height:500px;transform:translateX(200vw)"></div>' }));
    await page.goto('https://ph.jobstreet.com/profile/me');
    await page.evaluate(() => {
      window.saved = 0;
      window.cancelled = 0;
      const drawer = document.getElementById('drawer');
      const open = resume => {
        drawer.innerHTML = resume ? '<input type="file"><button>Cancel</button>' : '<label>First name<input value="Original"></label><button>Save</button><button>Cancel</button><button aria-label="Close"></button>';
        drawer.style.transform = 'none';
        [...drawer.querySelectorAll('button')].forEach(button => {
          if (button.textContent === 'Save') button.onclick = () => { window.saved++; };
          else button.onclick = () => { window.cancelled++; drawer.style.transform = 'translateX(200vw)'; };
        });
      };
      document.querySelector('button[aria-label]').onclick = () => open(false);
      document.getElementById('edit-role-test').onclick = () => {
        open(false);
        [...drawer.querySelectorAll('button')].find(button => button.textContent === 'Cancel').textContent = 'Cancel edit role';
      };
      [...document.querySelectorAll('body>button')].at(-1).onclick = () => open(true);
    });
    const downloadPromise = page.waitForEvent('download');
    await page.evaluate(inspectForms);
    const download = await downloadPromise;
    const stream = await download.createReadStream();
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    const report = JSON.parse(Buffer.concat(chunks).toString());
    assert.equal(report.forms.length, 3);
    assert.deepEqual(report.errors, []);
    assert.equal(report.forms[0].controls[0].value, 'Original');
    assert.equal(await page.evaluate(() => window.saved), 0);
    assert.equal(await page.evaluate(() => window.cancelled), 3);
  } finally { await browser.close(); }
});
