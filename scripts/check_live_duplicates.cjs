const fs = require('node:fs');
const path = require('node:path');
const base = 'https://jobhunt.jizellecasia.site';
const normalize = value => String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
function groups(rows, key) {
  const grouped = new Map();
  for (const row of rows) {
    const identity = key(row);
    if (!identity) continue;
    grouped.set(identity, [...(grouped.get(identity) || []), row]);
  }
  return [...grouped].filter(([, rows])=>rows.length>1).map(([key,rows])=>({key,rows}));
}
async function read(endpoint) {
  const response = await fetch(`${base}${endpoint}`, {signal:AbortSignal.timeout(30000)});
  if (!response.ok) throw new Error(`${endpoint}: HTTP ${response.status}`);
  const result = await response.json();
  if (!result.success || !Array.isArray(result.data)) throw new Error(`${endpoint}: invalid response`);
  return result.data;
}
async function main() {
  const [companies, apps] = await Promise.all([read('/api/companies?role=admin'), read('/api/applications')]);
  const directory = path.join(__dirname, '../.data');
  fs.mkdirSync(directory,{recursive:true});
  const snapshot = `duplicate-audit-${Date.now()}.json`;
  fs.writeFileSync(path.join(directory,snapshot),JSON.stringify({companies,apps},null,2));
  const summarize = ({id,company_id,company_name,role_title,status,notion_status,notion_page_id,owner,date_applied,created_at,updated_at,sync_status,job_url,information,notes})=>
    ({id,company_id,company_name,role_title,status,notion_status,notion_page_id,owner,date_applied,created_at,updated_at,sync_status,job_url,information,notes});
  const duplicates = groups(apps,app=>normalize(app.company_name)+'|'+normalize(app.role_title));
  const result = {snapshot,totalCompanies:companies.length,totalApplications:apps.length,
    filoilCompanies:companies.filter(c=>/fil\W?oil/i.test(c.name)).map(({logo_url,...rest})=>({...rest,hasLogo:!!logo_url})),
    filoilApplications:apps.filter(a=>/fil\W?oil/i.test(a.company_name)).map(summarize),
    companyNameDuplicates:groups(companies,c=>normalize(c.name)).map(({key,rows})=>({key,ids:rows.map(r=>r.id)})),
    repeatedNotionPages:groups(apps,a=>normalize(a.notion_page_id).replace(/-/g,'')).map(({key,rows})=>({key,rows:rows.map(summarize)})),
    repeatedCompanyRoles:duplicates.map(({key,rows})=>({key,rows:rows.map(a=>({id:a.id,status:a.status,owner:a.owner,notion_page_id:a.notion_page_id,date_applied:a.date_applied,job_url:a.job_url}))})),
  };
  fs.writeFileSync(path.join(directory,'live-duplicate-audit.json'),JSON.stringify(result,null,2));
  console.log(JSON.stringify({snapshot,totalCompanies:companies.length,totalApplications:apps.length,
    filoilCompanies:result.filoilCompanies,filoilApplications:result.filoilApplications,
    companyNameDuplicates:result.companyNameDuplicates,
    duplicateNotionGroups:result.repeatedNotionPages.length,
    extraRows:result.repeatedNotionPages.reduce((count,group)=>count+group.rows.length-1,0)},null,2));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
