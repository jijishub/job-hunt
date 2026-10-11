const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { hasIcon, codexCommand, downloadIcon, runJob } = require('./company_icons.cjs');

function fixture(t, rows) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'company-icons-test-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const attempts = [];
  const sql = async (strings, ...values) => {
    const query = strings.join('?');
    if (query.startsWith('SELECT')) return structuredClone(rows);
    assert.match(query, /UPDATE companies SET logo_url/);
    assert.match(query, /website IS NOT DISTINCT FROM/);
    assert.match(query, /logo_url IS NULL OR btrim\(logo_url\) = ''/);
    const [icon, id, name, website] = values;
    attempts.push(id);
    const row = rows.find(row => row.id === id && row.name === name && row.website === website && !hasIcon(row));
    if (!row) return [];
    row.logo_url = icon;
    return [{ id, logo_url: icon }];
  };
  return { directory, sql, attempts, log: () => {} };
}

const company = (id, logo_url = null) => ({ id, name: `Company ${id}`, website: null, industry: 'IT', logo_url });
const found = id => ({ id, status: 'found', source_url: 'https://company.example/logo.png', source_page: 'https://company.example/', reason: 'Official company logo.' });
const icon = 'data:image/webp;base64,validated-test-image';

test('preview lists only missing icons and never researches or writes', async t => {
  const f = fixture(t, [company('existing', 'emoji:flower'), company('empty', ''), company('space', '  '), company('null')]);
  const summary = await runJob({ ...f, dryRun: true, research: () => assert.fail('Preview must not start Codex') });
  assert.equal(summary.missing, 3);
  assert.equal(summary.updated, 0);
  assert.equal(f.attempts.length, 0);
  assert.equal(fs.existsSync(path.join(f.directory, 'backup.json')), false);
});

test('existing icons are excluded; raced icons and changed identities are preserved', async t => {
  const rows = [company('existing', 'custom-logo'), company('new'), company('raced'), company('renamed'), company('unknown')];
  const f = fixture(t, rows);
  const summary = await runJob({ ...f, download: async () => icon, research: async batch => {
    assert.deepEqual(batch.map(row => row.id), ['new', 'raced', 'renamed', 'unknown']);
    rows[2].logo_url = 'user-uploaded-during-research';
    rows[3].name = 'Different company now';
    return [found('new'), found('raced'), found('renamed'), { id: 'unknown', status: 'skipped', reason: 'Identity ambiguous.' }];
  } });
  assert.equal(rows[0].logo_url, 'custom-logo');
  assert.equal(rows[1].logo_url, icon);
  assert.equal(rows[2].logo_url, 'user-uploaded-during-research');
  assert.equal(rows[3].logo_url, null);
  assert.equal(rows[4].logo_url, null);
  assert.deepEqual(summary, { missing: 4, updated: 1, skipped: 3, failed: 0 });
  const backup = JSON.parse(fs.readFileSync(path.join(f.directory, 'backup.json'), 'utf8'));
  assert.equal(backup[1].logo_url, null);
  const results = JSON.parse(fs.readFileSync(path.join(f.directory, 'results.json'), 'utf8'));
  assert.equal(results[0].source_page, 'https://company.example/');
});

test('unknown or duplicate research IDs stop the batch before any mutation', async t => {
  for (const sources of [[found('other')], [found('new'), found('new')]]) {
    const f = fixture(t, [company('new')]);
    await assert.rejects(runJob({ ...f, research: async () => sources, download: () => assert.fail('Must not download') }), /unknown or duplicate/);
    assert.equal(f.attempts.length, 0);
  }
});

test('an invalid source is reported; other verified companies can complete', async t => {
  const f = fixture(t, [company('bad'), company('good')]);
  const summary = await runJob({ ...f, research: async () => [{ ...found('bad'), source_url: 'http://localhost/logo.png' }, found('good')], download: async () => icon });
  assert.deepEqual(f.attempts, ['good']);
  assert.equal(summary.failed, 1);
  assert.equal(summary.updated, 1);
});

test('downloads must decode as images and are stored as compact WebP data', async () => {
  const sharp = require('sharp');
  const png = await sharp({ create: { width: 400, height: 100, channels: 4, background: '#FF7AB3' } }).png().toBuffer();
  const logo = await downloadIcon('https://company.example/logo.png', async () => new Response(png));
  assert.match(logo, /^data:image\/webp;base64,/);
  const metadata = await sharp(Buffer.from(logo.split(',')[1], 'base64')).metadata();
  assert.equal(metadata.format, 'webp');
  assert.equal(metadata.width, 256);
  await assert.rejects(downloadIcon('https://company.example/error.html', async () => new Response('<html>Error</html>')), /unsupported image format/i);
  await assert.rejects(downloadIcon('https://company.example/big.png', async () => new Response('', { headers: { 'content-length': '9000000' } })), /exceeds 8 MB/);
});

test('Codex launch uses live search, a read-only session, structured output and the project path', () => {
  const args = codexCommand('C:\\Example\\Folder With Spaces');
  assert.ok(args.includes('--search'));
  assert.equal(args[args.indexOf('--sandbox') + 1], 'read-only');
  assert.equal(args[args.indexOf('-a') + 1], 'never');
  assert.ok(args.includes('--output-schema'));
  assert.equal(args.at(-1), '-');
});
