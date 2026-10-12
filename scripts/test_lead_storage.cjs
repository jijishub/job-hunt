const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
let failReplacement = false;
const databaseFs = new Proxy(fs, {
  get(target, key) {
    if (key === 'renameSync') return (...args) => {
      if (failReplacement) throw new Error('Simulated replace failure');
      return fs.renameSync(...args);
    };
    return Reflect.get(target, key);
  },
});

// Run the actual database implementation with isolated local storage and no network.
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'jobhunt-leads-'));
const moduleObject = { exports: {} };
const source = fs.readFileSync(path.join(__dirname, '../src/lib/db.ts'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, esModuleInterop: true,
} }).outputText;
vm.runInNewContext(compiled, {
  exports: moduleObject.exports, module: moduleObject, console,
  process: { env: {}, cwd: () => directory },
  require: (name) => name === '@neondatabase/serverless'
    ? { neon: () => { throw new Error('Unexpected network access'); } }
    : name === 'fs' ? databaseFs
    : name === './admin-email' ? { getAdminEmail: () => 'jizelle.casia@gmail.com' } : require(name),
});
const db = moduleObject.exports;
async function run() {
  const lead = await db.createApplication({ company_name: 'Example', role_title: 'Engineer',
    status: 'LEAD', owner: 'member_1', priority: 'HIGH', job_type: 'FULL_TIME',
    work_model: 'REMOTE', salary_currency: 'USD', sync_status: 'PENDING' });
  const read = () => JSON.parse(fs.readFileSync(path.join(directory, '.data/db.json'), 'utf8'));
  assert.equal(read().applications.length, 0);
  assert.equal(read().leads[0].owner, 'member_1');
  await db.updateApplication(lead.id, { notes: 'Saved for later' });
  assert.equal((await db.getApplicationById(lead.id)).notes, 'Saved for later');
  assert.equal((await db.getApplications(false)).length, 0);
  await db.updateApplication(lead.id, { status: 'APPLIED' });
  assert.equal(read().leads.length, 0);
  assert.equal(read().applications[0].id, lead.id);
  assert.equal(read().applications[0].owner, 'member_1');
  await db.updateApplication(lead.id, { status: 'LEAD' });
  assert.equal(read().applications.length, 0);
  assert.equal(read().leads.length, 1);
  // Simulate a legacy database and verify migration preserves records.
  const legacy = read();
  legacy.applications = legacy.leads;
  delete legacy.leads;
  fs.writeFileSync(path.join(directory, '.data/db.json'), JSON.stringify(legacy));
  assert.equal((await db.getApplications()).length, 1);
  assert.equal(read().applications.length, 0);
  await db.deleteApplication(lead.id);
  assert.equal((await db.getApplications()).length, 0);
  const imported = { ...lead, id: 'notion_test', notion_page_id: 'ABC-123', notes: 'Original' };
  await db.createApplication(imported);
  await db.createApplication({ ...imported, id: 'other-id' });
  assert.equal((await db.getApplications()).length, 1, 'Same Notion page must not create another lead');
  const stored = read();
  stored.leads.push({ ...imported, id: 'historic-duplicate', notes: 'Older note', updated_at: '2020-01-01' });
  fs.writeFileSync(path.join(directory, '.data/db.json'), JSON.stringify(stored));
  assert.equal((await db.getApplications()).length, 1);
  assert.equal(read().duplicate_leads.length, 1);
  assert.equal(read().duplicate_leads[0].notes, 'Older note', 'Archived duplicate retains its data');
  const databasePath = path.join(directory, '.data/db.json');
  const beforeFailure = fs.readFileSync(databasePath, 'utf8');
  failReplacement = true;
  await assert.rejects(() => db.updateApplication(imported.id, { notes: 'Failed edit' }), /Simulated replace failure/);
  failReplacement = false;
  assert.equal(fs.readFileSync(databasePath, 'utf8'), beforeFailure, 'A failed write preserves the complete existing database');
  assert.equal(fs.readdirSync(path.dirname(databasePath)).some(file => file.endsWith('.tmp')), false, 'Failed write cleans up its temporary file');
  await db.updateApplication(imported.id, { notes: 'Successful edit' });
  assert.equal((await db.getApplicationById(imported.id)).notes, 'Successful edit');
  console.log('Lead storage: save, edit, promotion, demotion, migration, deletion passed');
}
run().catch((error) => { console.error(error); process.exitCode = 1; });
