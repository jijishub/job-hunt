const fs = require('node:fs');
const path = require('node:path');
const { getClient } = require('./database_client.cjs');

async function runAudit(sql, args = []) {
  if (args.some(arg => !['--apply','--full-backup'].includes(arg))) throw Error('Use --apply or --full-backup.');
  const references = await sql`SELECT id,notion_page_id,owner,sync_status,updated_at FROM applications ORDER BY updated_at DESC`;
  const grouped = new Map();
  for (const row of references) {
    if (!row.notion_page_id) continue;
    const key = row.notion_page_id.replace(/-/g,'').toLowerCase()+'|'+(row.owner??'admin');
    grouped.set(key,[...(grouped.get(key)||[]),row]);
  }
  const duplicates = [...grouped.values()].filter(rows=>rows.length>1);
  const report = { applications:references.length,duplicateGroups:duplicates.length,extraRows:duplicates.reduce((n,rows)=>n+rows.length-1,0) };
  // Ordinary auditing never downloads descriptions, notes, analyses or images.
  if (!args.includes('--apply') && !args.includes('--full-backup')) return report;
  const ids = duplicates.flatMap(rows=>rows.map(row=>row.id));
  const rows = args.includes('--full-backup')
    ? await sql`SELECT * FROM applications ORDER BY updated_at DESC`
    : ids.length ? await sql`SELECT * FROM applications WHERE id=ANY(${ids}::text[])` : [];
  fs.mkdirSync('.data',{recursive:true});
  const snapshot = path.join('.data',`postgres-duplicate-backup-${Date.now()}.json`);
  fs.writeFileSync(snapshot,JSON.stringify({applications:rows,duplicates},null,2),{flag:'wx'});
  if (!args.includes('--apply') || !duplicates.length) return {...report,snapshot};
  const source = fs.readFileSync('src/lib/db.ts','utf8');
  const start = source.indexOf('// Preserve every superseded row');
  const end = source.indexOf('    schemaInitialized = true;',start);
  const statements = [...source.slice(start,end).matchAll(/sql`([\s\S]*?)`/g)].map(match=>match[1]);
  if (statements.length!==4) throw Error('Migration layout changed; review before applying.');
  await sql.transaction(statements.map(statement=>sql.query(statement)));
  return {...report,snapshot,applied:true};
}
async function main(){require('@next/env').loadEnvConfig(process.cwd());console.log(JSON.stringify(await runAudit(getClient(),process.argv.slice(2))));}
if(require.main===module)main().catch(()=>{console.error('Duplicate audit failed; no credentials or record contents were logged.');process.exitCode=1;});
module.exports={runAudit};
