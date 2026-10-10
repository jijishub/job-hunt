const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { prepare, parseResume } = require('./jobstreet_resume.cjs');
const { executeStep, expandTasks } = require('./jobstreet_sync.cjs');

test('both active PDFs extract current roles and retain variant differences', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jobstreet-test-'));
  try {
    const technical = await prepare('technical', dir);
    const business = await prepare('business', dir);
    assert.equal(technical.data.profile.experience.length, 4);
    assert.equal(technical.data.profile.personal.first_name, 'Jizelle D.');
    assert.equal(technical.data.profile.personal.last_name, 'Casia');
    const roles = technical.data.profile.experience;
    assert.equal(roles[0].company, 'GDS CAPITAL, INC.');
    assert.equal(roles[1].company, roles[0].company);
    assert.equal(roles[0].start_date, '2026-07');
    assert.equal(roles[2].end_date, '2026-06');
    assert.equal(roles[3].current, true);
    assert.equal(roles[3].end_date, null);
    assert.notEqual(roles[3].description, business.data.profile.experience[3].description);
    assert.equal((await prepare('technical', dir)).changed, false);
    fs.writeFileSync(technical.file, JSON.stringify({ ...technical.data, source: { ...technical.data.source, path: 'old/location.pdf' } }));
    const relocated = await prepare('technical', dir);
    assert.equal(relocated.changed, true);
    assert.equal(relocated.data.source.path, technical.data.source.path);
    const stale = { ...technical.data, source: { ...technical.data.source, sha256: 'old' } };
    fs.writeFileSync(technical.file, JSON.stringify(stale));
    assert.equal((await prepare('technical', dir)).changed, true);
    assert.equal(JSON.parse(fs.readFileSync(`${technical.file}.previous`)).source.sha256, 'old');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
test('unknown resume structure fails rather than producing stale profile data', () => {
  assert.throws(() => parseResume('Different resume layout'), /missing Experience/);
});
test('repeated mapping binds each role to its own data', () => {
  const tasks = expandTasks([{ name: 'Role', for_each: 'profile.experience', open: { match_data: ['profile.experience.$index.title'] }, steps: [{ data: 'profile.experience.$index.title' }] }], { profile: { experience: [{ title: 'A' }, { title: 'B' }] } });
  assert.equal(tasks[1].steps[0].data, 'profile.experience.1.title');
  assert.equal(tasks[1].open.match_data[0], 'profile.experience.1.title');
});
test('browser automation rejects off-site and ambiguous controls', async () => {
  await assert.rejects(executeStep({ url: () => 'https://example.com' }, { action: 'upload' }, {}), /outside JobStreet/);
  let mutated = false;
  const page = { url: () => 'https://ph.jobstreet.com/profile/me', getByLabel: () => ({ count: async () => 2, fill: async () => { mutated = true; } }) };
  await assert.rejects(executeStep(page, { action: 'fill', label: 'Name', value: 'Test' }, {}), /Expected one field/);
  assert.equal(mutated, false);
});
