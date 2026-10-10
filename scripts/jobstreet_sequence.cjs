// Serialized into the existing signed-in tab by jobstreet_browser.cjs.
function browserHelper(payload) {
  if (location.origin !== 'https://ph.jobstreet.com') throw new Error('Run this helper in your JobStreet Philippines tab.');
  const previous = document.getElementById('job-hunt-helper');
  if (previous?.dataset.running === 'true') throw new Error('A JobStreet sequence is already running. Stop it before replacing it.');
  previous?.remove();
  const panel = document.createElement('section');
  panel.id = 'job-hunt-helper';
  panel.style.cssText = 'position:fixed;right:20px;top:20px;z-index:2147483647;padding:18px;background:white;color:#222;border:2px solid #2864c5;border-radius:12px;max-width:380px;font:14px system-ui;box-shadow:0 4px 24px #0004';
  const title = document.createElement('strong');
  title.textContent = `JobStreet automatic sync (${payload.data.variant})`;
  const status = document.createElement('p');
  const list = document.createElement('ol');
  const rows = payload.tasks.map(task => {
    const row = document.createElement('li');
    row.textContent = task.name;
    list.append(row);
    return row;
  });
  const retry = document.createElement('button');
  retry.textContent = 'Retry remaining';
  retry.disabled = true;
  const stop = document.createElement('button');
  stop.textContent = 'Stop';
  const close = document.createElement('button');
  close.textContent = 'Close';
  panel.append(title, status, list, retry, stop, close);
  document.body.append(panel);
  let stopped = false;
  let next = 0;
  let openedTask = -1;
  const timeout = payload.timeout_ms || 15000;
  const normalize = text => String(text || '').replace(/\s+/g, ' ').trim().toLowerCase();
  const dataAt = key => key.split('.').reduce((obj, part) => obj?.[part], payload.data);
  const visible = el => {
    if (!el.isConnected || panel.contains(el) || !el.getClientRects().length || getComputedStyle(el).visibility === 'hidden' || el.closest('[aria-hidden=true],[inert]')) return false;
    const dialog = el.closest('[role=dialog],dialog');
    if (!dialog) return true;
    const onScreen = node => {
      const rect = node.getBoundingClientRect();
      return node.getClientRects().length > 0 && getComputedStyle(node).visibility !== 'hidden' && getComputedStyle(node).opacity !== '0' && rect.width > 0 && rect.height > 0 && rect.right > 0 && rect.left < innerWidth && rect.bottom > 0 && rect.top < innerHeight;
    };
    return onScreen(dialog) || [...dialog.querySelectorAll('input,textarea,select,button')].some(onScreen);
  };
  const check = () => {
    if (stopped) throw new Error('Stopped by user.');
    if (location.origin !== 'https://ph.jobstreet.com') throw new Error('Outside JobStreet.');
  };
  async function waitFor(find, description) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      check();
      const result = find();
      if (result) return result;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error(`Timed out waiting for ${description}. Update references/jobstreet_rpa.json to match your form.`);
  }
  function one(elements, description) {
    if (elements.length > 1) throw new Error(`Ambiguous ${description}: ${elements.length} matches. Sequence stopped.`);
    return elements[0];
  }
  function section(open) {
    if (!open.section) return document;
    const names = Array.isArray(open.section) ? open.section : [open.section];
    const heading = one([...document.querySelectorAll('h1,h2,h3,h4,[role=heading]')].filter(el => visible(el) && names.some(name => normalize(el.textContent) === normalize(name))), `section ${names.join('/')}`);
    if (!heading) return null;
    if (open.section_selector) return heading.closest(open.section_selector);
    // Stop at the first wrapper with controls, before climbing into other sections.
    let root = heading.parentElement;
    while (root && root !== document.body) {
      const level = Number(heading.getAttribute('aria-level') || heading.tagName.slice(1)) || 2;
      const containsAnotherHeading = [...root.querySelectorAll('h1,h2,h3,h4,[role=heading]')].some(el => el !== heading && visible(el) && (Number(el.getAttribute('aria-level') || el.tagName.slice(1)) || 2) <= level);
      if (containsAnotherHeading) throw new Error(`Section ${open.section} needs an explicit section_selector.`);
      const containsIdentity = !open.match_data || open.match_data.every(key => dataAt(key) && normalize(root.textContent).includes(normalize(dataAt(key))));
      if (containsIdentity && root.querySelector('button,a,[role=button],input[type=file]')) return root;
      root = root.parentElement;
    }
    return null;
  }
  function findControl(mapping, root = document) {
    let controls;
    if (mapping.label) {
      controls = [...root.querySelectorAll('input,textarea,select')].filter(el => {
        const labelled = (el.getAttribute('aria-labelledby') || '').split(/\s+/).filter(Boolean).map(id => document.getElementById(id)?.textContent || '').join(' ');
        const labels = [el.getAttribute('aria-label'), labelled, ...[...(el.labels || [])].map(label => label.textContent)];
        return labels.some(label => normalize(label) === normalize(mapping.label));
      });
    } else if (mapping.button || mapping.button_prefix) {
      const names = Array.isArray(mapping.button) ? mapping.button : [mapping.button];
      controls = [...root.querySelectorAll('button,a,[role=button],input[type=submit]')].filter(el => {
        const name = normalize(el.getAttribute('aria-label') || el.textContent || el.value);
        return mapping.button_prefix ? name.startsWith(normalize(mapping.button_prefix)) : names.some(expected => name === normalize(expected));
      });
    } else if (mapping.selector) controls = [...root.querySelectorAll(mapping.selector)];
    else throw new Error('Mapping needs label, button, or selector.');
    controls = controls.filter(el => !panel.contains(el) && (mapping.action === 'upload' ? el.isConnected : visible(el)));
    if (mapping.index !== undefined) {
      if (!Number.isInteger(mapping.index) || mapping.index < 0) throw new Error('Field index must be a nonnegative integer.');
      return controls[mapping.index];
    }
    return one(controls, mapping.label || mapping.button || mapping.selector);
  }
  function openControl(open) {
    const root = section(open);
    if (!root) return null;
    if (!open.match_data) return findControl(open, root);
    const terms = open.match_data.map(key => {
      const value = dataAt(key);
      if (!value) throw new Error(`Missing entry identity: ${key}`);
      return normalize(value);
    });
    // Identify the smallest entry containing every identity term and exactly one Edit.
    const candidates = [...root.querySelectorAll('article,li,section,div')].filter(el => visible(el) && terms.every(term => normalize(el.textContent).includes(term)));
    const matches = candidates.map(el => {
      const controls = [...el.querySelectorAll('button,a,[role=button]')].filter(button => visible(button) && normalize(button.getAttribute('aria-label') || button.textContent) === normalize(open.button));
      return controls.length === 1 ? controls[0] : null;
    }).filter(Boolean);
    return one([...new Set(matches)], 'matching existing entry Edit button');
  }
  function editorRoot(task) {
    if (task.editor_selector) return one([...document.querySelectorAll(task.editor_selector)].filter(visible), 'editor');
    const first = findControl(task.steps[0]);
    return first?.closest('[role=dialog],form') || document;
  }
  function planSteps(task) {
    const root = editorRoot(task);
    if (!root) return null;
    if (task.expected) {
      const field = findControl(task.expected, root);
      if (!field || !task.expected.values.some(value => normalize(field.value) === normalize(value))) return null;
    }
    const plan = [];
    for (const step of task.steps) {
      if (step.when && !dataAt(step.when)) continue;
      const el = findControl(step, root);
      if (!el || el.disabled || el.readOnly) return null;
      let value = step.data ? dataAt(step.data) : step.value;
      if (step.data && value == null) throw new Error(`Missing data: ${step.data}`);
      if (step.format === 'month_number') value = String(Number(String(value).split('-')[1]));
      else if (step.format === 'year') value = String(value).split('-')[0];
      if (!['fill', 'select', 'check', 'upload'].includes(step.action)) throw new Error(`Unsupported field action: ${step.action}. Put navigation in open/save mappings.`);
      if (step.action !== 'upload' && value == null) throw new Error('Field mapping needs data or value.');
      if (step.action !== 'upload' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)) throw new Error('Field mapping needs a native input, textarea, or select.');
      if (step.action === 'select' && el.tagName !== 'SELECT') throw new Error('Select mapping needs a select element.');
      if (step.action === 'check' && !['checkbox', 'radio'].includes(el.type)) throw new Error('Check mapping needs a checkbox or radio input.');
      if (step.action === 'fill' && ['file', 'checkbox', 'radio'].includes(el.type)) throw new Error('Use upload/check for this field type.');
      if (step.action === 'upload' && (el.tagName !== 'INPUT' || el.type !== 'file')) throw new Error('Upload mapping needs a file input.');
      if (step.action === 'select') {
        const options = [...el.options].filter(option => option.value === String(value) || normalize(option.textContent) === normalize(value));
        const option = one(options, 'select option');
        if (!option) throw new Error(`Select option does not exist: ${value}`);
        value = option.value;
      }
      plan.push({ step, el, value });
    }
    return { root, plan };
  }
  async function applyFields(plan) {
    for (const { step, el, value } of plan) {
      check();
      if (step.action === 'check') {
        if (el.checked !== Boolean(value)) el.click();
      } else if (step.action === 'upload') {
        const bytes = Uint8Array.from(atob(payload.resume), c => c.charCodeAt(0));
        const transfer = new DataTransfer();
        transfer.items.add(new File([bytes], payload.filename, { type: 'application/pdf' }));
        el.files = transfer.files;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      } else {
        const prototype = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : el.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
        Object.getOwnPropertyDescriptor(prototype, 'value').set.call(el, String(value));
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        el.dispatchEvent(new Event('blur', { bubbles: true }));
      }
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }
  async function runTask(task, index) {
    status.textContent = `${index + 1}/${payload.tasks.length}: opening ${task.name}`;
    if (!task.open) throw new Error(`Task ${task.name} needs an open mapping for automatic execution.`);
    if (openedTask !== index) {
      const button = await waitFor(() => openControl(task.open), `the opener for ${task.name}`);
      if (button.disabled) throw new Error('Edit control is disabled.');
      button.scrollIntoView({ block: 'center' });
      if (!(button.tagName === 'INPUT' && button.type === 'file')) button.click();
      openedTask = index;
    }
    status.textContent = `${index + 1}/${payload.tasks.length}: filling ${task.name}`;
    if (task.prepare?.length) {
      const prepared = await waitFor(() => planSteps({ ...task, steps: task.prepare }), `form setup for ${task.name}`);
      await applyFields(prepared.plan);
    }
    const { root, plan } = await waitFor(() => planSteps(task), `all fields for ${task.name}`);
    // Validate every field and the save mapping before changing this task.
    if (!task.save && !task.complete) throw new Error('Task needs save or complete mapping.');
    if (task.save && !findControl(task.save, root)) throw new Error('Save control not found.');
    const completionScope = task.complete?.scope_selector ? document.querySelector(task.complete.scope_selector) : task.complete?.section ? section(task.complete) : root;
    let completionChanged = false;
    const observer = new MutationObserver(records => {
      if (records.some(record => !panel.contains(record.target) && (completionScope?.contains(record.target) || [...record.removedNodes].includes(completionScope)))) completionChanged = true;
    });
    observer.observe(document.body, { subtree: true, childList: true, characterData: true });
    try {
      await applyFields(plan);
      let save;
      if (task.save) {
        save = await waitFor(() => {
          const control = findControl(task.save, root);
          return control && !control.disabled ? control : null;
        }, 'enabled Save control');
        check();
        save.click();
      }
      status.textContent = `${index + 1}/${payload.tasks.length}: waiting for ${task.name} to finish saving`;
      await waitFor(() => {
        const errors = [...root.querySelectorAll('[role=alert],[aria-invalid=true]')].filter(el => visible(el) && (el.getAttribute('aria-invalid') === 'true' || /error|invalid|required|unable|failed|must\b/i.test(el.textContent)));
        if (errors.length) throw new Error(`JobStreet rejected ${task.name}: ${errors.map(el => el.textContent || 'invalid field').join('; ')}`);
        if (task.complete) {
        const scope = task.complete.scope_selector ? document.querySelector(task.complete.scope_selector) : task.complete.section ? section(task.complete) : document;
          if (!scope) return false;
          if (task.complete.selector) return Boolean(findControl(task.complete, scope));
          const expected = task.complete.text === '$filename' ? payload.filename : task.complete.text;
          if (!expected) throw new Error('Completion mapping needs selector or text.');
          const content = (scope === document ? document.body : scope).textContent;
          return completionChanged && normalize(content.replace(panel.textContent, '')).includes(normalize(expected)) && !scope.querySelector('[aria-busy=true],[role=progressbar]');
        }
        return !save.isConnected || !visible(save);
      }, `save completion for ${task.name}`);
      if (task.after) {
        const button = await waitFor(() => findControl(task.after, root), `completion button for ${task.name}`);
        button.click();
        await waitFor(() => !visible(button), `closing ${task.name}`);
      }
      openedTask = -1;
    } finally { observer.disconnect(); }
  }
  async function runSequence() {
    if (panel.dataset.running === 'true') return;
    stopped = false;
    panel.dataset.running = 'true';
    panel.dataset.state = 'running';
    retry.disabled = true;
    close.disabled = true;
    stop.disabled = false;
    try {
      for (; next < payload.tasks.length; next++) {
        rows[next].textContent = `Running: ${payload.tasks[next].name}`;
        await runTask(payload.tasks[next], next);
        rows[next].textContent = `Saved: ${payload.tasks[next].name}`;
      }
      status.textContent = 'Sequence completed. All configured tasks saved.';
      panel.dataset.state = 'complete';
    } catch (error) {
      status.textContent = `${error.message} Completed ${next}/${payload.tasks.length}. Later tasks were not run. Fix this form/mapping before retrying.`;
      panel.dataset.state = 'stopped';
      retry.disabled = false;
    } finally {
      panel.dataset.running = 'false';
      close.disabled = false;
      stop.disabled = true;
    }
  }
  stop.onclick = () => { stopped = true; status.textContent = 'Stopping after the current browser action…'; };
  close.onclick = () => { if (panel.dataset.running !== 'true') panel.remove(); };
  retry.onclick = runSequence;
  // Pasting the helper starts the whole queue, without per-task clicks.
  void runSequence();
}
module.exports = { browserHelper };
