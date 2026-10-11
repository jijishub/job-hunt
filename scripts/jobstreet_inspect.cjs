const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { ROOT } = require('./jobstreet_resume.cjs');

// Inspect native fields in the existing tab; never fill or save anything.
async function inspectForms() {
  if (location.origin !== 'https://ph.jobstreet.com') throw new Error('Run in JobStreet Philippines.');
  const helper = document.getElementById('job-hunt-helper');
  if (helper?.dataset.running === 'true') throw new Error('Stop the active helper first.');
  helper?.remove();
  const basicVisible = el => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
  const dialogVisible = el => {
    if (!el.isConnected || el.hidden || el.getAttribute('aria-hidden') === 'true') return false;
    const onScreen = node => {
      const rect = node.getBoundingClientRect();
      return basicVisible(node) && getComputedStyle(node).opacity !== '0' && rect.width > 0 && rect.height > 0 && rect.right > 0 && rect.left < innerWidth && rect.bottom > 0 && rect.top < innerHeight;
    };
    return onScreen(el) || [...el.querySelectorAll('input,textarea,select,button')].some(onScreen);
  };
  const visible = el => basicVisible(el) && !el.closest('[aria-hidden=true],[inert]') && (!el.closest('[role=dialog],dialog') || dialogVisible(el.closest('[role=dialog],dialog')));
  const report = { forms: [], errors: [] };
  const targets = [
    { name: 'personal', selector: 'button[aria-label="Edit personal details"]', root_selector: '#personal-details-form-drawer' },
    ...[...document.querySelectorAll('button[id^="edit-role-"],button[id^="edit-qualification-"]')].map(el => ({ name: el.getAttribute('aria-label'), selector: `[id="${el.id}"]`, root_field: el.id.startsWith('edit-role-') ? '#title' : undefined })),
    { name: 'resume', button_prefix: 'Add or manage resum' },
  ];
  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
  const labelOf = el => el.getAttribute('aria-label') || [...(el.labels || [])].map(label => label.textContent.trim()).join(' ') || (el.getAttribute('aria-labelledby') || '').split(/\s+/).map(id => document.getElementById(id)?.textContent || '').join(' ');
  function cancelFor(root) {
    const buttons = [...root.querySelectorAll('button')].filter(visible);
    const cancel = buttons.filter(el => /^cancel(?:\s|$)/i.test((el.getAttribute('aria-label') || el.textContent).trim()));
    return cancel.length ? cancel : buttons.filter(el => /^(close|close dialog|close modal|done)$/i.test((el.getAttribute('aria-label') || el.textContent).trim()));
  }
  const alreadyOpen = [...document.querySelectorAll('[role=dialog],dialog,form')].filter(el => el.tagName === 'FORM' ? visible(el) : dialogVisible(el));
  const currentEditor = alreadyOpen.find(el => cancelFor(el).length === 1);
  if (currentEditor) {
    cancelFor(currentEditor)[0].click();
    await delay(700);
  }
  function controls(root) {
    return [...root.querySelectorAll('input,textarea,select,button,[role=combobox],[role=textbox]')].map(el => ({
      tag: el.tagName, type: el.type, role: el.getAttribute('role'), id: el.id, name: el.name,
      label: labelOf(el), text: el.tagName === 'BUTTON' ? el.textContent.trim() : undefined,
      placeholder: el.getAttribute('placeholder'), visible: visible(el), required: el.required,
      value: ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) && !['password', 'hidden'].includes(el.type) ? el.value : undefined,
      options: el.tagName === 'SELECT' ? [...el.options].map(option => ({ value: option.value, text: option.textContent })) : undefined,
      expanded: el.getAttribute('aria-expanded'), controls: el.getAttribute('aria-controls'),
    }));
  }
  for (const target of targets) {
    try {
      const buttons = target.selector ? [...document.querySelectorAll(target.selector)] : [...document.querySelectorAll('button')].filter(el => el.textContent.startsWith(target.button_prefix));
      if (buttons.length !== 1) throw new Error(`Expected one opener; found ${buttons.length}`);
      const before = new Set([...document.querySelectorAll('input,textarea,select')]);
      const beforeDialogs = new Set([...document.querySelectorAll('[role=dialog],dialog')]);
      buttons[0].scrollIntoView({ block: 'center' });
      buttons[0].click();
      let root;
      for (let attempt = 0; attempt < 50; attempt++) {
        await delay(100);
        const dialogs = [...document.querySelectorAll('[role=dialog],dialog')].filter(dialogVisible);
        const added = [...document.querySelectorAll('input,textarea,select')].find(el => !before.has(el));
        const newDialog = [...document.querySelectorAll('[role=dialog],dialog')].find(el => !beforeDialogs.has(el));
        const specific = target.root_selector ? document.querySelector(target.root_selector) : target.root_field ? document.querySelector(target.root_field)?.closest('form') : null;
        root = specific || added?.closest('form') || newDialog || dialogs.at(-1) || (added ? document.body : null);
        if (root) break;
      }
      if (!root) {
        report.forms.push({ name: target.name, opener: target, root: null, controls: controls(document.body), dialogs: [...document.querySelectorAll('[role=dialog],dialog')].map(el => ({ id: el.id, text: el.textContent.slice(0,300), rect: el.getBoundingClientRect().toJSON(), hidden: el.hidden, aria_hidden: el.getAttribute('aria-hidden') })) });
        throw new Error('No form root found; captured page controls and dialog geometry instead.');
      }
      await delay(600);
      const form = { name: target.name, opener: target, root: { tag: root.tagName, role: root.getAttribute('role'), id: root.id }, controls: controls(root) };
      report.forms.push(form);
      // Resume manager may contain another dialog behind an upload button.
      if (target.name === 'resume') {
        const upload = [...root.querySelectorAll('button')].filter(el => visible(el) && /^(upload|add) (a |new )?resum/i.test(el.textContent.trim()));
        if (upload.length === 1 && !root.querySelector('input[type=file]')) {
          upload[0].click();
          await delay(500);
          const inner = [...document.querySelectorAll('[role=dialog],dialog')].filter(dialogVisible).at(-1) || root;
          form.upload_controls = controls(inner);
          root = inner;
        }
      }
      let cancel = cancelFor(root);
      // A drawer root can have zero dimensions while its child buttons are rendered.
      if (!cancel.length) cancel = [...root.querySelectorAll('button')].filter(el => /^cancel(?:\s|$)/i.test((el.getAttribute('aria-label') || el.textContent).trim()));
      if (cancel.length !== 1) throw new Error(`Cancel/Close is ambiguous (${cancel.length}); stopped without saving. Close this dialog manually.`);
      cancel[0].click();
      for (let attempt = 0; attempt < 40 && root !== document.body && dialogVisible(root); attempt++) await delay(100);
      if (root !== document.body && dialogVisible(root)) throw new Error('Dialog stayed open after Cancel; stopped without saving.');
    } catch (error) {
      report.errors.push({ name: target.name, message: error.message });
      if (/stayed open|Cancel\/Close/.test(error.message)) break;
    }
  }
  const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'jobstreet-forms-report.json';
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  console.log('Downloaded jobstreet-forms-report.json. No fields were changed or saved.');
}
if (require.main === module) {
  const file = path.join(ROOT, '.data/jobstreet/inspect-forms.js');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `(${inspectForms.toString()})();\n`);
  const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', 'Set-Clipboard -Value ([System.IO.File]::ReadAllText($env:JOBSTREET_INSPECT_PATH))'], { env: { ...process.env, JOBSTREET_INSPECT_PATH: file }, encoding: 'utf8' });
  if (result.error || result.status !== 0) throw new Error(result.error?.message || result.stderr);
  console.log('Read-only form inspector copied. Paste in the JobStreet console; it downloads jobstreet-forms-report.json.');
}
module.exports = { inspectForms };
