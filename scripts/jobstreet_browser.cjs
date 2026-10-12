const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { ROOT } = require('./jobstreet_resume.cjs');

const { browserHelper } = require('./jobstreet_sequence.cjs');

function createHelper(data, tasks) {
  const bytes = fs.readFileSync(path.join(ROOT, data.source.path));
  const payload = { data, tasks, resume: bytes.toString('base64'), filename: path.basename(data.source.path) };
  return `(${browserHelper.toString()})(${JSON.stringify(payload)});\n`;
}
function launchInMainBrowser(data, tasks) {
  const output = path.join(ROOT, '.data/jobstreet/helper.js');
  fs.writeFileSync(output, createHelper(data, tasks));
  if (process.platform === 'win32') {
    const script = "Set-Clipboard -Value ([System.IO.File]::ReadAllText($env:JOBSTREET_HELPER_PATH)); Start-Process 'https://ph.jobstreet.com/profile/me'";
    const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { env: { ...process.env, JOBSTREET_HELPER_PATH: output }, encoding: 'utf8' });
    if (result.error || result.status !== 0) throw new Error(`Could not copy helper/open browser. Helper is at ${output}. ${result.error?.message || result.stderr}`);
    console.log('Helper copied to clipboard. JobStreet opened in your default browser using its existing session.');
  }
  console.log(`In the signed-in JobStreet tab: press F12, select Console, paste the helper, and press Enter.\nThe helper automatically opens, fills, and saves each configured task in order. It stops at the first missing mapping or save error.\nIf Chrome blocks pasting, follow its console prompt only after reviewing ${output}.\nRerun npm run rpa:jobstreet after changing your resume or mappings, then paste the fresh helper.`);
}
module.exports = { browserHelper, createHelper, launchInMainBrowser };
