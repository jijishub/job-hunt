const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright-core');
const { ROOT, prepare } = require('./jobstreet_resume.cjs');
const { buildApplication, calendarDate } = require('./thinkingmachines_apply.cjs');
const { thinkingMachinesHelper } = require('./thinkingmachines_browser.cjs');

test('application data uses active resume, user source, and month-precision date convention', async () => {
  const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'references/thinkingmachines_rpa.json'), 'utf8'));
  const { data: resume } = await prepare('technical');
  const data = buildApplication(resume, config);
  assert.equal(data.personal_information.first_name, 'Jizelle');
  assert.equal(data.personal_information.middle_name, 'D.');
  assert.equal(data.education_highlights[0].start_date, '2022-09-01');
  assert.equal(data.education_highlights[0].end_date, '2026-09-01');
  assert.equal(data.work_experience_highlights.length, 4);
  for (const entry of data.work_experience_highlights) {
    assert.ok(entry.summary.length <= 255);
    assert.equal(entry.summary, config.work_summaries[entry.designation]);
  }
  assert.throws(() => buildApplication(resume, { ...config, work_summaries: { ...config.work_summaries, [resume.profile.experience[0].title]: 'x'.repeat(256) } }), /255-character limit/);
  assert.equal(data.work_experience_highlights[3].end_date, null);
  assert.equal(data.application_questions.where_did_you_initially_learn_about_this_opening, 'Others');
  assert.equal(data.agreements.i_agree_to_tm_privacy_policy, false);
  assert.throws(() => calendarDate('2022'), /Invalid/);
});

async function fixture(run) {
  const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'references/thinkingmachines_rpa.json'), 'utf8'));
  const { data: resume } = await prepare('technical');
  const data = buildApplication(resume, config);
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage();
    await page.route('https://thinkingmachines.freshteam.com/**', route => route.fulfill({ contentType: 'text/html', body: '<form id="application"><div><input type="file" id="uploadFile"><span id="uploadValue"></span><div id="sanitizedfileName"></div></div><input type="hidden" id="resume_id"><button id="submit-button">Submit</button></form>' }));
    await page.goto(data.target_url);
    await page.evaluate(() => {
      const form = document.getElementById('application');
      window.submissions = 0;
      form.onsubmit = event => { event.preventDefault(); window.submissions++; };
      const input = (name, type = 'text', tag = 'input') => {
        const el = document.createElement(tag);
        el.name = name;
        if (tag === 'input') el.type = type;
        form.append(el);
        return el;
      };
      for (const key of ['first_name','middle_name','last_name','email','mobile']) input(`applicant[lead_attributes[${key}]]`);
      function add(group) {
        const keys = group === 'qualifications_attributes' ? ['degree','field_of_study','school_name','start_date','end_date','grade'] : ['title','company','start_date','end_date','summary'];
        const fields = {};
        keys.forEach(key => {
          fields[key] = input(`applicant[lead_attributes][${group}][][${key}]`, 'text', key === 'summary' ? 'textarea' : 'input');
          if (key.endsWith('_date')) fields[key].readOnly = true;
        });
        const current = input(`applicant[lead_attributes][${group}][][is_current]`, 'checkbox');
        current.onchange = () => { fields.end_date.disabled = current.checked; };
      }
      for (const [group, title] of [['qualifications_attributes','+ Add Education'],['positions_attributes','+ Add Employer']]) {
        add(group);
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = title;
        if (group === 'positions_attributes') {
          button.setAttribute('onclick', "addEmployerField(this, 'lead_attributes', 'positions_attributes', true);");
          button.style.display = 'none';
        }
        button.onclick = () => add(group);
        form.append(button);
      }
      for (const key of ['if_you_have_work_samples_available_online_i_e_code_repos_portfolios_etc_we_d_like_to_check_them_out','why_are_you_interested_in_this_role','what_do_you_hope_to_get_out_of_this_role','what_can_you_uniquely_contribute_to_the_team']) {
        const el = input('', 'text', key.startsWith('if_') ? 'input' : 'textarea');
        el.id = `applicant_custom_field_attributes[cf_${key}]`;
      }
      const source = input('', 'text', 'select');
      source.id = 'applicant_custom_field_attributes[cf_where_did_you_initially_learn_about_this_opening]';
      source.innerHTML = '<option value="">--Choose--</option><option value="4000248517">Others</option>';
      const privacy = input('privacy', 'checkbox');
      privacy.id = 'applicant_custom_field_attributes[cf_i_agree_to_tm_s_privacy_policy]';
      document.getElementById('uploadFile').onchange = () => {
        const upload = document.getElementById('uploadFile');
        upload.classList.add('file-disabled');
        document.getElementById('uploadValue').classList.add('analysing');
        setTimeout(() => {
          document.querySelector('input[name="applicant[lead_attributes[first_name]]"]').value = 'Parsed name';
          document.getElementById('resume_id').value = '123';
          document.getElementById('sanitizedfileName').textContent = upload.files[0].name;
          upload.classList.remove('file-disabled');
          document.getElementById('uploadValue').classList.remove('analysing');
        }, 200);
      };
    });
    await run(page, { data, resume: Buffer.from('%PDF-test').toString('base64'), filename: 'JizelleCasia_Resume.pdf', timeout_ms: 1200 });
  } finally { await browser.close(); }
}

test('main-browser helper waits for resume parsing, fills repeated rows, and leaves consent/submission manual', async () => {
  await fixture(async (page, payload) => {
    await page.evaluate(thinkingMachinesHelper, payload);
    assert.equal(await page.locator('#thinkingmachines-helper').getAttribute('data-state'), 'complete', await page.locator('#thinkingmachines-helper').innerText());
    assert.equal(await page.locator('input[name="applicant[lead_attributes[first_name]]"]').inputValue(), 'Jizelle');
    const roles = await page.locator('input').evaluateAll(els => els.filter(el => el.name === 'applicant[lead_attributes][positions_attributes][][title]').map(el => el.value));
    assert.deepEqual(roles, payload.data.work_experience_highlights.map(entry => entry.designation));
    const dates = await page.locator('input').evaluateAll(els => els.filter(el => el.name === 'applicant[lead_attributes][positions_attributes][][start_date]').map(el => el.value));
    assert.equal(dates[0], 'July 01, 2026');
    assert.equal(await page.locator('input[name="privacy"]').isChecked(), false);
    assert.equal(await page.evaluate(() => window.submissions), 0);
    assert.equal(await page.locator('[id="applicant_custom_field_attributes[cf_what_can_you_uniquely_contribute_to_the_team]"]').inputValue(), payload.data.application_questions.what_can_you_uniquely_contribute_to_the_team);
    await page.evaluate(thinkingMachinesHelper, payload);
    assert.equal(await page.locator('#thinkingmachines-helper').getAttribute('data-state'), 'complete');
    assert.equal((await page.locator('input').evaluateAll(els => els.filter(el => el.name === 'applicant[lead_attributes][positions_attributes][][title]').length)), 4);
  });
});
test('upload failure fills remaining fields and flags manual resume review without submitting', async () => {
  await fixture(async (page, payload) => {
    await page.evaluate(() => {
      document.getElementById('uploadFile').onchange = () => {
        document.getElementById('uploadFile').parentElement.insertAdjacentHTML('beforeend', '<p class="error-msg">Upload failed</p>');
      };
    });
    await page.evaluate(thinkingMachinesHelper, payload);
    assert.equal(await page.locator('#thinkingmachines-helper').getAttribute('data-state'), 'complete');
    assert.match(await page.locator('#thinkingmachines-helper').innerText(), /Attach the resume manually/);
    assert.equal(await page.locator('input[name="applicant[lead_attributes[first_name]]"]').inputValue(), 'Jizelle');
    assert.equal(await page.evaluate(() => window.submissions), 0);
  });
});
