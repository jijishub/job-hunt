const fs = require('node:fs');
const path = require('node:path');
const base = 'https://jobhunt.jizellecasia.site';
const directory = path.join(__dirname, '../.data');
async function readCompanies() {
  const response = await fetch(`${base}/api/companies?role=admin`, { signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`Company read failed: ${response.status}`);
  const body = await response.json();
  if (!body.success) throw new Error(body.error || 'Company read failed');
  return body.data;
}
async function run() {
  const companies = await readCompanies();
  fs.mkdirSync(directory, { recursive: true });
  if (process.argv[2] === 'verify') {
    const baseline = JSON.parse(fs.readFileSync(path.join(directory, 'company-logos-backup-1791574280888.json'), 'utf8'));
    const plan = JSON.parse(fs.readFileSync(path.join(directory, 'company-logo-plan.json'), 'utf8'));
    const addedDuringWork = companies.filter(c=>!baseline.some(old=>old.id===c.id)).map(c=>c.name);
    for (const old of baseline) {
      const current = companies.find(c => c.id === old.id);
      if (!current) throw new Error(`Company disappeared: ${old.name}`);
      for (const field of ['name', 'website', 'industry', 'created_by']) {
        if (current[field] !== old[field]) throw new Error(`Unexpected ${field} change: ${old.name}`);
      }
      if (old.logo_url && old.logo_url !== current.logo_url) throw new Error(`Existing logo changed: ${old.name}`);
    }
    for (const entry of plan) {
      if (companies.find(c => c.id === entry.id)?.logo_url !== entry.logo_url) throw new Error(`Logo missing: ${entry.name}`);
    }
    const summary = {total:companies.length, sourced:plan.length, preserved:baseline.filter(c=>c.logo_url).length, addedDuringWork,
      withLogos:companies.filter(c=>c.logo_url).length, missing:companies.filter(c=>!c.logo_url).map(c=>c.name)};
    fs.writeFileSync(path.join(directory,'company-logo-verification.json'),JSON.stringify(summary,null,2));
    fs.writeFileSync(path.join(directory,'company-logo-sources.json'),JSON.stringify(plan.map(({id,name,source_url,source_page})=>({id,name,source_url,source_page})),null,2));
    console.log(JSON.stringify(summary,null,2));
    return;
  }
  if (process.argv[2] !== 'apply') {
    const snapshot = path.join(directory, `company-logos-backup-${Date.now()}.json`);
    fs.writeFileSync(snapshot, JSON.stringify(companies, null, 2));
    console.log(JSON.stringify(companies.map(({ id, name, logo_url, website }) => ({ id, name,
      logo_url: logo_url?.startsWith('data:') ? '[existing uploaded image]' : logo_url, website })), null, 2));
    console.log(`Backup: ${snapshot}`);
    return;
  }
  const plan = JSON.parse(fs.readFileSync(path.join(directory, 'company-logo-plan.json'), 'utf8'));
  const results = [];
  for (const entry of plan) {
    if (companies.find(company=>company.id===entry.id)?.logo_url) {
      results.push({name:entry.name,status:'kept-existing'});
      continue;
    }
    // Re-read live values before each write to preserve logos the user added meanwhile.
    const current = (await readCompanies()).find((company) => company.id === entry.id);
    if (!current || current.logo_url) {
      results.push({ name: entry.name, status: 'kept-existing' });
      continue;
    }
    const response = await fetch(`${base}/api/companies`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: current.name, logo_url: entry.logo_url }),
      signal: AbortSignal.timeout(20000),
    });
    const body = await response.json();
    if (!response.ok || !body.success || body.data.id !== current.id || body.data.logo_url !== entry.logo_url) {
      throw new Error(`Logo update failed for ${current.name}: ${response.status}`);
    }
    results.push({ name: current.name, status: 'updated', source_url: entry.source_url });
    fs.writeFileSync(path.join(directory, 'company-logo-results.json'), JSON.stringify(results, null, 2));
  }
  fs.writeFileSync(path.join(directory, 'company-logo-results.json'), JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
}
run().catch((error) => { console.error(error.message); process.exitCode = 1; });
