// Local CLI only. Never import this into a Next.js route or deployed component.
const fs = require('node:fs');
const path = require('node:path');
const { launchInMainBrowser } = require('./jobstreet_browser.cjs');
const { ROOT, prepare } = require('./jobstreet_resume.cjs');

function resolveValue(data, key) {
  const value = key.split('.').reduce((obj, part) => obj?.[part], data);
  if (value === undefined || value === null) throw new Error(`Missing data path: ${key}`);
  return value;
}
function expandTasks(tasks, data) {
  return tasks.flatMap(task => {
    if (!task.for_each) return [task];
    const entries = resolveValue(data, task.for_each);
    if (!Array.isArray(entries)) throw new Error('for_each must reference an array.');
    return entries.map((entry, index) => {
      const expanded = JSON.parse(JSON.stringify(task).replaceAll('$index', String(index)));
      const entryId = task.open?.entry_ids?.[entry.title || entry.institution];
      if (entryId) expanded.open = { selector: `[id="${entryId}"]` };
      const expected = task.expected_by_entry?.[entry.title || entry.institution];
      if (expected) expanded.expected = JSON.parse(JSON.stringify(expected));
      return { ...expanded, name: `${task.name}: ${entry.title || entry.institution || entry}` };
    });
  });
}
async function executeStep(page, step, data) {
  if (new URL(page.url()).origin !== 'https://ph.jobstreet.com') throw new Error('Stopped: browser is outside JobStreet Philippines.');
  const locator = step.label ? page.getByLabel(step.label, { exact: true }) : page.locator(step.selector);
  if (await locator.count() !== 1) throw new Error(`Expected one field for ${step.label || step.selector}. Inspect the form and update the JSON mapping.`);
  const value = step.data ? resolveValue(data, step.data) : step.value;
  switch (step.action) {
    case 'fill': await locator.fill(String(value)); break;
    case 'select': await locator.selectOption(String(value)); break;
    case 'check': await locator.setChecked(Boolean(value)); break;
    case 'upload': await locator.setInputFiles(path.join(ROOT, data.source.path)); break;
    case 'click': await locator.click(); break;
    default: throw new Error(`Unsupported action: ${step.action}`);
  }
}
async function main() {
  const args = process.argv.slice(2);
  const allowed = new Set(['--variant', '--browser', '--watch', '--recipe']);
  for (let i = 0; i < args.length; i++) {
    if (!allowed.has(args[i])) throw new Error(`Unknown option: ${args[i]}`);
    if (['--variant', '--recipe'].includes(args[i]) && !args[++i]) throw new Error('Missing option value.');
  }
  const variant = args.includes('--variant') ? args[args.indexOf('--variant') + 1] : 'technical';
  const result = await prepare(variant);
  console.log(`${result.changed ? 'Refreshed' : 'Unchanged'}: ${path.relative(ROOT, result.file)} (${result.data.profile.experience.length} roles)`);
  if (args.includes('--watch')) {
    if (args.includes('--browser')) throw new Error('Watch refreshes JSON only; run browser separately.');
    let busy = false;
    setInterval(async () => {
      if (busy) return;
      busy = true;
      try { const next = await prepare(variant); if (next.changed) console.log(`Resume changed; refreshed ${next.file}`); }
      catch (error) { console.error(error.message); }
      finally { busy = false; }
    }, 2000);
    console.log('Watching the selected resume. Ctrl+C to stop. No remote changes.');
    return;
  }
  if (!args.includes('--browser')) return;
  const recipePath = args.includes('--recipe') ? path.resolve(args[args.indexOf('--recipe') + 1]) : path.join(ROOT, 'references/jobstreet_rpa.json');
  const recipe = JSON.parse(fs.readFileSync(recipePath, 'utf8'));
  if (!Array.isArray(recipe.tasks)) throw new Error('Recipe must contain tasks.');
  launchInMainBrowser(result.data, expandTasks(recipe.tasks, result.data));
}
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { resolveValue, executeStep, expandTasks };
