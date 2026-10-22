const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Module = require('node:module');
const { randomUUID } = require('node:crypto');
const ts = require('typescript');
const { PGlite } = require('@electric-sql/pglite');
const root = path.resolve(__dirname, '..');
function loader(overrides = {}) {
  const cache = new Map();
  function load(file) {
    const full = path.resolve(root, file);
    if (cache.has(full)) return cache.get(full).exports;
    const m = new Module(full, module);
    m.filename = full; m.paths = Module._nodeModulePaths(path.dirname(full)); cache.set(full, m);
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
const postingText = 'Requirements:\n- Build reliable TypeScript services with SQL databases.\n- Support customers and document production incidents.\n- Work with the team to test and deploy changes.';
function legacyCredentials() {
  return [
    { id: randomUUID(), owner: 'legacy', label: 'Working pilot', token_hash: 'legacy-working', scopes: ['captures:read'], created_at: '2020-01-01T00:00:00Z', expires_at: '2099-01-01T00:00:00Z', revoked_at: null },
    { id: randomUUID(), owner: 'legacy', label: 'Expired pilot', token_hash: 'legacy-expired', scopes: ['captures:read'], created_at: '2020-01-01T00:00:00Z', expires_at: '2020-01-02T00:00:00Z', revoked_at: null },
    { id: randomUUID(), owner: 'legacy', label: 'Revoked pilot', token_hash: 'legacy-revoked', scopes: ['captures:read'], created_at: '2020-01-01T00:00:00Z', expires_at: '2099-01-01T00:00:00Z', revoked_at: '2020-01-02T00:00:00Z' },
  ];
}
function assertMigratedCredentials(rows) {
  assert.equal(rows.find(c => c.token_hash === 'legacy-working').expires_at, null, 'working pilot pairing becomes non-expiring');
  assert.ok(rows.find(c => c.token_hash === 'legacy-expired').expires_at, 'expired credentials are not revived');
  assert.ok(rows.find(c => c.token_hash === 'legacy-revoked').revoked_at, 'revoked credentials stay revoked');
}
function fixture(extra = {}) {
  return { schema_version: 1, capture_id: randomUUID(), captured_at: '2026-10-18T06:00:00Z',
    posting: { role_title: 'Support Engineer', company_name: 'Example', description: postingText, qualifications: [],
      location: null, work_model: null, job_type: null, salary_min: null, salary_max: null, salary_currency: null,
      salary_period: null, salary_pay_period: null, job_url: 'https://job-boards.greenhouse.io/example/jobs/123',
      seniority_level: null, job_platform: 'GREENHOUSE', first_response_at: null },
    source: { method: 'dom', adapter_id: 'greenhouse-dom', adapter_version: '1', extractor_version: 'posting-pilot-v1',
      page_url: 'https://job-boards.greenhouse.io/example/jobs/123', candidate_index: 0, employer_key: 'job-boards.greenhouse.io/example', requisition_id: '123',
      variants: [{ id: 'rendered', method: 'dom', text: postingText }], field_provenance: { description: { method: 'dom', locator: '.job__description', variant_id: 'rendered' } },
      corrections: {}, warnings: [] }, review: { reviewed_at: '2026-10-18T06:05:00Z', resolutions: [] }, request_assessment: false, ...extra };
}
function request(body, token, extraHeaders = {}) {
  return new Request('http://local/api/v1/captures', { method: 'POST', headers: { 'Content-Type': 'application/json',
    'Idempotency-Key': body.capture_id, ...(token ? { Authorization: `Bearer ${token}` } : {}), ...extraHeaders }, body: JSON.stringify(body) });
}
function attachFit(body, validation, fit = 'STRONG') {
  body.extension_assessment = { schema_version: 1, assessment_id: randomUUID(), model: 'test-model', prompt_version: 'role-fit-v1',
    analyzed_at: '2026-10-18T06:05:00Z', posting_hash: validation.captureHash(body.posting),
    resume: { id: 'resume-a', label: 'Selected resume', sha256: 'a'.repeat(64) }, preferences_hash: null,
    result: { fit, explanation: 'Selected resume provides TypeScript and SQL evidence.', strengths: ['SQL services'], gaps: [], preference_alignment: 'UNKNOWN', preference_notes: '' } };
  return body;
}

test('capture validation checks nested facts, review, identity, source references, and disabled assessments', () => {
  const { validateCapture, normalizeCaptureSalaryPeriod } = loader()('src/lib/capture-validation.ts');
  const original = fixture();
  assert.deepEqual(validateCapture(original, original.capture_id).reasons, []);
  const extensionPrepared = require('../contracts/examples/capture-v1.extension.json');
  assert.deepEqual(validateCapture(extensionPrepared, extensionPrepared.capture_id).reasons, [], 'actual offline extension serializer fixture');
  const extensionFitExample = require('../contracts/examples/capture-v1.extension-fit.json');
  assert.equal(validateCapture(extensionFitExample, extensionFitExample.capture_id).extensionFit.fit, 'STRONG');
  const validation = loader()('src/lib/capture-validation.ts');
  const assessed = attachFit(fixture(), validation);
  assert.equal(validateCapture(assessed, assessed.capture_id).extensionFit.origin, 'extension');
  const badFits = [
    p => { p.posting.description += 'Changed after assessment.'; },
    p => { p.extension_assessment.resume.text = 'Do not upload the resume.'; },
    p => { p.extension_assessment.resume.sha256 = 'invalid'; },
    p => { p.extension_assessment.result.fit = 'INVENTED'; },
    p => { p.extension_assessment.result.explanation = 'x'.repeat(4001); },
    p => { p.extension_assessment.result.preference_alignment = 'ALIGNED'; },
    p => { p.review.reviewed_at = null; },
    p => { p.extension_assessment.model = ''; },
    p => { p.extension_assessment.prompt_version = 'unrecognized'; },
  ];
  for (const mutate of badFits) { const value = structuredClone(assessed); mutate(value); assert.throws(() => validateCapture(value, value.capture_id)); }
  assert.equal(normalizeCaptureSalaryPeriod('__proto__'), null);
  const mutations = [
    p => { p.owner = 'forged'; }, p => { p.posting.role_fit = 'STRONG'; },
    p => { p.posting.salary_max = -1; }, p => { p.posting.salary_min = 20; p.posting.salary_max = 10; },
    p => { p.posting.salary_currency = 'dollars'; }, p => { p.posting.work_model = 'INVENTED'; },
    p => { p.posting.seniority_level = 'SENIOR'; }, p => { p.posting.first_response_at = '2026-10-18T06:00:00Z'; },
    p => { p.source.structured_facts = { role_title: 'renamed' }; }, p => { p.source.structured_facts = { employmentType: null }; },
    p => { p.source.structured_facts = { salary_min: -1 }; }, p => { p.source.variants = []; },
    p => { p.source.variants[0].text = ' \r\n '; }, p => { p.source.variants.push(p.source.variants[0]); },
    p => { p.source.field_provenance.description.variant_id = 'missing'; },
    p => { p.source.corrections.owner = { method: 'user' }; }, p => { p.source.corrections.description = { method: 'page', updated_at: original.captured_at }; },
    p => { p.posting.job_platform = 'Referral'; }, p => { p.user_context = { application_channel: 'Walk-in', supplied_at: original.captured_at }; },
    p => { p.captured_at = '2026-02-30T06:00:00Z'; }, p => { p.source.candidate_index = -1; },
    p => { p.posting.job_url = 'https://user:secret@example.com/job'; }, p => { p.request_assessment = true; },
    p => { p.source.warnings = [{ id: 'one', code: 'conflicting_sources', field: 'company_name', message: 'Conflict' }]; p.review.resolutions = [{ warning_id: 'one', action: 'use_rendered', note: 'Pick it' }]; },
  ];
  for (const mutate of mutations) { const value = structuredClone(original); mutate(value); assert.throws(() => validateCapture(value, value.capture_id)); }
  assert.throws(() => validateCapture(original, randomUUID()));
  const facts = fixture(); facts.source.structured_facts = { title: 'Original', company: null, employmentType: ['Permanent'], salary_min: 20, salary_max: 10 };
  assert.ok(validateCapture(facts, facts.capture_id));
  const corrected = fixture(); corrected.source.warnings = [{ id: 'range', code: 'invalid_salary_range', field: 'salary_min', message: 'Reversed original' }];
  assert.throws(() => validateCapture(corrected, corrected.capture_id));
  corrected.source.corrections.salary_max = { method: 'user', updated_at: corrected.captured_at };
  corrected.review.resolutions = [{ warning_id: 'range', action: 'corrected', note: 'Cleared unknown amounts.' }];
  assert.ok(validateCapture(corrected, corrected.capture_id));
  const changedOrder = Object.fromEntries(Object.entries(original).reverse());
  assert.equal(validateCapture(changedOrder, original.capture_id).requestHash, validateCapture(original, original.capture_id).requestHash);
  const incomplete = fixture(); incomplete.posting.company_name = null;
  assert.ok(validateCapture(incomplete, incomplete.capture_id).reasons.includes('missing_company_name'));
  const conflict = fixture(); conflict.source.variants.push({ id: 'structured', method: 'jsonld', text: 'Different requirements' });
  assert.ok(validateCapture(conflict, conflict.capture_id).reasons.includes('conflicting_sources'));
});

test('capture JSON reader enforces actual UTF-8 stream bytes and rejects malformed or non-JSON data', async () => {
  const { readCaptureJson } = loader()('src/lib/capture-validation.ts');
  const body = fixture(); assert.deepEqual(await readCaptureJson(request(body)), body);
  const boundary = JSON.stringify({ text: 'x'.repeat(262144 - 11) });
  assert.equal(Buffer.byteLength(boundary), 262144);
  assert.equal((await readCaptureJson(new Request('http://local', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: boundary }))).text.length, 262144 - 11);
  for (const [raw, headers, code] of [
    ['{bad', { 'content-type': 'application/json' }, 'INVALID_JSON'],
    ['{}', { 'content-type': 'text/plain' }, 'JSON_REQUIRED'],
    [JSON.stringify({ text: '界'.repeat(90000) }), { 'content-type': 'application/json', 'content-length': '2' }, 'CAPTURE_TOO_LARGE'],
  ]) await assert.rejects(readCaptureJson(new Request('http://local', { method: 'POST', headers, body: raw })), error => error.code === code);
});

async function exercise(load, setSession, expire, inspect) {
  const db = load('src/lib/db.ts'), store = load('src/lib/capture-store.ts');
  const route = load('src/app/api/v1/captures/route.ts');
  const manage = load('src/app/api/extension-credentials/route.ts');
  const validation = load('src/lib/capture-validation.ts');
  const user = await db.getOrCreateUser({ name: 'Capture Test', email: 'capture-test@example.com' });
  const other = await db.getOrCreateUser({ name: 'Other', email: 'other-capture@example.com' });
  setSession(user);
  const createRequest = (origin = 'http://local') => new Request('http://local/api/extension-credentials', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ label: 'Pilot browser' }) });
  assert.equal((await manage.POST(createRequest('http://other'))).status, 403);
  setSession(null); assert.equal((await manage.POST(createRequest())).status, 401); setSession(user);
  const issued = await manage.POST(createRequest()); assert.equal(issued.status, 201); assert.equal(issued.headers.get('cache-control'), 'private, no-store');
  const { token, credential } = await issued.json();
  assert.match(token, /^jh_capture_/);
  const connection = load('src/app/api/v1/connection/route.ts');
  const connected = await connection.GET(new Request('http://local/api/v1/connection', { headers: { Authorization: `Bearer ${token}` } }));
  assert.equal(connected.status, 200);
  const connectedData = await connected.json(); assert.equal(connectedData.account.id, user.id);
  assert.equal(credential.expires_at, null, 'new credentials never expire');
  assert.equal(connectedData.expires_at, null, 'connection explicitly advertises no expiry');
  assert.equal((await manage.POST(createRequest())).status, 409, 'an active credential prevents accidental duplicates');
  const originalNow = Date.now;
  try {
    Date.now = () => originalNow() + 3650 * 86400000;
    assert.equal((await connection.GET(new Request('http://local/api/v1/connection', { headers: { Authorization: `Bearer ${token}` } }))).status, 200, 'credential still works years later');
  } finally { Date.now = originalNow; }
  assert.equal(connectedData.token, undefined); assert.equal(connectedData.token_hash, undefined);
  assert.equal(connectedData.capabilities.assessments, false); assert.equal(connectedData.limits.max_capture_bytes, 262144);
  assert.equal(connectedData.capabilities.extension_assessments, true);
  await assert.rejects(store.authenticateExtensionCredential(request(fixture(), token), 'assessments:request'), error => error.status === 403);
  const listed = await (await manage.GET()).json(); assert.equal(listed.data.length, 1); assert.equal(listed.data[0].token_hash, undefined); assert.equal(listed.data[0].token, undefined);
  const snapshot = await inspect(); assert.ok(!JSON.stringify(snapshot).includes(token), 'raw credential is never persisted');
  const body = fixture();
  assert.equal((await route.POST(request(body))).status, 401, 'session alone cannot import');
  const first = await route.POST(request(body, token)); assert.equal(first.status, 201); assert.equal(first.headers.get('etag'), '"1"');
  const receipt = await first.json(); assert.equal(receipt.disposition, 'created'); assert.equal(receipt.assessment.state, 'disabled');
  const app = await db.getApplicationById(receipt.application_id, user);
  assert.equal(app.owner, user.id); assert.equal(app.status, 'LEAD'); assert.equal(app.notion_status, 'Not started');
  assert.equal(app.job_type, null); assert.equal(app.work_model, null); assert.equal(app.salary_currency, null);
  assert.equal(app.date_applied, undefined); assert.equal(app.first_response_at, null);
  assert.equal(app.job_description, postingText);
  const replay = await route.POST(request(Object.fromEntries(Object.entries(body).reverse()), token)); assert.equal(replay.status, 200); assert.deepEqual(await replay.json(), receipt);
  const simultaneous = fixture(); simultaneous.posting.job_url = 'https://example.com/same-request';
  const replays = await Promise.all([route.POST(request(simultaneous, token)), route.POST(request(simultaneous, token))]);
  assert.deepEqual(replays.map(r => r.status).sort(), [200, 201]);
  const altered = structuredClone(body); altered.posting.role_title = 'Different'; assert.equal((await route.POST(request(altered, token))).status, 409);
  await db.updateApplication(app.id, { role_fit: 'WEAK', role_fit_source: 'manual', priority: 'DREAM', information: 'User-edited requirements.' });
  const again = fixture(); const existing = await route.POST(request(again, token)); assert.equal(existing.status, 201); assert.equal((await existing.json()).disposition, 'existing');
  const preserved = await db.getApplicationById(app.id, user); assert.equal(preserved.information, 'User-edited requirements.'); assert.equal(preserved.priority, 'DREAM'); assert.equal(preserved.role_fit_source, 'manual');
  const suppliedExisting = attachFit(fixture(), validation);
  const storedOnly = await (await route.POST(request(suppliedExisting, token))).json();
  assert.equal(storedOnly.extension_assessment.disposition, 'stored_only');
  assert.equal((await db.getApplicationById(app.id, user)).role_fit, 'WEAK');
  for (const [fit, priority] of [['STRONG', 'HIGH'], ['POSSIBLE', 'MEDIUM'], ['WEAK', 'LOW']]) {
    const supplied = fixture(); supplied.posting.job_url = `https://example.com/fit/${fit}`; attachFit(supplied, validation, fit);
    const response = await route.POST(request(supplied, token)); assert.equal(response.status, 201);
    const saved = await response.json(); assert.equal(saved.assessment.state, 'disabled'); assert.equal(saved.extension_assessment.disposition, 'applied');
    const fitted = await db.getApplicationById(saved.application_id, user);
    assert.equal(fitted.role_fit, fit); assert.equal(fitted.priority, priority); assert.equal(fitted.role_fit_source, 'ai');
    assert.equal(fitted.role_fit_analysis.origin, 'extension'); assert.equal(fitted.role_fit_analysis.extension_context.resume_id, 'resume-a');
    assert.equal(fitted.role_fit_analysis.extension_context.posting_hash, supplied.extension_assessment.posting_hash);
    assert.equal((await route.POST(request(supplied, token))).status, 200, 'provided assessment replays without any AI request');
  }
  await db.updateApplication(app.id, { status: 'APPLIED' });
  const promoted = await (await route.POST(request(fixture(), token))).json(); assert.equal(promoted.application_id, app.id); assert.equal(promoted.disposition, 'existing');
  const lookup = ids => new Request('http://local/api/v1/captures?ids=' + ids.join(','), { headers: { Authorization: `Bearer ${token}` } });
  assert.equal((await (await route.GET(lookup([body.capture_id]))).json()).captures.length, 1);
  assert.equal((await route.GET(lookup(Array(51).fill(body.capture_id)))).status, 422);
  const foreign = await store.issueExtensionCredential(other.id, 'Other browser');
  const foreignRead = new Request('http://local/api/v1/captures?ids=' + body.capture_id, { headers: { Authorization: `Bearer ${foreign.token}` } });
  assert.deepEqual((await (await route.GET(foreignRead)).json()).captures, []);
  const foreignCapture = await route.POST(request(body, foreign.token)); assert.equal(foreignCapture.status, 201);
  assert.notEqual((await foreignCapture.json()).application_id, app.id);
  const draft = fixture(); draft.capture_id = randomUUID(); draft.posting.role_title = null; draft.posting.company_name = null; draft.posting.job_url = 'https://example.com/draft';
  const drafted = await (await route.POST(request(draft, token))).json(); assert.equal(drafted.disposition, 'draft'); assert.equal(drafted.application_id, null);
  const parallel = fixture(); parallel.posting.job_url = 'https://example.com/parallel?q=one#posting';
  const second = structuredClone(parallel); second.capture_id = randomUUID();
  const pair = await Promise.all([route.POST(request(parallel, token)), route.POST(request(second, token))]);
  const pairData = await Promise.all(pair.map(r => r.json()));
  assert.equal(new Set(pairData.map(r => r.application_id)).size, 1); assert.deepEqual(pairData.map(r => r.disposition).sort(), ['created', 'existing']);
  await db.updateApplication(pairData[0].application_id, { owner: other.id });
  assert.equal((await (await route.GET(lookup([parallel.capture_id]))).json()).captures[0].record_deleted, true, 'a transferred record is unavailable to the previous owner');
  await db.deleteApplication(app.id);
  assert.equal((await route.POST(request(body, token))).status, 200, 'original receipt replays after deletion');
  assert.equal((await route.POST(request(fixture(), token))).status, 410, 'new capture cannot recreate a deleted opening');
  assert.equal((await (await route.GET(lookup([body.capture_id]))).json()).captures[0].record_deleted, true);
  setSession(other);
  assert.equal((await manage.DELETE(new Request('http://local/api/extension-credentials?id=' + credential.id, { method: 'DELETE', headers: { Origin: 'http://local' } }))).status, 404);
  setSession(user);
  assert.equal((await manage.DELETE(new Request('http://local/api/extension-credentials?id=' + credential.id, { method: 'DELETE', headers: { Origin: 'http://local' } }))).status, 200);
  assert.equal((await route.GET(lookup([body.capture_id]))).status, 401);
  assert.deepEqual((await (await manage.GET()).json()).data, [], 'revoked credentials do not clutter the connection list');
  const expiring = await store.issueExtensionCredential(user.id, 'Expire'); await expire(expiring.credential.id);
  assert.equal((await route.POST(request(fixture(), expiring.token))).status, 401);
  assert.equal((await connection.GET(new Request('http://local/api/v1/connection', { headers: { Authorization: `Bearer ${expiring.token}` } }))).status, 401);
  assert.deepEqual((await (await manage.GET()).json()).data, [], 'expired legacy credentials remain invalid and hidden');
  const limited = await Promise.allSettled(Array.from({ length: 6 }, () => store.issueExtensionCredential(user.id, 'Limit test')));
  assert.equal(limited.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(limited.find(r => r.status === 'rejected').reason.code, 'CREDENTIAL_LIMIT');
  for (const result of limited) if (result.status === 'fulfilled') await store.revokeExtensionCredential(user.id, result.value.credential.id);
  return { user, store, db, route };
}

test('local authenticated ingestion preserves ownership, unknowns, idempotency, promotion, deletion, and revocation', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'capture-ingestion-'));
  try {
    let session = null;
    const wrappedPath = { ...path, join: (...parts) => parts[0] === process.cwd() && parts[1] === '.data' ? dir : path.join(...parts),
      resolve: (...parts) => parts.length === 1 && parts[0] === process.env.DB_LOCAL_DIR ? dir : path.resolve(...parts) };
    const load = loader({ path: wrappedPath, [path.join(root, 'src/lib/database.ts')]: { getDatabaseClient: () => null }, '@/lib/session-account': { getSessionAccount: async () => session } });
    const db = load('src/lib/db.ts');
    const legacy = db.readLocalCaptureDatabase();
    legacy.extension_credentials = legacyCredentials(); db.writeLocalCaptureDatabase(legacy);
    assertMigratedCredentials(db.readLocalCaptureDatabase().extension_credentials);
    await exercise(load, value => { session = value; }, async id => {
      const data = db.readLocalCaptureDatabase(); data.extension_credentials.find(c => c.id === id).expires_at = '2020-01-01T00:00:00Z'; db.writeLocalCaptureDatabase(data);
    }, async () => db.readLocalCaptureDatabase());
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('real PostgreSQL capture ingestion is atomic and handles concurrent identities and immutable receipts', async () => {
  const pg = new PGlite();
  try {
    const sql = (strings, ...values) => {
      const text = strings.reduce((s, part, i) => s + (i ? '$' + i : '') + part, '');
      return { text, values, then: (resolve, reject) => pg.query(text, values).then(result => result.rows).then(resolve, reject) };
    };
    sql.transaction = queries => pg.transaction(async tx => { const rows = []; for (const query of queries) rows.push((await tx.query(query.text, query.values)).rows); return rows; });
    let session = null;
    const load = loader({ [path.join(root, 'src/lib/database.ts')]: { getDatabaseClient: () => sql }, '@/lib/session-account': { getSessionAccount: async () => session } });
    // Start with the old NOT NULL schema to exercise the production upgrade.
    await pg.exec('CREATE TABLE extension_credentials (id TEXT PRIMARY KEY, owner TEXT NOT NULL, label TEXT NOT NULL, token_hash TEXT NOT NULL UNIQUE, scopes JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL, expires_at TIMESTAMPTZ NOT NULL, revoked_at TIMESTAMPTZ)');
    for (const c of legacyCredentials()) await pg.query('INSERT INTO extension_credentials VALUES ($1,$2,$3,$4,$5,$6,$7,$8)', [c.id, c.owner, c.label, c.token_hash, JSON.stringify(c.scopes), c.created_at, c.expires_at, c.revoked_at]);
    await load('src/lib/db.ts').migrateDatabase();
    assertMigratedCredentials((await pg.query("SELECT * FROM extension_credentials WHERE owner='legacy'")).rows);
    const context = await exercise(load, value => { session = value; }, async id => { await pg.query("UPDATE extension_credentials SET expires_at='2020-01-01' WHERE id=$1", [id]); }, async () => (await pg.query('SELECT * FROM extension_credentials')).rows);
    const body = fixture(); body.posting.job_url = 'https://example.com/rollback';
    const token = await context.store.issueExtensionCredential(context.user.id, 'Rollback');
    const before = (await pg.query('SELECT count(*)::int AS n FROM leads')).rows[0].n;
    await pg.exec("CREATE FUNCTION reject_capture_fixture() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic persistence error'; END; $$; CREATE TRIGGER reject_capture_fixture BEFORE INSERT ON posting_captures FOR EACH ROW EXECUTE FUNCTION reject_capture_fixture();");
    const failed = await context.route.POST(request(body, token.token));
    assert.equal(failed.status, 503); assert.doesNotMatch(JSON.stringify(await failed.json()), /synthetic|EXCEPTION|token_hash/);
    assert.equal((await pg.query('SELECT count(*)::int AS n FROM leads')).rows[0].n, before, 'capture failure rolls back the lead too');
    await pg.exec('DROP TRIGGER reject_capture_fixture ON posting_captures');
    assert.equal((await context.route.POST(request(body, token.token))).status, 201, 'same request can safely retry after rollback');
  } finally { await pg.close(); }
});
