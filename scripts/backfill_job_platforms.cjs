const fs = require('node:fs');
const path = require('node:path');
const { loadEnvConfig } = require('@next/env');
const { getClient } = require('./database_client.cjs');
const { loadTypescript } = require('./migrate_db.cjs');
const root = path.resolve(__dirname, '..');
const { jobPlatformFromUrl } = loadTypescript(path.join(root, 'src/lib/job-platform.ts'));

function planRecords(records) {
  return records.map(record => {
    if (record.job_platform?.trim()) return { ...record, platform: null, host: null, reason: 'preserved-platform' };
    return { ...record, ...jobPlatformFromUrl(record.job_url, record.website) };
  });
}
function summary(plan) {
  const platforms = {}, skipped = {};
  for (const record of plan) {
    const target = record.platform ? platforms : skipped;
    const key = record.platform || record.reason;
    target[key] = (target[key] || 0) + 1;
  }
  return { inspected: plan.length, planned: plan.filter(record => record.platform).length, platforms, skipped };
}
function reportRecords(plan) {
  // Back up only fields being changed; URLs and other account data stay out of logs.
  return plan.map(row => ({ collection: row.collection, id: row.id, previous_platform: row.job_platform ?? null,
    previous_updated_at: row.updated_at, platform: row.platform, host: row.host, reason: row.reason }));
}
async function postgresSnapshot(sql, owner) {
  const accounts = await sql`SELECT id, name, email FROM users WHERE id = ${owner} OR lower(trim(email)) = ${owner.toLowerCase()}`;
  if (accounts.length !== 1) throw new Error('The intended account could not be uniquely identified.');
  const account = accounts[0];
  const [applications, leads] = await Promise.all([
    // Text preserves PostgreSQL microseconds; JS Date would round the guard value.
    sql`SELECT a.id,a.owner,a.job_url,a.updated_at::text AS updated_at,to_jsonb(a)->>'job_platform' AS job_platform,c.website
      FROM applications a LEFT JOIN companies c ON c.id=a.company_id
      WHERE lower(trim(coalesce(a.owner,''))) IN (${account.id.toLowerCase()},${account.email.toLowerCase()})
        OR (${account.id === 'user_ji'} AND lower(trim(coalesce(a.owner,''))) IN ('','admin'))`,
    sql`SELECT l.id,l.data,c.website FROM leads l LEFT JOIN companies c ON c.id=l.data->>'company_id'
      WHERE lower(trim(coalesce(l.data->>'owner',''))) IN (${account.id.toLowerCase()},${account.email.toLowerCase()})
        OR (${account.id === 'user_ji'} AND lower(trim(coalesce(l.data->>'owner',''))) IN ('','admin'))`,
  ]);
  return { account, records: [...applications.map(row => ({ ...row, collection: 'applications' })),
    ...leads.map(row => ({ ...row.data, id: row.id, website: row.website, data: row.data, collection: 'leads' }))] };
}
async function applyPostgres(sql, plan) {
  const changes = plan.filter(row => row.platform);
  if (!changes.length) return [];
  // Only this additive schema change is needed. Never run unrelated migrations.
  await sql`ALTER TABLE applications ADD COLUMN IF NOT EXISTS job_platform TEXT`;
  const applied = [];
  // Bound batches keep request payloads modest. Each batch commits atomically.
  for (let offset = 0; offset < changes.length; offset += 25) {
    const batch = changes.slice(offset, offset + 25);
    const results = await sql.transaction(batch.map(row => row.collection === 'applications'
      ? sql`UPDATE applications SET job_platform=${row.platform},updated_at=NOW()
          WHERE id=${row.id} AND owner IS NOT DISTINCT FROM ${row.owner}
            AND nullif(trim(job_platform),'') IS NULL AND job_url IS NOT DISTINCT FROM ${row.job_url}
            AND updated_at IS NOT DISTINCT FROM ${row.updated_at}
          RETURNING id,job_platform,updated_at::text AS updated_at`
      : sql`UPDATE leads SET data=jsonb_set(jsonb_set(data,'{job_platform}',to_jsonb(${row.platform}::text)),'{updated_at}',to_jsonb(NOW()))
          WHERE id=${row.id} AND data=${JSON.stringify(row.data)}::jsonb
            AND nullif(trim(data->>'job_platform'),'') IS NULL
          RETURNING id,data->>'job_platform' AS job_platform,data->>'updated_at' AS updated_at`));
    for (let index = 0; index < results.length; index++) {
      if (results[index].length) applied.push({ collection: batch[index].collection, ...results[index][0] });
    }
  }
  return applied;
}
function localSnapshot(file, owner) {
  const raw = fs.readFileSync(file, 'utf8');
  const db = JSON.parse(raw);
  const accounts = (db.users || []).filter(user => user.id === owner || user.email?.toLowerCase() === owner.toLowerCase());
  if (accounts.length !== 1) throw new Error('The intended account could not be uniquely identified.');
  const account = accounts[0];
  const owns = app => [account.id.toLowerCase(), account.email.toLowerCase()].includes((app.owner || '').trim().toLowerCase())
    || account.id === 'user_ji' && ['', 'admin'].includes((app.owner || '').trim().toLowerCase());
  const records = ['applications','leads'].flatMap(collection => (db[collection] || []).filter(owns).map(row => ({ ...row, collection,
    website: db.companies?.find(company => company.id === row.company_id)?.website })));
  return { account, records, raw, db };
}
function applyLocal(file, snapshot, plan) {
  if (fs.readFileSync(file, 'utf8') !== snapshot.raw) throw new Error('Local data changed after preview; rerun the backfill.');
  const applied = [], at = new Date().toISOString();
  for (const row of plan.filter(record => record.platform)) {
    const app = snapshot.db[row.collection].find(item => item.id === row.id);
    app.job_platform = row.platform; app.updated_at = at;
    applied.push({ collection: row.collection, id: row.id, job_platform: row.platform, updated_at: at });
  }
  if (applied.length) {
    const temporary = `${file}.platform-${process.pid}-${Date.now()}.tmp`;
    fs.writeFileSync(temporary, JSON.stringify(snapshot.db, null, 2));
    if (fs.readFileSync(file, 'utf8') !== snapshot.raw) throw new Error('Local data changed after preview; rerun the backfill.');
    fs.renameSync(temporary, file);
  }
  return applied;
}
async function main() {
  loadEnvConfig(root);
  const args = process.argv.slice(2);
  if (args.some(arg => !['--apply','--owner'].includes(arg) && args[args.indexOf(arg)-1] !== '--owner')) throw new Error('Use --apply and optional --owner account-id-or-email.');
  const index = args.indexOf('--owner');
  const configured = (process.env.ADMIN_EMAIL || 'jizelle.casia@gmail.com').trim().toLowerCase();
  const owner = index >= 0 ? args[index+1] : configured === 'jizellecasia@gmail.com' ? 'jizelle.casia@gmail.com' : configured;
  if (!owner || owner.startsWith('--')) throw new Error('Provide an account ID or email after --owner.');
  const connection = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  const sql = connection && process.env.DB_MODE !== 'local' ? getClient() : null;
  const file = path.join(root, '.data/db.json');
  const snapshot = sql ? await postgresSnapshot(sql, owner) : localSnapshot(file, owner);
  const plan = planRecords(snapshot.records);
  const directory = path.join(root, '.data', `job-platform-backfill-${Date.now()}`);
  fs.mkdirSync(directory, { recursive: true });
  const report = { storage: sql ? 'postgres' : 'local', account: { id: snapshot.account.id, name: snapshot.account.name },
    summary: summary(plan), applications: summary(plan.filter(row => row.collection === 'applications')), leads: summary(plan.filter(row => row.collection === 'leads')), records: reportRecords(plan) };
  fs.writeFileSync(path.join(directory,'report.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({ ...report, records: undefined, report: path.relative(root,path.join(directory,'report.json')) },null,2));
  if (!args.includes('--apply')) return;
  if (!sql) fs.writeFileSync(path.join(directory,'before.json'),snapshot.raw);
  const applied = sql ? await applyPostgres(sql,plan) : applyLocal(file,snapshot,plan);
  fs.writeFileSync(path.join(directory,'applied.json'),JSON.stringify(applied,null,2));
  const after = sql ? await postgresSnapshot(sql,owner) : localSnapshot(file,owner);
  const byId = new Map(after.records.map(row => [`${row.collection}:${row.id}`,row]));
  const verified = applied.filter(row => byId.get(`${row.collection}:${row.id}`)?.job_platform === row.job_platform).length;
  console.log(JSON.stringify({ applied: applied.length, verified, guardedUpdatesSkipped: report.summary.planned - applied.length,
    remaining: summary(planRecords(after.records)), report: path.relative(root,path.join(directory,'report.json')) },null,2));
  if (verified !== applied.length) throw new Error('Verification did not match the applied platforms. Inspect the saved report.');
}
if (require.main === module) main().catch(error => {
  const safe = /^(The intended account|Use --apply|Provide an account|Local data changed|Verification did not)/.test(error.message);
  console.error(safe ? error.message : 'Platform backfill failed. Inspect the local report and database configuration; credentials were not logged.');
  process.exitCode = 1;
});
module.exports = { main, planRecords, summary, localSnapshot, applyLocal, applyPostgres, jobPlatformFromUrl };
