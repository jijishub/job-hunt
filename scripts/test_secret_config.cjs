const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { test } = require('node:test');

function loadNotion(env) {
  const source = fs.readFileSync(path.join(__dirname, '../src/lib/notion.ts'), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const moduleObject = { exports: {} };
  let clients = 0;
  class Client { constructor() { clients++; } }
  vm.runInNewContext(compiled, {
    exports: moduleObject.exports, module: moduleObject, process: { env }, console,
    require: name => name === '@notionhq/client' ? { Client } : {},
  });
  return { exports: moduleObject.exports, clientCount: () => clients };
}

test('Notion has no credential fallback and makes no request without environment configuration', async () => {
  for (const env of [{}, { NOTION_API_KEY: 'test-key' }, { NOTION_DATABASE_ID: 'test-db' }]) {
    const notion = loadNotion(env);
    assert.equal(notion.exports.getNotionConfig().isConfigured, false);
    const result = await notion.exports.performTwoWaySync();
    assert.equal(result.success, false);
    assert.equal(notion.clientCount(), 0);
  }
  const configured = loadNotion({ NOTION_API_KEY: 'test-key', NOTION_DATABASE_ID: 'test-db' });
  assert.equal(configured.exports.getNotionConfig().isConfigured, true);
  assert.equal(configured.exports.getNotionConfig().databaseId, 'test-db');
  assert.ok(!configured.exports.getNotionConfig().apiKey.includes('test-key'));
});

test('Deployment examples contain no real provider key formats', () => {
  for (const file of ['DEPLOYMENT.md', '.env.example']) {
    const text = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
    assert.equal(/\b(?:ntn_[A-Za-z0-9_-]{24,}|gds_live_[A-Za-z0-9_-]{16,}|GOCSPX-[A-Za-z0-9_-]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{24,})\b/.test(text), false, `${file} contains a credential`);
  }
});
