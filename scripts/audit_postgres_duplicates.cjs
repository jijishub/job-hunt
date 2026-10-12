const fs = require('node:fs');
const path = require('node:path');
const { loadEnvConfig } = require('@next/env');
const { neon } = require('@neondatabase/serverless');
loadEnvConfig(process.cwd());
async function main() {
 const url=process.env.POSTGRES_URL||process.env.DATABASE_URL;
 if(!url)throw Error('No Postgres connection configured.');
 const sql=neon(url);
 const rows=await sql`SELECT * FROM applications ORDER BY updated_at DESC`;
 const grouped=new Map();
 for(const row of rows){if(!row.notion_page_id)continue;const key=row.notion_page_id.replace(/-/g,'').toLowerCase()+'|'+(row.owner||'admin');grouped.set(key,[...(grouped.get(key)||[]),row]);}
 const duplicates=[...grouped.values()].filter(rows=>rows.length>1);
 fs.mkdirSync('.data',{recursive:true});
 const snapshot=path.join('.data',`postgres-duplicate-backup-${Date.now()}.json`);
 fs.writeFileSync(snapshot,JSON.stringify({applications:rows,duplicates},null,2));
 console.log(JSON.stringify({snapshot,applications:rows.length,duplicateGroups:duplicates.length,extraRows:duplicates.reduce((n,g)=>n+g.length-1,0)}));
 if(!process.argv.includes('--apply'))return;
 // Use precisely the same migration as the build-time database setup, in one transaction.
 const source=fs.readFileSync('src/lib/db.ts','utf8');
 const start=source.indexOf('// Preserve every superseded row');
 const end=source.indexOf('    schemaInitialized = true;',start);
 const statements=[...source.slice(start,end).matchAll(/sql`([\s\S]*?)`/g)].map(match=>match[1]);
 if(statements.length!==4)throw Error('Migration layout changed; review before applying.');
 await sql.transaction(statements.map(statement=>sql.query(statement)));
 const counts=await sql`SELECT (SELECT count(*) FROM applications) AS applications, (SELECT count(*) FROM duplicate_applications_archive) AS archived`;
 console.log(JSON.stringify({applied:true,...counts[0]}));
}
main().catch(error=>{console.error(error.message);process.exitCode=1});
