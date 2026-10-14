// Read-only: aggregate in Postgres so the audit does not download private records.
const { loadEnvConfig } = require('@next/env');
const { neon } = require('@neondatabase/serverless');
loadEnvConfig(process.cwd());
async function main() {
  const url = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!url) throw new Error('No Postgres connection configured.');
  const sql = neon(url);
  const rows = await sql`
    WITH records AS (
      SELECT 'applications' AS collection, to_jsonb(a) AS data FROM applications a
      UNION ALL SELECT 'leads', data FROM leads
    )
    SELECT collection, count(*)::int AS records,
      sum(octet_length(data::text))::bigint AS full_json_bytes,
      sum(octet_length((data - ARRAY['job_description','information','notes','contact_name','contact_email'])::text))::bigint AS analytics_json_bytes,
      sum(octet_length((data - ARRAY['job_description','information','notes','contact_name','contact_email','company_logo'])::text))::bigint AS optimized_analytics_json_bytes,
      sum(octet_length(jsonb_build_object('company_id',data->'company_id','owner',data->'owner')::text))::bigint AS company_reference_bytes,
      sum(octet_length(jsonb_build_object('notion_status',data->'notion_status','stage_history',data->'stage_history','owner',data->'owner')::text))::bigint AS status_reference_bytes,
      sum(octet_length(coalesce(data->>'job_description','')))::bigint AS description_bytes,
      sum(octet_length(coalesce(data->>'information','')))::bigint AS information_bytes,
      sum(octet_length(coalesce(data->>'notes','')))::bigint AS notes_bytes,
      sum(octet_length(coalesce((data->'role_fit_analysis')::text,'')))::bigint AS role_fit_analysis_bytes,
      sum(octet_length(coalesce(data->>'company_logo','')))::bigint AS logo_bytes,
      count(DISTINCT lower(trim(coalesce(data->>'owner',''))))::int AS owner_keys
    FROM records GROUP BY collection ORDER BY collection;
  `;
  console.log(JSON.stringify({ measuredAt: new Date().toISOString(), note: 'JSON size proxies, not billed wire bytes or historical consumption. No record contents or owner identities returned.', collections: rows }, null, 2));
  const stats = await sql`SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_stat_statements') AS statement_stats_available;`;
  console.log(JSON.stringify(stats[0]));
  if (process.argv.includes('--verify')) {
    // Exercise the actual application queries against Postgres. Compare with
    // the old JS ownership filter using narrow reference rows, never full data.
    const fs = require('node:fs');
    const path = require('node:path');
    const Module = require('node:module');
    const ts = require('typescript');
    const assert = require('node:assert/strict');
    const cache = new Map();
    function load(filename) {
      if (cache.has(filename)) return cache.get(filename).exports;
      const m = new Module(filename, module);
      m.filename = filename; m.paths = Module._nodeModulePaths(path.dirname(filename)); cache.set(filename, m);
      const original = m.require.bind(m);
      m.require = id => {
        const target = id.startsWith('@/') ? path.resolve('src', id.slice(2)) : id.startsWith('.') ? path.resolve(path.dirname(filename), id) : null;
        return target && fs.existsSync(target + '.ts') ? load(target + '.ts') : original(id);
      };
      m._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, filename);
      return m.exports;
    }
    const db = load(path.resolve('src/lib/db.ts'));
    const { ownsApplication } = load(path.resolve('src/lib/ownership.ts'));
    const users = await sql`SELECT id, email, role FROM users;`;
    const references = await sql`
      SELECT company_id, owner, notion_status, stage_history FROM applications
      UNION ALL SELECT data->>'company_id', data->>'owner', data->>'notion_status', data->'stage_history' FROM leads;
    `;
    const normalize = (records, fields) => records.map(record => JSON.stringify(fields.map(field => record[field] ?? null))).sort();
    for (const user of users) {
      const expected = references.filter(row => ownsApplication(row, user));
      for (const projection of ['company', 'status']) {
        const fields = projection === 'company' ? ['company_id', 'owner'] : ['notion_status', 'stage_history', 'owner'];
        assert.deepEqual(normalize(await db.getApplications(true, user, projection), fields), normalize(expected, fields));
      }
    }
    assert.equal(await db.hasApplications(), references.length > 0);
    console.log(JSON.stringify({ verifiedAccounts: users.length, projectionsEquivalentToPreviousOwnershipFilter: true }));
  }
}
main().catch(() => { console.error('Read-only network audit failed. Check connection and table access.'); process.exitCode = 1; });
