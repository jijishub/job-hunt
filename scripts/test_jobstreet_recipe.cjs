const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright-core');
const { ROOT, prepare } = require('./jobstreet_resume.cjs');
const { expandTasks } = require('./jobstreet_sync.cjs');
const { browserHelper } = require('./jobstreet_sequence.cjs');

async function fixture(run) {
  const recipe = JSON.parse(fs.readFileSync(path.join(ROOT, 'references/jobstreet_rpa.json'), 'utf8'));
  const { data } = await prepare('technical');
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage();
    await page.route('https://ph.jobstreet.com/**', route => route.fulfill({ contentType: 'text/html', body: '<input id="avatar" type="file" aria-label="Avatar file input">' }));
    await page.goto('https://ph.jobstreet.com/profile/me');
    await page.evaluate(({ recipe, data }) => {
      window.saved = [];
      const dialog = id => {
        const root = document.createElement('div');
        root.id = id;
        root.setAttribute('role', 'dialog');
        root.style.cssText = 'position:fixed;top:0;left:0;background:white;display:none;width:600px;min-height:400px';
        document.body.append(root);
        return root;
      };
      const opener = (text, id, callback, label) => {
        const button = document.createElement('button');
        button.textContent = text;
        if (id) button.id = id;
        if (label) button.setAttribute('aria-label', label);
        button.onclick = callback;
        document.body.append(button);
      };
      let dateIndex = 0;
      const dates = label => {
        const id = `date-${dateIndex++}`;
        return `<label for="${id}">${label}</label><select id="${id}">${['', ...(label === 'Month' ? Array.from({ length: 12 }, (_, i) => i + 1) : [2026, 2025, 2024, 2023, 2022])].map(value => `<option value="${value}">${value}</option>`).join('')}</select>`;
      };
      const personal = dialog('personal-details-form-drawer');
      opener('Edit personal', '', () => {
        personal.style.display = 'block';
        personal.innerHTML = '<form><label>First name<input id="firstName"></label><label>Last name<input id="lastName"></label><button>Save</button></form>';
        personal.querySelector('form').onsubmit = event => {
          event.preventDefault();
          window.saved.push({ kind: 'personal', first: personal.querySelector('#firstName').value, last: personal.querySelector('#lastName').value });
          setTimeout(() => { personal.style.display = 'none'; }, 40);
        };
      }, 'Edit personal details');
      const career = recipe.tasks.find(task => task.for_each === 'profile.experience');
      data.profile.experience.forEach((entry, index) => {
        const root = dialog(`role-drawer-${index}`);
        opener('Edit role', career.open.entry_ids[entry.title], () => {
          root.style.display = 'block';
          root.innerHTML = `<form><label>Job title<input id="title"></label><label>Company name<input id="company"></label>${dates('Month')}${dates('Year')}<label>Still in role<input type="checkbox" id="stillInRole" checked></label><div id="end-dates" hidden>${dates('Month')}${dates('Year')}</div><label>Description (recommended)<textarea id="achievements"></textarea></label><button>Save role</button></form>`;
          root.querySelector('#title').value = window.wrongCareer ? 'Unrelated job' : career.expected_by_entry[entry.title].values[0];
          root.querySelector('#company').value = entry.company;
          root.querySelector('#stillInRole').onclick = event => { root.querySelector('#end-dates').hidden = event.target.checked; };
          root.querySelector('form').onsubmit = event => {
            event.preventDefault();
            window.saved.push({ kind: 'career', index, title: root.querySelector('#title').value, description: root.querySelector('#achievements').value, dates: [...root.querySelectorAll('select')].map(el => el.value), current: root.querySelector('#stillInRole').checked });
            setTimeout(() => { root.style.display = 'none'; }, 40);
          };
        });
      });
      const education = recipe.tasks.find(task => task.for_each === 'profile.education');
      const edu = dialog('education-drawer');
      opener('Edit education', education.open.entry_ids[data.profile.education[0].institution], () => {
        edu.style.display = 'block';
        edu.innerHTML = '<form><label>Course or qualification<input id="name"></label><label>Institution<input id="institute"></label><label>Qualification complete<input type="checkbox" id="completed"></label><select id="completionDate"><option value="2026">2026</option></select><textarea id="highlights"></textarea><button>Save education</button></form>';
        edu.querySelector('#name').value = 'Bachelor of Science (Information Technology)';
        edu.querySelector('form').onsubmit = event => {
          event.preventDefault();
          window.saved.push({ kind: 'education', qualification: edu.querySelector('#name').value, institution: edu.querySelector('#institute').value, year: edu.querySelector('#completionDate').value, complete: edu.querySelector('#completed').checked });
          setTimeout(() => { edu.style.display = 'none'; }, 40);
        };
      });
      const resume = dialog('resume-form-drawer');
      opener('Add or manage resumés (1)', '', () => {
        resume.style.display = 'block';
        resume.innerHTML = '<input type="file" hidden><label>Make this my default resumé<input id="defaultResume" type="checkbox"></label><p id="filename"></p><button>Done</button>';
        resume.querySelector('input[type=file]').onchange = event => {
          const filename = event.target.files[0].name;
          window.saved.push({ kind: 'resume', filename, default: resume.querySelector('#defaultResume').checked });
          setTimeout(() => { resume.querySelector('#filename').textContent = filename; }, 40);
        };
        resume.querySelector('button').onclick = () => { resume.style.display = 'none'; };
      });
      const summary = dialog('summary-drawer');
      opener('Edit summary', 'editPersonalSummary', () => {
        summary.style.display = 'block';
        summary.innerHTML = '<form><textarea></textarea><button>Save summary</button></form>';
        summary.querySelector('form').onsubmit = event => {
          event.preventDefault();
          window.saved.push({ kind: 'summary', text: summary.querySelector('textarea').value });
          setTimeout(() => { summary.style.display = 'none'; }, 40);
        };
      });
    }, { recipe, data });
    await run(page, { data, tasks: expandTasks(recipe.tasks, data), resume: Buffer.from('%PDF-test').toString('base64'), filename: path.basename(data.source.path), timeout_ms: 1200 });
  } finally { await browser.close(); }
}

test('real JSON recipe updates all eight tasks including the exact professional summary', async () => {
  await fixture(async (page, payload) => {
    await page.evaluate(browserHelper, payload);
    await page.waitForFunction(() => ['complete', 'stopped'].includes(document.getElementById('job-hunt-helper').dataset.state));
    assert.equal(await page.locator('#job-hunt-helper').getAttribute('data-state'), 'complete', await page.locator('#job-hunt-helper').innerText());
    const saved = await page.evaluate(() => window.saved);
    assert.equal(saved.length, 8);
    assert.equal(saved[0].first, 'Jizelle D.');
    payload.data.profile.experience.forEach((entry, index) => {
      const result = saved[index + 1];
      assert.equal(result.title, entry.title);
      assert.equal(result.description, entry.description);
      assert.equal(result.current, entry.current);
      assert.deepEqual(result.dates.slice(0, 2), [String(Number(entry.start_date.slice(5))), entry.start_date.slice(0, 4)]);
      if (entry.end_date) assert.deepEqual(result.dates.slice(2), [String(Number(entry.end_date.slice(5))), entry.end_date.slice(0, 4)]);
    });
    assert.equal(saved[5].complete, true);
    assert.equal(saved[5].year, '2026');
    assert.equal(saved[6].default, true);
    assert.equal(saved[7].kind, 'summary');
    assert.equal(saved[7].text, payload.tasks.at(-1).steps[0].value);
    assert.equal(await page.locator('#avatar').evaluate(el => el.files.length), 0);
    assert.equal(await page.locator('#resume-form-drawer').isVisible(), false);
  });
});
test('a stale career form is rejected before modifying or saving that entry', async () => {
  await fixture(async (page, payload) => {
    await page.evaluate(() => { window.wrongCareer = true; });
    await page.evaluate(browserHelper, payload);
    await page.waitForFunction(() => document.getElementById('job-hunt-helper').dataset.state === 'stopped');
    assert.equal(await page.evaluate(() => window.saved.length), 1);
    assert.equal(await page.locator('#title').filter({ visible: true }).inputValue(), 'Unrelated job');
  });
});
