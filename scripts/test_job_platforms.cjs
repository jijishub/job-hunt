const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { jobPlatformFromUrl, planRecords, localSnapshot, applyLocal, applyPostgres } = require('./backfill_job_platforms.cjs');

test('URLs classify deterministically without following links or trusting query parameters', () => {
  for (const [url, expected] of [
    ['https://www.linkedin.com/jobs/view/123?tracking=x','LINKEDIN'],
    ['https://ph.jobstreet.com/job/123','JOBSTREET'], ['https://bossjob.ph/en-us/job/example','BOSSJOB'],
    ['https://appficiency.bamboohr.com/careers/123','BAMBOOHR'], ['https://apply.workable.com/example','WORKABLE'],
    ['https://jobs.cvviz.com/company/job','CVVIZ'], ['https://jpmc.fa.oraclecloud.com/hcmUI/CandidateExperience','ORACLE_HCM'],
    ['https://offshorly.betterteam.com/example','BETTERTEAM'], ['https://joinbytedance.com/position/123','COMPANY_WEBSITE'],
    ['https://www.accenture.com/careers/job','COMPANY_WEBSITE'], ['https://absoluteindustrial.solutions/careers','COMPANY_WEBSITE'],
  ]) assert.equal(jobPlatformFromUrl(url).platform, expected, url);
  for (const url of ['https://linkedin.com.evil.test/jobs','https://evil.test/?next=https://linkedin.com/jobs','https://linkedin.com@evil.test/jobs','mailto:info@example.com','info@example.com','javascript:alert(1)','https://lnkd.in/short']) assert.equal(jobPlatformFromUrl(url).platform,null,url);
  assert.equal(jobPlatformFromUrl('https://careers.example.com/job','https://www.example.com').platform,'COMPANY_WEBSITE');
  assert.equal(jobPlatformFromUrl('https://example.com.evil.test/job','https://example.com').platform,null);
  assert.equal(jobPlatformFromUrl(' ').reason,'missing-url');
});

test('selected platforms remain intact and unmatched URLs are left unknown',()=>{
  const plan=planRecords([{id:'manual',job_platform:'Referral',job_url:'https://linkedin.com/jobs/1'},
    {id:'known',job_platform:' ',job_url:'https://linkedin.com/jobs/2'},
    {id:'unknown',job_url:'https://unrecognized.example/jobs/3'}, {id:'missing'}]);
  assert.equal(plan[0].reason,'preserved-platform');assert.equal(plan[0].platform,null);
  assert.equal(plan[1].platform,'LINKEDIN');assert.equal(plan[2].reason,'unknown-host');assert.equal(plan[3].reason,'missing-url');
});

test('local backfill touches only the selected account platforms and update times, and is idempotent',()=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'job-platform-backfill-test-'));const file=path.join(directory,'db.json');
  try {
    const row=(id,owner,extras={})=>({id,owner,job_url:'https://www.linkedin.com/jobs/123',status:'APPLIED',notes:'keep',stage_history:[{status:'APPLIED',at:'2026-09-01'}],date_applied:'2026-09-01',updated_at:'2026-09-02',role_fit_analysis:{fit:'STRONG'},...extras});
    const db={users:[{id:'mine',email:'mine@example.com'},{id:'other',email:'other@example.com'}],applications:[row('a','mine'),row('b','other'),row('manual','mine',{job_platform:'Referral'}),row('missing','mine',{job_url:null})],leads:[row('lead','mine',{status:'LEAD'})],companies:[]};
    fs.writeFileSync(file,JSON.stringify(db));const before=structuredClone(db);const snapshot=localSnapshot(file,'mine');
    const applied=applyLocal(file,snapshot,planRecords(snapshot.records));assert.equal(applied.length,2);
    const after=JSON.parse(fs.readFileSync(file,'utf8'));
    assert.deepEqual(after.applications[1],before.applications[1]);assert.deepEqual(after.applications[2],before.applications[2]);assert.deepEqual(after.applications[3],before.applications[3]);
    for(const app of [after.applications[0],after.leads[0]]){assert.equal(app.job_platform,'LINKEDIN');const original=before[app.id==='a'?'applications':'leads'][0];assert.deepEqual({...app,job_platform:undefined,updated_at:original.updated_at},{...original,job_platform:undefined});}
    const next=localSnapshot(file,'mine');const saved=fs.readFileSync(file,'utf8');assert.equal(applyLocal(file,next,planRecords(next.records)).length,0);assert.equal(fs.readFileSync(file,'utf8'),saved);
    const stale=localSnapshot(file,'mine');fs.appendFileSync(file,' ');assert.throws(()=>applyLocal(file,stale,planRecords(stale.records)),/Local data changed/);
  } finally {fs.rmSync(directory,{recursive:true,force:true});}
});

test('PostgreSQL applies only guarded platform updates and skips concurrently edited rows',async()=>{
  const statements=[];const sql=(strings,...values)=>{const query=strings.join('?');statements.push({query,values});return {query,values};};
  sql.transaction=async queries=>queries.map((query,index)=>index===1?[]:[{id:query.values[1],job_platform:query.values[0],updated_at:'2026-10-13'}]);
  const records=planRecords([{collection:'applications',id:'a',owner:'mine',job_url:'https://linkedin.com/jobs/1',updated_at:'old'},
    {collection:'leads',id:'b',owner:'mine',job_url:'https://linkedin.com/jobs/2',data:{id:'b',owner:'mine'}}]);
  const applied=await applyPostgres(sql,records);assert.equal(applied.length,1);assert.equal(applied[0].id,'a');
  assert.match(statements[0].query,/ADD COLUMN IF NOT EXISTS job_platform/);assert.equal(statements.length,3);
  assert.match(statements[1].query,/updated_at IS NOT DISTINCT FROM/);assert.match(statements[1].query,/job_url IS NOT DISTINCT FROM/);
  assert.match(statements[1].query,/nullif\(trim\(job_platform\)/);assert.match(statements[2].query,/AND data=/);
  assert.doesNotMatch(statements.map(row=>row.query).join('\n'),/SET status|stage_history|sync_status|role_fit|DELETE/);
});
