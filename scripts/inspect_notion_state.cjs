const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const vm = require('node:vm');
require('@next/env').loadEnvConfig(path.join(__dirname, '..'));
const mod = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/lib/notion.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText + '\nexports.inspectClient = getNotionClient;', {
  exports: mod.exports, module: mod, process, console,
  require: (name) => name === './db' || name === './statuses' ? {} : require(name),
});
async function run() {
  const client = mod.exports.inspectClient();
  const config = mod.exports.getNotionConfig();
  const database = await client.databases.retrieve({ database_id: config.databaseId });
  for (const source of database.data_sources || []) {
    const schema = await client.dataSources.retrieve({ data_source_id: source.id });
    console.log(JSON.stringify({ sourceId: source.id, properties: Object.entries(schema.properties)
      .map(([name, property]) => ({ name, type: property.type })) }));
  }
  const url = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!url) {
    console.log('No configured Postgres connection');
    const response = await fetch('https://jobhunt.jizellecasia.site/api/applications', { signal: AbortSignal.timeout(20000) });
    if (!response.ok) { console.log(JSON.stringify({ deployedReadStatus: response.status })); return; }
    const body = await response.json();
    const apps = body.data || [];
    const usersResponse = await fetch('https://jobhunt.jizellecasia.site/api/users', { signal: AbortSignal.timeout(20000) });
    const users = usersResponse.ok ? (await usersResponse.json()).data || [] : [];
    const groups = new Map();
    for (const app of apps.filter((app) => app.status === 'LEAD' && app.notion_page_id)) {
      const key = app.notion_page_id.replace(/-/g, '').toLowerCase();
      groups.set(key, (groups.get(key) || 0) + 1);
    }
    console.log(JSON.stringify({ deployedCount: apps.length,
      duplicateLeadGroups: Array.from(groups).filter(([, count]) => count > 1),
      byteDance: apps.filter((app) => /bytedance/i.test(app.company_name)).map((app) => ({
        id: app.id, status: app.status, owner: app.owner, sync_status: app.sync_status,
        notion_page_id: app.notion_page_id, notesLength: app.notes?.length || 0,
        ownerRole: users.find((user) => user.id === app.owner)?.role,
        roleLength: app.role_title.length, jobUrlLength: app.job_url?.length || 0,
      })) }));
    return;
  }
  const sql = require('@neondatabase/serverless').neon(url);
  const duplicates = await sql`SELECT replace(data->>'notion_page_id', '-', '') AS page,
    count(*) AS count FROM leads WHERE data->>'notion_page_id' IS NOT NULL
    GROUP BY replace(data->>'notion_page_id', '-', '') HAVING count(*) > 1;`;
  const counts = await sql`SELECT count(*) AS count FROM leads;`;
  const byte = await sql`SELECT id, role_title, status, sync_status, owner, notion_page_id,
    length(notes) AS notes_length, length(information) AS information_length FROM applications
    WHERE lower(company_name) LIKE '%bytedance%';`;
  console.log(JSON.stringify({ leadCount: counts[0].count, duplicateNotionLeads: duplicates, byteDance: byte }));
}
run().catch((error) => { console.error(error.code || error.name, error.message); process.exitCode = 1; });
