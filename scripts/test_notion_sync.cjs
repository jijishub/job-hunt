const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const adminApp = { id: 'app_bytedance', company_name: 'ByteDance',
  role_title: 'Graduate Development Program (E-commerce, Philippines) - 2027 Start',
  status: 'APPLIED', owner: 'user_ji', sync_status: 'ERROR', notion_page_id: 'page-existing' };
let records = [];
let calls = [];
let failWrites = false;
const db = {
  getUsers: async () => [{ id: 'user_ji', role: 'admin', notion_enabled: true }],
  getCompanies: async () => [],
  getApplications: async (includeLeads = true) => records.filter((app) => includeLeads || app.status !== 'LEAD'),
  updateApplication: async (id, updates) => {
    const record = records.find((app) => app.id === id);
    Object.assign(record, updates);
    return record;
  },
  getOrCreateCompany: async () => ({ id: 'company-byte', name: 'ByteDance' }),
};
async function write(body) {
  calls.push(body);
  assert.ok(!body.properties['Intern Position'].select.name.includes(','));
  if (failWrites) throw new Error('Simulated Notion validation failure');
  return { id: 'page-existing' };
}
class Client {
  pages = { create: write, update: write };
  databases = { retrieve: async () => ({ data_sources: [{ id: 'source' }] }) };
  dataSources = { query: async () => ({ results: [{ id: 'page-existing', properties: {
    'Company Name': { title: [{ plain_text: 'ByteDance' }] },
    'Intern Position': { select: { name: 'Old role from Notion' } },
  } }] }) };
}
const moduleObject = { exports: {} };
const compiled = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/lib/notion.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
vm.runInNewContext(compiled, {
  exports: moduleObject.exports, module: moduleObject, process: { env: {} },
  console: { ...console, error: () => {} },
  require: (name) => name === '@notionhq/client' ? { Client }
    : name === './db' ? db : name === './statuses' ? { getStatusCategory: () => 'APPLIED' } : require(name),
});
async function run() {
  records = [{ ...adminApp }, { ...adminApp, id: 'member-app', owner: 'member_1' },
    { ...adminApp, id: 'saved-lead', status: 'LEAD' }];
  const result = await moduleObject.exports.performTwoWaySync();
  assert.equal(result.success, true);
  assert.equal(result.pushed, 1);
  assert.equal(calls.length, 1);
  assert.equal(records[0].role_title, adminApp.role_title, 'Pull must preserve failed local edits');
  assert.equal(records[0].sync_status, 'SYNCED');
  records[0].sync_status = 'ERROR';
  failWrites = true;
  const failed = await moduleObject.exports.performTwoWaySync();
  assert.equal(failed.success, false);
  assert.equal(failed.pushed, 0);
  assert.equal(failed.failed[0].id, adminApp.id);
  assert.equal(records[0].sync_status, 'ERROR');
  console.log('Notion sync: comma normalization, failed-write retry, pull protection, accurate counts and owner/lead exclusions passed');
}
run().catch((error) => { console.error(error); process.exitCode = 1; });
