const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { ROOT, prepare } = require('./jobstreet_resume.cjs');
const { thinkingMachinesHelper } = require('./thinkingmachines_browser.cjs');
const CONFIG_PATH = path.join(ROOT, 'references/thinkingmachines_rpa.json');

function calendarDate(month) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month || '')) throw new Error(`Invalid resume month: ${month}`);
  return `${month}-01`;
}
function buildApplication(resume, config) {
  const profile = resume.profile;
  const parts = profile.personal.name.split(/\s+/);
  const education = profile.education[0];
  const workSummaries = profile.experience.map(entry => {
    const summary = config.work_summaries?.[entry.title] || entry.description;
    if (summary.length > 255) throw new Error(`Work summary for ${entry.title} exceeds Freshteam's 255-character limit. Add a shorter work_summaries entry to the Thinking Machines config.`);
    return summary;
  });
  return {
    schema_version: 1,
    source: resume.source,
    target_url: config.target_url,
    personal_information: { first_name: parts[0], middle_name: parts.slice(1, -1).join(' '), last_name: parts.at(-1), email: profile.personal.email, mobile: profile.personal.phone },
    education_highlights: [{ degree: education.qualification, field_of_study: 'Information Technology', institution_or_school_name: education.institution, start_date: calendarDate(`${education.start_year}-${config.education_start_month}`), end_date: calendarDate(`${education.end_year}-${config.education_end_month}`), currently_pursuing: false, grade: 'Cum Laude; GPA 1.35' }],
    work_experience_highlights: profile.experience.map((entry, index) => ({ designation: entry.title, company_or_business_name: entry.company, start_date: calendarDate(entry.start_date), end_date: entry.end_date ? calendarDate(entry.end_date) : null, currently_work_here: entry.current, summary: workSummaries[index] })),
    work_samples: config.portfolio_url,
    application_questions: config.application_questions,
    agreements: config.agreements,
    date_convention: config.date_convention,
  };
}
async function prepareApplication() {
  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  const { data: resume } = await prepare('technical');
  const data = buildApplication(resume, config);
  const dir = path.join(ROOT, '.data/thinkingmachines');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'application.json'), JSON.stringify(data, null, 2) + '\n');
  const bytes = fs.readFileSync(path.join(ROOT, data.source.path));
  const helper = `(${thinkingMachinesHelper.toString()})(${JSON.stringify({ data, resume: bytes.toString('base64'), filename: path.basename(data.source.path) })});\n`;
  const helperPath = path.join(dir, 'helper.js');
  fs.writeFileSync(helperPath, helper);
  return { data, helperPath };
}
async function main() {
  const args = process.argv.slice(2);
  if (args.some(arg => arg !== '--prepare')) throw new Error('Only --prepare is supported.');
  const { data, helperPath } = await prepareApplication();
  console.log('Refreshed .data/thinkingmachines/application.json and helper.js from the active resume.');
  if (args.includes('--prepare')) return;
  if (process.platform === 'win32') {
    const command = 'Set-Clipboard -Value ([System.IO.File]::ReadAllText($env:THINKINGMACHINES_HELPER)); Start-Process $env:THINKINGMACHINES_URL';
    const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], { env: { ...process.env, THINKINGMACHINES_HELPER: helperPath, THINKINGMACHINES_URL: data.target_url }, encoding: 'utf8' });
    if (result.error || result.status !== 0) throw new Error(result.error?.message || result.stderr);
    console.log('Helper copied; application opened in your main browser.');
  }
  console.log('F12 > Console > paste > Enter. The helper uploads your resume and fills the application in order. Review answers/dates, accept the privacy statement yourself, complete CAPTCHA if present, and submit manually.');
}
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { calendarDate, buildApplication, prepareApplication };
