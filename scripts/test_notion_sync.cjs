const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const adminApp = { id: 'app_bytedance', company_name: 'ByteDance',
  role_title: 'Graduate Development Program (E-commerce, Philippines) - 2027 Start',
  status: 'APPLIED', owner: 'user_ji', sync_status: 'ERROR', notion_page_id: 'page-existing',
  notes: 'N'.repeat(8350), date_applied: new Date('2026-10-09T00:00:00Z') };
let records = [];
let calls = [];
let failWrites = false;
let pages;
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
  createApplication: async (data) => {
    const existing = records.find((app) => app.id === data.id);
    if (existing) return existing;
    records.push(data);
    return data;
  },
};
async function write(body) {
  calls.push(body);
  assert.ok(!body.properties['Intern Position'].select.name.includes(','));
  const chunks = body.properties['Post Notes'].rich_text;
  assert.ok(chunks.every((chunk) => chunk.text.content.length <= 2000));
  assert.equal(chunks.map((chunk) => chunk.text.content).join(''), adminApp.notes);
  assert.equal(body.properties['Application/ Inquiry Date'].date.start, '2026-10-09');
  if (failWrites) throw new Error('Simulated Notion validation failure');
  return { id: 'page-existing' };
}
class Client {
  pages = { create: write, update: write };
  databases = { retrieve: async () => ({ data_sources: [{ id: 'source' }] }) };
  dataSources = { query: async () => ({ results: pages || [{ id: 'page-existing', properties: {
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
    : name === './db' ? db : name === './statuses' ? { getStatusCategory: (name) => name === 'Inquiry' ? 'LEAD' : 'APPLIED' } : require(name),
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
  for (const date of ['2026-10-09', '2026-10-09T00:00:00.000Z']) {
    records[0].date_applied = date;
    assert.equal(await moduleObject.exports.pushApplicationToNotion(records[0]), 'page-existing');
  }
  records[0].date_applied = 'invalid-date';
  let dateError;
  assert.equal(await moduleObject.exports.pushApplicationToNotion(records[0], (error) => { dateError = error; }), null);
  assert.ok(dateError.includes('Invalid application date'));
  records[0].date_applied = adminApp.date_applied;
  records[0].sync_status = 'ERROR';
  failWrites = true;
  const failed = await moduleObject.exports.performTwoWaySync();
  assert.equal(failed.success, false);
  assert.equal(failed.pushed, 0);
  assert.equal(failed.failed[0].id, adminApp.id);
  assert.equal(records[0].sync_status, 'ERROR');
  assert.ok(failed.message.includes('Simulated Notion validation failure'));
  pages = [{ id: 'page-lead', properties: {
    'Company Name': { title: [{ plain_text: 'Example' }] },
    'Application Status': { select: { name: 'Inquiry' } },
    'Post Notes': { rich_text: [{ plain_text: 'First part. ' }, { plain_text: 'Second part.' }] },
  } }];
  records = [];
  await moduleObject.exports.pullApplicationsFromNotion();
  await moduleObject.exports.pullApplicationsFromNotion();
  assert.equal(records.length, 1, 'Repeated pull must not duplicate a lead');
  assert.equal(records[0].notes, 'First part. Second part.', 'Pull must preserve all text chunks');
  console.log('Notion sync: comma normalization, failed-write retry, pull protection, accurate counts and owner/lead exclusions passed');
}
run().catch((error) => { console.error(error); process.exitCode = 1; });
