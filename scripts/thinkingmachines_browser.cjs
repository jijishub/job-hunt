// This function is serialized and runs in the user's existing Freshteam tab.
async function thinkingMachinesHelper(payload) {
  const target = new URL(payload.data.target_url);
  if (location.origin !== target.origin || location.pathname !== target.pathname) throw new Error('Open the specified Thinking Machines application before running this helper.');
  const previous = document.getElementById('thinkingmachines-helper');
  if (previous?.dataset.running === 'true') throw new Error('The Thinking Machines helper is already running.');
  previous?.remove();
  const panel = document.createElement('section');
  panel.id = 'thinkingmachines-helper';
  panel.dataset.running = 'true';
  panel.style.cssText = 'position:fixed;right:16px;top:16px;z-index:2147483647;background:white;color:#222;padding:18px;border:2px solid #2864c5;border-radius:12px;max-width:360px;font:14px system-ui;box-shadow:0 4px 24px #0004';
  const title = document.createElement('strong');
  title.textContent = 'Thinking Machines application helper';
  const status = document.createElement('p');
  const note = document.createElement('p');
  note.textContent = payload.data.date_convention;
  const stop = document.createElement('button');
  stop.textContent = 'Stop';
  const close = document.createElement('button');
  close.textContent = 'Close';
  close.disabled = true;
  panel.append(title, status, note, stop, close);
  document.body.append(panel);
  let cancelled = false;
  let resumeWarning = '';
  stop.onclick = () => { cancelled = true; };
  close.onclick = () => panel.remove();
  const check = () => {
    if (cancelled) throw new Error('Stopped by user. Filled fields remain available for review.');
    if (location.origin !== target.origin || location.pathname !== target.pathname) throw new Error('Application page changed; stopped.');
  };
  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
  const visible = el => el.isConnected && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
  async function waitFor(find, description) {
    const deadline = Date.now() + (payload.timeout_ms || 20000);
    while (Date.now() < deadline) {
      check();
      const result = find();
      if (result) return result;
      await delay(100);
    }
    throw new Error(`Timed out waiting for ${description}.`);
  }
  function personal(key) {
    const name = `applicant[lead_attributes[${key}]]`;
    const fields = [...document.querySelectorAll('input')].filter(el => el.name === name);
    if (fields.length !== 1) throw new Error(`Expected one ${key} field.`);
    return fields[0];
  }
  function rows(group) {
    const name = `applicant[lead_attributes][${group}][][`;
    return [...document.querySelectorAll('input,textarea')].filter(el => el.name.startsWith(name) && !panel.contains(el));
  }
  function groupFields(group, key) {
    return rows(group).filter(el => el.name === `applicant[lead_attributes][${group}][][${key}]`);
  }
  function custom(key) {
    const field = document.getElementById(`applicant_custom_field_attributes[${key}]`);
    if (!field) throw new Error(`Missing application question: ${key}`);
    return field;
  }
  function dateText(value) {
    const [year, month, day] = value.split('-').map(Number);
    const names = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    return `${names[month - 1]} ${String(day).padStart(2, '0')}, ${year}`;
  }
  function fill(field, value) {
    check();
    if (field.disabled) throw new Error(`Field is disabled: ${field.name}`);
    const prototype = field.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value').set.call(field, String(value));
    field.dispatchEvent(new Event('input', { bubbles: true }));
    field.dispatchEvent(new Event('change', { bubbles: true }));
  }
  function setDate(field, value) {
    check();
    if (window.jQuery?.fn?.datepicker) {
      const [year, month, day] = value.split('-').map(Number);
      window.jQuery(field).datepicker('update', new Date(year, month - 1, day));
      field.dispatchEvent(new Event('change', { bubbles: true }));
    } else fill(field, dateText(value));
  }
  async function ensureRows(group, count, buttonText, identityKey) {
    let existing = groupFields(group, identityKey).length;
    if (existing > count) throw new Error(`There are already ${existing} ${group} rows; expected ${count}. Review/remove extra rows before rerunning.`);
    while (existing < count) {
      check();
      const handler = group === 'positions_attributes' ? 'addEmployerField' : 'addEducationField';
      const buttons = [...document.querySelectorAll('button')].filter(el =>
        !panel.contains(el) && !el.disabled &&
        (el.getAttribute('onclick')?.includes(`${handler}(`) ||
          (visible(el) && el.textContent.replace(/\s+/g, ' ').trim() === buttonText)));
      if (buttons.length !== 1) throw new Error(`Expected one ${buttonText} button.`);
      buttons[0].click();
      await waitFor(() => groupFields(group, identityKey).length === existing + 1, 'the added row');
      existing++;
    }
  }
  async function fillRows(group, entries, mapping, currentKey) {
    // Preflight every field before changing rows in this group.
    for (const key of Object.keys(mapping)) if (groupFields(group, key).length !== entries.length) throw new Error(`Missing or ambiguous ${group} ${key} fields.`);
    if (groupFields(group, 'is_current').length !== entries.length) throw new Error('Missing current-status checkboxes.');
    for (let index = 0; index < entries.length; index++) {
      check();
      const entry = entries[index];
      const checkbox = groupFields(group, 'is_current')[index];
      if (checkbox.checked !== Boolean(entry[currentKey])) checkbox.click();
      await delay(0);
      for (const [key, dataKey] of Object.entries(mapping)) {
        const field = groupFields(group, key)[index];
        if (key === 'end_date' && entry[currentKey]) continue;
        if (key.endsWith('_date')) setDate(field, entry[dataKey]);
        else fill(field, entry[dataKey]);
      }
    }
  }
  try {
    status.textContent = '1/5: uploading the active resume…';
    const upload = document.getElementById('uploadFile');
    if (!upload || upload.type !== 'file') throw new Error('Resume upload field was not found.');
    const bytes = Uint8Array.from(atob(payload.resume), char => char.charCodeAt(0));
    const transfer = new DataTransfer();
    transfer.items.add(new File([bytes], payload.filename, { type: 'application/pdf' }));
    upload.files = transfer.files;
    let parseRequest;
    const trackParse = (_event, request, settings) => {
      if (settings.url?.includes('/jobs/leads/parse_resume')) parseRequest = request;
    };
    window.jQuery?.(document).on('ajaxSend.thinkingMachinesHelper', trackParse);
    upload.dispatchEvent(new Event('change', { bubbles: true }));
    // Wait for Freshteam's actual upload/parse completion instead of racing its autofill.
    try {
      await waitFor(() => {
      const resumeId = document.getElementById('resume_id');
      const filename = document.getElementById('sanitizedfileName');
      const parseError = upload.parentElement.querySelector('.error-msg');
      if (parseError && visible(parseError) && parseError.textContent.trim()) throw new Error(parseError.textContent.trim());
      return resumeId?.value && filename?.textContent.includes(payload.filename) && !upload.classList.contains('file-disabled') && !document.getElementById('uploadValue')?.classList.contains('analysing');
      }, 'resume upload and parsing to finish');
    } catch (error) {
      check();
      // Stop a pending parser before filling so it cannot overwrite our values later.
      if (parseRequest && parseRequest.readyState !== 4) parseRequest.abort();
      resumeWarning = 'Resume parsing failed. Attach the resume manually and verify it is accepted before submitting. ';
      upload.classList.remove('file-disabled');
      document.getElementById('uploadValue')?.classList.remove('analysing');
      note.textContent = resumeWarning + payload.data.date_convention;
    } finally {
      window.jQuery?.(document).off('ajaxSend.thinkingMachinesHelper', trackParse);
    }
    status.textContent = '2/5: filling personal information…';
    for (const [key, value] of Object.entries(payload.data.personal_information)) fill(personal(key), value);
    status.textContent = '3/5: filling education and work experience…';
    await ensureRows('qualifications_attributes', payload.data.education_highlights.length, '+ Add Education', 'degree');
    await fillRows('qualifications_attributes', payload.data.education_highlights, { degree: 'degree', field_of_study: 'field_of_study', school_name: 'institution_or_school_name', start_date: 'start_date', end_date: 'end_date', grade: 'grade' }, 'currently_pursuing');
    await ensureRows('positions_attributes', payload.data.work_experience_highlights.length, '+ Add Employer', 'title');
    await fillRows('positions_attributes', payload.data.work_experience_highlights, { title: 'designation', company: 'company_or_business_name', start_date: 'start_date', end_date: 'end_date', summary: 'summary' }, 'currently_work_here');
    status.textContent = '4/5: filling portfolio and application answers…';
    fill(custom('cf_if_you_have_work_samples_available_online_i_e_code_repos_portfolios_etc_we_d_like_to_check_them_out'), payload.data.work_samples);
    const answers = payload.data.application_questions;
    const source = custom('cf_where_did_you_initially_learn_about_this_opening');
    const options = [...source.options].filter(option => option.textContent.trim() === answers.where_did_you_initially_learn_about_this_opening);
    if (options.length !== 1) throw new Error('The selected opening source is not available.');
    source.value = options[0].value;
    source.dispatchEvent(new Event('change', { bubbles: true }));
    for (const key of ['why_are_you_interested_in_this_role','what_do_you_hope_to_get_out_of_this_role','what_can_you_uniquely_contribute_to_the_team']) fill(custom(`cf_${key}`), answers[key]);
    status.textContent = `5/5: fields filled. ${resumeWarning}Review the answers and calendar dates, accept the privacy statement, complete CAPTCHA if shown, then submit yourself. No application has been submitted.`;
    panel.dataset.state = 'complete';
  } catch (error) {
    status.textContent = `${error.message} Stopped; later steps were not run. No application was submitted.`;
    panel.dataset.state = 'stopped';
  } finally {
    panel.dataset.running = 'false';
    stop.disabled = true;
    close.disabled = false;
  }
}
module.exports = { thinkingMachinesHelper };
