const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const Module = require('node:module');
const ts = require('typescript');
const { PGlite } = require('@electric-sql/pglite');
const root = path.resolve(__dirname, '..');

function loader(overrides = {}) {
  const cache = new Map();
  function load(file) {
    const full = path.resolve(root, file);
    if (cache.has(full)) return cache.get(full).exports;
    const m = new Module(full, module);
    m.filename = full;
    m.paths = Module._nodeModulePaths(path.dirname(full));
    cache.set(full, m);
    const original = m.require.bind(m);
    m.require = id => {
      if (Object.hasOwn(overrides, id)) return overrides[id];
      const target = id.startsWith('@/') ? path.join(root, 'src', id.slice(2)) + '.ts'
        : id.startsWith('.') ? path.resolve(path.dirname(full), id) + '.ts' : null;
      if (target && Object.hasOwn(overrides, target)) return overrides[target];
      return target && fs.existsSync(target) ? load(target) : original(id);
    };
    m._compile(ts.transpileModule(fs.readFileSync(full, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    }).outputText, full);
    return m.exports;
  }
  return load;
}

const user = { id: 'member', email: 'member@example.com', role: 'member' };
const sample = (extra = {}) => ({ company_id: null, company_name: 'Example', role_title: 'Engineer',
  owner: 'member', priority: 'MEDIUM', status: 'LEAD', notion_status: 'Not started',
  job_type: null, work_model: null, salary_currency: null, sync_status: 'PENDING',
  information: 'Build reliable software using TypeScript and SQL databases.', ...extra });
const analysis = { fit: 'STRONG', explanation: 'Relevant evidence', strengths: ['SQL'], gaps: [], analyzed_at: new Date().toISOString() };

test('capture v1 composition matches shared golden fixtures and counts full UTF-16 input', () => {
  const { composeCaptureRequirements } = loader()('src/lib/capture-requirements.ts');
  const fixtures = require('../contracts/capture-requirements.v1.fixtures.json');
  for (const fixture of fixtures) assert.equal(composeCaptureRequirements(fixture.posting), fixture.expected, fixture.name);
  const atLimit = 'x'.repeat(30000);
  assert.equal(composeCaptureRequirements({ description: atLimit }).length, 30000);
  assert.equal(composeCaptureRequirements({ description: atLimit + '😀' }).length, 30002);
  assert.ok(composeCaptureRequirements({ description: atLimit, qualifications: ['Additional requirement'] }).length > 30000);
});

async function exerciseStorage(db) {
  for (const status of ['LEAD', 'APPLIED']) {
    const app = await db.createApplication(sample({ status }));
    assert.equal(app.record_version, 1);
    const saved = await db.getApplicationById(app.id, user);
    for (const field of ['job_type', 'work_model', 'salary_currency']) assert.equal(saved[field], null);
    const edit = await db.updateApplication(app.id, { notes: 'Reviewed', record_version: 999 });
    assert.equal(Number(edit.record_version), 2);
    assert.equal(await db.saveRoleFitIfCurrent(saved, analysis), null);
    const assessed = await db.saveRoleFitIfCurrent(edit, analysis);
    assert.equal(assessed.role_fit, 'STRONG');
    assert.equal(assessed.priority, 'HIGH');
    assert.equal(Number(assessed.record_version), 3);
    assert.equal(await db.saveRoleFitIfCurrent(edit, analysis), null, 'another assessment won the revision');
    const manual = await db.updateApplication(app.id, { role_fit: 'WEAK', role_fit_source: 'manual', priority: 'DREAM' });
    assert.equal(await db.saveRoleFitIfCurrent(assessed, analysis), null);
    assert.equal((await db.getApplicationById(app.id, user)).priority, 'DREAM');
    // A forced assessment may replace the original manual rating, but not a newer edit.
    const revised = await db.updateApplication(app.id, { information: 'Different requirements now need Java and Kotlin experience.' });
    assert.equal(await db.saveRoleFitIfCurrent(manual, analysis), null);
    const moved = await db.updateApplication(app.id, { status: status === 'LEAD' ? 'APPLIED' : 'LEAD' });
    assert.equal(Number(moved.record_version), Number(revised.record_version) + 1);
    assert.equal(await db.saveRoleFitIfCurrent(revised, analysis), null, 'promotion/demotion invalidates previous input');
    assert.ok(await db.saveRoleFitIfCurrent(moved, analysis), 'new snapshot works after a store transition');
    const beforeDelete = await db.getApplicationById(app.id, user);
    await db.deleteApplication(app.id);
    assert.equal(await db.saveRoleFitIfCurrent(beforeDelete, analysis), null);
  }
}

test('local storage preserves unknowns and refuses stale AI writes across edits and promotion', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jobhunt-capture-'));
  try {
    // Redirect the database file without changing cwd or inheriting configured services.
    const wrappedPath = { ...path, join: (...parts) => parts[0] === process.cwd() && parts[1] === '.data' ? dir
      : path.join(...parts), resolve: (...parts) => parts.length === 1 && parts[0] === process.env.DB_LOCAL_DIR ? dir : path.resolve(...parts) };
    const db = loader({ path: wrappedPath,
      [path.join(root, 'src/lib/database.ts')]: { getDatabaseClient: () => null } })('src/lib/db.ts');
    await exerciseStorage(db);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('real PostgreSQL migration, unknown values, atomic assessment writes, and legacy revisions', async () => {
  const pg = new PGlite();
  try {
    const sql = (strings, ...values) => {
      const text = strings.reduce((s, part, i) => s + (i ? '$' + i : '') + part, '');
      return { text, values, then: (resolve, reject) => pg.query(text, values).then(result => result.rows).then(resolve, reject) };
    };
    sql.transaction = queries => pg.transaction(async tx => {
      const rows = [];
      for (const query of queries) rows.push((await tx.query(query.text, query.values)).rows);
      return rows;
    });
    let completeAI, notifyStarted;
    const started = new Promise(resolve => { notifyStarted = resolve; });
    const output = new Promise(resolve => { completeAI = resolve; });
    const load = loader({ [path.join(root, 'src/lib/database.ts')]: { getDatabaseClient: () => sql },
      '@/lib/session-account': { getSessionAccount: async () => user },
      '@/lib/ai': { callGeminiJSON: () => { notifyStarted(); return output; } } });
    const db = load('src/lib/db.ts');
    await db.migrateDatabase();
    const known = await db.createApplication(sample({ status: 'APPLIED', job_type: 'CONTRACT', work_model: 'REMOTE', salary_currency: 'EUR' }));
    // Simulate the installed schema from before this change, then upgrade it.
    await pg.exec("ALTER TABLE applications ALTER COLUMN job_type SET NOT NULL; ALTER TABLE applications ALTER COLUMN work_model SET NOT NULL; ALTER TABLE applications ALTER COLUMN salary_currency SET DEFAULT 'PHP'; ALTER TABLE applications DROP COLUMN record_version;");
    await loader({ [path.join(root, 'src/lib/database.ts')]: { getDatabaseClient: () => sql } })('src/lib/db.ts').migrateDatabase();
    const upgraded = await db.getApplicationById(known.id, user);
    assert.equal(Number(upgraded.record_version), 0);
    assert.equal(upgraded.job_type, 'CONTRACT'); assert.equal(upgraded.work_model, 'REMOTE'); assert.equal(upgraded.salary_currency, 'EUR');
    assert.ok(await db.updateApplication(known.id, { job_type: null, work_model: null, salary_currency: null }));
    await db.deleteApplication(known.id);
    await exerciseStorage(db);
    await db.saveCandidateProfile(user.id, 'Saved TypeScript and SQL experience');
    const inFlight = await db.createApplication(sample());
    const route = load('src/app/api/role-fit/route.ts');
    const pending = route.POST(new Request('http://local/api/role-fit', { method: 'POST', body: JSON.stringify({ id: inFlight.id }) }));
    await started;
    await db.updateApplication(inFlight.id, { role_fit: 'WEAK', role_fit_source: 'manual', priority: 'DREAM' });
    completeAI(analysis);
    assert.equal((await pending).status, 409, 'manual edit while AI is running wins atomically');
    assert.equal((await db.getApplicationById(inFlight.id, user)).role_fit_source, 'manual');
    // Leads captured before revision support remain writable from revision zero.
    const legacy = { ...sample(), id: 'legacy', created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    await pg.query('INSERT INTO leads (id,data) VALUES ($1,$2)', ['legacy', JSON.stringify(legacy)]);
    assert.equal(Number((await db.saveRoleFitIfCurrent(legacy, analysis)).record_version), 1);
    const current = await db.getApplicationById('legacy', user);
    assert.equal(await db.saveRoleFitIfCurrent({ ...current, owner: 'other' }, analysis), null);
    const [one, two] = await Promise.all([db.saveRoleFitIfCurrent(current, analysis), db.saveRoleFitIfCurrent(current, analysis)]);
    assert.equal([one, two].filter(Boolean).length, 1);
  } finally { await pg.close(); }
});

test('import and create API keep unspecified facts unknown, while explicit values survive', async () => {
  let saved;
  const load = loader({ '@/lib/session-account': { getSessionAccount: async () => user },
    '@/lib/db': { getCandidatePreferences: async () => null, getCompanies: async () => [],
      createApplication: async value => (saved = value) } });
  const parse = load('src/lib/job-import.ts').parseJobImport;
  const route = load('src/app/api/applications/route.ts');
  for (const posting of [sample(), { role_title: 'Engineer', company_name: 'Example', description: sample().information }]) {
    const job = parse(JSON.stringify(posting));
    for (const field of ['job_type', 'work_model', 'salary_currency']) assert.equal(job[field], null);
    const response = await route.POST(new Request('http://local/api/applications', { method: 'POST', body: JSON.stringify(job) }));
    assert.equal(response.status, 201);
    for (const field of ['job_type', 'work_model', 'salary_currency']) assert.equal(saved[field], null);
    assert.equal(saved.status, 'LEAD');
    assert.equal(saved.date_applied, undefined);
    assert.equal(saved.first_response_at, undefined);
  }
  const job = parse(JSON.stringify({ role_title: 'Engineer', work_model: 'REMOTE', job_type: 'CONTRACT', salary_currency: 'eur' }));
  assert.equal(job.work_model, 'REMOTE'); assert.equal(job.job_type, 'CONTRACT'); assert.equal(job.salary_currency, 'EUR');
  assert.match(load('src/lib/currencies.ts').formatSalaryRange(1000, undefined, null), /Currency unknown/);
});

test('role-fit route reports a stale result without claiming the assessment was saved', async () => {
  const app = { ...sample(), id: 'role', record_version: 1 };
  const route = loader({ '@/lib/session-account': { getSessionAccount: async () => user },
    '@/lib/db': { getApplicationById: async () => app, getCandidateProfile: async () => 'Saved resume',
      getCandidatePreferences: async () => null, saveRoleFitIfCurrent: async () => null },
    '@/lib/ai': { callGeminiJSON: async () => analysis } })('src/app/api/role-fit/route.ts');
  const response = await route.POST(new Request('http://local/api/role-fit', { method: 'POST', body: JSON.stringify({ id: 'role' }) }));
  assert.equal(response.status, 409);
  const body = await response.json();
  assert.equal(body.code, 'STALE_ASSESSMENT'); assert.equal(body.success, false);
});
