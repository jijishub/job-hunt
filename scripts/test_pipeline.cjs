const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const os=require('node:os');const Module=require('node:module');const ts=require('typescript');
const ROOT=path.resolve(__dirname,'..');
function loader(overrides={}){
 if(overrides['@/lib/db']) overrides['@/lib/db']={getCandidatePreferences:async()=>null,getCandidateProfile:async()=> 'Saved member master resume',claimPipelineInsight:async()=>true,savePipelineInsight:async()=>true,releasePipelineInsight:async()=>{},getPipelineInsight:async()=>null,...overrides['@/lib/db']};
 const cache=new Map();
 function load(file){
  const filename=path.resolve(ROOT,file);if(cache.has(filename))return cache.get(filename).exports;
  const m=new Module(filename,module);m.filename=filename;m.paths=Module._nodeModulePaths(path.dirname(filename));cache.set(filename,m);
  const original=m.require.bind(m);
  m.require=id=>{
   if(Object.hasOwn(overrides,id))return overrides[id];
   const target=id.startsWith('@/')?path.join(ROOT,'src',id.slice(2)):id.startsWith('.')?path.resolve(path.dirname(filename),id):null;
   if(target){
    if(target.endsWith('.png')){const bytes=fs.readFileSync(target);return {src:'data:image/png;base64,'+bytes.toString('base64'),width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20)};}
    if(target.endsWith('.json'))return original(target);if(fs.existsSync(target+'.ts'))return load(target+'.ts');
   }
   return original(id);
  };
  m._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,filename);return m.exports;
 }
 return load;
}
function insightFixture(){return {summary:'Saved history suggests reviewing targeting.',observations:[{text:'Review the submitted pipeline.',evidence:['pipeline.submitted'],claims:[]}],implications:[{text:'Recorded outcomes describe this history rather than predict hiring.',evidence:['pipeline.offerRate'],claims:[]}],recommendations:[{text:'Review relevant role requirements against your qualifications.',evidence:['pipeline.unassessed'],claims:[]}],limitations:[]};}
const sample=(values={})=>({id:'app',company_name:'Example',role_title:'Engineer',status:'APPLIED',owner:'user_ji',priority:'MEDIUM',job_type:'FULL_TIME',work_model:'ON_SITE',salary_currency:'PHP',sync_status:'SYNCED',created_at:'2026-10-10T00:00:00Z',updated_at:'2026-10-10T00:00:00Z',...values});

test('scoped database reads bind ownership and project company/status fields before transfer', async () => {
 const previous=process.env.POSTGRES_URL;const calls=[];
 const sql=async (parts,...values)=>{calls.push({text:parts.join('?'),values});return [{data:{owner:'member',company_id:'company'}}];};
 try {
  process.env.POSTGRES_URL='postgres://mock-only';
  const db=loader({'@neondatabase/serverless':{neon:()=>sql}})('src/lib/db.ts');
  const member={id:'member',email:'MEMBER@example.com',role:'member'};
  for(const projection of ['full','company','status']) {
   calls.length=0;const rows=await db.getApplications(true,member,projection);assert.equal(rows.length,2);
   assert.equal(calls.length,2);
   for(const call of calls){assert.match(call.text,/WHERE lower\(trim\(coalesce/);assert.ok(call.values.includes('member'));assert.ok(call.values.includes('member@example.com'));assert.ok(call.values.includes(false));assert.ok(call.values.includes(projection));assert.match(call.text,/jsonb_build_object\('notion_status'/);}
  }
  calls.length=0;await db.getApplications(false,{...member,id:'user_ji'},'company');assert.equal(calls.length,1);assert.ok(calls[0].values.includes(true));
 } finally {if(previous===undefined)delete process.env.POSTGRES_URL;else process.env.POSTGRES_URL=previous;}
});

test('RPA API reads private inputs only after admin authentication and has no published fallback',async()=>{
 let user=null,reads=0,profile=null;
 const load=loader({'@/lib/session-account':{getSessionAccount:async()=>user},'@/lib/rpa-profile':{readPrivateRpaProfile:async()=>{reads++;return profile;}}});
 const route=load('src/app/api/rpa/route.ts');const request=new Request('http://local/api/rpa');
 assert.equal((await route.GET(request)).status,401);assert.equal(reads,0);
 user={id:'member',role:'member'};assert.equal((await route.GET(request)).status,403);assert.equal(reads,0);
 user={id:'admin',role:'admin'};assert.equal((await route.GET(request)).status,422);assert.equal(reads,1);
 profile={basic_information:{name:'Test Applicant',email:'test@example.com',mobile:'test-phone',preferred_work_location:'Test Country'},self_introduction:'Test introduction'};
 const response=await route.GET(request);assert.equal(response.headers.get('Cache-Control'),'private, no-store');
 const result=await response.json();assert.deepEqual(result.data,profile);assert.match(result.bookmarklet,/Test Applicant/);assert.equal(result.local_command,'npm run rpa:bytedance');
});

test('private RPA profile supports environment and local input, rejects malformed data without exposing it',async()=>{
 const previous=process.env.RPA_PROFILE_JSON;let fileReads=0;
 const profile={basic_information:{name:'Test Applicant',mobile:'test-phone',email:'test@example.com',preferred_work_location:'Test Country'},self_introduction:'Test introduction'};
 try{
  delete process.env.RPA_PROFILE_JSON;
  const {readPrivateRpaProfile}=loader({'node:fs/promises':{readFile:async()=>{fileReads++;return JSON.stringify(profile);}}})('src/lib/rpa-profile.ts');
  assert.deepEqual(await readPrivateRpaProfile(),profile);assert.equal(fileReads,1);
  process.env.RPA_PROFILE_JSON=JSON.stringify({...profile,self_introduction:'Environment input'});assert.equal((await readPrivateRpaProfile()).self_introduction,'Environment input');assert.equal(fileReads,1);
  for(const raw of ['{bad','{}','[]',JSON.stringify({basic_information:{},self_introduction:'Missing fields'})]){process.env.RPA_PROFILE_JSON=raw;assert.equal(await readPrivateRpaProfile(),null);}
  delete process.env.RPA_PROFILE_JSON;
  const missing=loader({'node:fs/promises':{readFile:async()=>{throw Error('ENOENT');}}})('src/lib/rpa-profile.ts');assert.equal(await missing.readPrivateRpaProfile(),null);
 }finally{if(previous===undefined)delete process.env.RPA_PROFILE_JSON;else process.env.RPA_PROFILE_JSON=previous;}
});

test('analytics scopes and exports work without AI, and changes refresh deterministic metrics',async()=>{
 const user={id:'member',email:'member@example.com',role:'member'};
 let rows=[sample({owner:'member',date_applied:'2026-10-01'}),sample({id:'intern',owner:'member',job_type:'INTERNSHIP',role_title:'Junior Software Developer',date_applied:'2026-10-02'})];
 const load=loader({'@/lib/session-account':{getSessionAccount:async()=>user},'@/lib/db':{getAnalyticsApplications:async()=>rows},'@/lib/ai':{callGeminiJSON:()=>{throw Error('AI must not run');}}});
 const route=load('src/app/api/analytics/route.ts');
 const read=async scope=>(await (await route.GET(new Request(`http://local/api/analytics?scope=${scope}`))).json()).data;
 assert.equal((await read('ALL')).total,2);assert.equal((await read('INTERNSHIP')).total,1);assert.equal((await read('OTHER')).total,1);
 assert.equal((await read('ALL')).unassessed,2);
 rows.push(sample({id:'new',owner:'member',status:'OFFER'}));assert.equal((await read('ALL')).funnel[4].count,1);
 rows[0]={...rows[0],status:'INTERVIEWING'};assert.equal((await read('ALL')).funnel[2].count,2);
 const {analyticsPdf}=load('src/lib/analytics-export.ts');const {extractText}=require('unpdf');
 const pdf=await analyticsPdf(rows,'Member','All');const text=(await extractText(new Uint8Array(pdf.output('arraybuffer')),{mergePages:true})).text;
 assert.match(text,/Application effectiveness comparisons/);assert.match(text,/Job title keywords/);assert.doesNotMatch(text,/NaN|Infinity/);
 assert.equal((await route.GET(new Request('http://local/api/analytics?scope=forged'))).status,400);
});

test('role normalization, response cohorts and incomplete history use only recorded evidence',()=>{
 const load=loader();const {jobTitleKeywords}=load('src/lib/job-title-keywords.ts');const {seniorityLevel:seniority}=load('src/lib/application-analytics-fields.ts');const normalizedRole=title=>jobTitleKeywords(title).map(item=>item.key).join('|');
 assert.equal(normalizedRole('Jr. Software Developer'),'software|software developer|developer');assert.equal(normalizedRole('Custom Role'),'custom');
 assert.equal(normalizedRole('Constructor'),'constructor');assert.equal(normalizedRole('Senior Constructor'),'constructor');
 assert.equal(seniority('Senior Engineer'),'SENIOR');assert.equal(seniority('Engineer'),'UNSPECIFIED');
 const {pipelineAnalytics}=load('src/lib/analytics.ts');
 const rows=[sample({id:'a',role_title:'Junior Software Developer',date_applied:'2026-10-01',first_response_at:'2026-10-04T00:00:00Z',status:'OFFER',source:'LINKEDIN',stage_history:[{status:'APPLIED',at:'2026-10-01'},{status:'SCREENING',at:'2026-10-04'},{status:'OFFER',at:'2026-10-08'}]}),sample({id:'b',date_applied:'2026-10-01',status:'WITHDRAWN',stage_history:[{status:'WITHDRAWN',at:'2026-10-03'}]}),sample({id:'c',role_title:undefined,date_applied:'bad',status:'REJECTED',stage_history:[{status:'REJECTED',at:'2026-10-05'}]}),sample({id:'d',date_applied:'2026-10-02',status:'OFFER'})];
 const stats=pipelineAnalytics(rows,{},undefined,new Date('2026-10-13'));
 assert.equal(pipelineAnalytics([sample({role_title:'Constructor'})]).dimensions.keywords[0].label,'Constructor');
 const cohort=stats.dimensions.cohorts.find(row=>row.label==='2026-10');assert.equal(cohort.submitted,3);assert.equal(cohort.responses,1);assert.equal(cohort.medianCallbackDays,3);
 assert.equal(stats.dimensions.cohorts.find(row=>row.label==='Unknown').responses,0);
 assert.equal(stats.dimensions.qualifications[0].label,'UNASSESSED');assert.equal(stats.dimensions.missingResponseDates,3);
 assert.equal(stats.dimensions.platforms.find(row=>row.label==='LINKEDIN').offers,1);
});

test('optional interpretation failures leave deterministic analytics available',async()=>{
 for(const failure of [new Error('AI unavailable'),new Error('API key missing'),Object.assign(new Error('Timed out'),{name:'TimeoutError'})]){
  const load=loader({'@/lib/session-account':{getSessionAccount:async()=>({id:'member',email:'member@example.com',role:'member'})},'@/lib/db':{getAnalyticsApplications:async()=>[sample()]},'@/lib/ai':{callGeminiJSON:async()=>{throw failure;}}});
  const analyze=load('src/app/api/analytics/analyze/route.ts');assert.equal((await analyze.POST(new Request('http://local',{method:'POST',body:'{}'}))).status,502);
  const metrics=load('src/app/api/analytics/route.ts');assert.equal((await metrics.GET(new Request('http://local/api/analytics'))).status,200);
 }
});

test('saved assessment fallback respects manual overrides and missing historical fields',()=>{
 const {pipelineAnalytics}=loader()('src/lib/analytics.ts');
 const result=pipelineAnalytics([sample({id:'saved',role_fit_analysis:{fit:'STRONG'}}),sample({id:'manual',role_fit:'WEAK',role_fit_analysis:{fit:'STRONG'}}),sample({id:'legacy',status:undefined,role_title:undefined,date_applied:undefined,source:undefined})]);
 assert.equal(result.assessed,2);assert.equal(result.unassessed,1);assert.equal(result.fits.find(row=>row.value==='STRONG').total,1);assert.equal(result.fits.find(row=>row.value==='WEAK').total,1);
});

test('analytics database query binds identity and scope and preserves regex boundaries',async()=>{
 const previous=process.env.POSTGRES_URL;let query,params;
 const sql=async(strings,...values)=>{query=strings.join('?');params=values;return [{data:sample()}];};
 try{
  process.env.POSTGRES_URL='postgres://mock-only';
  const db=loader({'@neondatabase/serverless':{neon:()=>sql}})('src/lib/db.ts');
  assert.equal((await db.getAnalyticsApplications({id:'MEMBER',email:'Member@example.com',role:'member'},'INTERNSHIP')).length,1);
  assert.match(query,/UNION ALL/);assert.match(query,/lower\(trim\(coalesce\(owner/);assert.match(query,/job_description/);
  assert.equal(params.filter(value=>value==='member').length,2);assert.equal(params.filter(value=>value==='member@example.com').length,2);
  assert.equal(params.filter(value=>value===String.raw`\mintern(ship)?\M`).length,2);
  assert.equal(params.filter(value=>value===false).length,4);assert.equal(params.filter(value=>value===true).length,2);
 }finally{if(previous===undefined)delete process.env.POSTGRES_URL;else process.env.POSTGRES_URL=previous;}
});

test('all seniority levels derive from explicit titles and manual overrides survive title edits',()=>{
 const {seniorityLevel,analyticsFieldUpdates}=loader()('src/lib/application-analytics-fields.ts');
 for(const [title,level] of [['AI Intern','INTERNSHIP_TRAINEE'],['Engineer Trainee','INTERNSHIP_TRAINEE'],['Graduate Engineer','GRADUATE_ENTRY_LEVEL'],['Entry-level Engineer','GRADUATE_ENTRY_LEVEL'],['Junior AI Engineer','JUNIOR'],['Associate Engineer','ASSOCIATE'],['Mid-level Engineer','MID_LEVEL'],['Intermediate Engineer','MID_LEVEL'],['Senior Engineer','SENIOR'],['Principal Engineer','LEAD_PRINCIPAL'],['Team Lead','LEAD_PRINCIPAL'],['AI Engineer','UNSPECIFIED']]) assert.equal(seniorityLevel(title),level,title);
 const derived=analyticsFieldUpdates(null,{role_title:'Junior Software Developer'});assert.equal(derived.seniority_level,'JUNIOR');assert.equal(derived.role_family,undefined);assert.equal(derived.seniority_level_source,'derived');
 const saved={...sample({role_title:'Junior Software Developer'}),...derived};
 const renamed={...saved,role_title:'Senior AI Engineer',...analyticsFieldUpdates(saved,{role_title:'Senior AI Engineer'})};assert.equal(renamed.seniority_level,'SENIOR');assert.equal(renamed.role_family,undefined);
 const manual={...renamed,role_family:'Applied AI',role_family_source:'manual',...analyticsFieldUpdates(renamed,{seniority_level:'ASSOCIATE'})};assert.equal(manual.seniority_level_source,'manual');assert.equal(manual.role_family_source,'manual');
 const changed={...manual,role_title:'Junior Developer',...analyticsFieldUpdates(manual,{role_title:'Junior Developer'})};assert.equal(changed.seniority_level,'ASSOCIATE');assert.equal(changed.role_family,'Applied AI');
 const reset=analyticsFieldUpdates(changed,{seniority_level:null,role_family:null});assert.equal(reset.seniority_level,'JUNIOR');assert.equal(reset.role_family,undefined);assert.equal(reset.role_family_source,undefined);
});

test('classification, platform and response fields validate and affect deterministic comparisons',()=>{
 const load=loader();const {applicationValidationError}=load('src/lib/application-validation.ts');
 for(const body of [{seniority_level:'MID'},{seniority_level_source:'ai'},{role_family_source:'ai'},{job_platform:42},{role_family:{}},{first_response_at:'2026-10-05'},{first_response_at:'invalid'}])assert.ok(applicationValidationError(body));
 assert.equal(applicationValidationError({seniority_level:'JUNIOR',job_platform:'Bossjob',role_family:'Applied AI',first_response_at:'2026-10-05T12:00:00+08:00'}),null);
 const {pipelineAnalytics}=load('src/lib/analytics.ts');
 const stats=pipelineAnalytics([sample({role_title:'Senior Engineer',seniority_level:'JUNIOR',seniority_level_source:'manual',role_family:'Applied AI',role_family_source:'manual',source:'DIRECT',job_platform:'Bossjob',date_applied:'2026-10-01',first_response_at:'2026-10-05T12:00:00+08:00',stage_history:[{status:'SCREENING',at:'2026-10-08'}]})],{},undefined,new Date('2026-10-13'));
 assert.equal(stats.dimensions.seniority[0].label,'Junior');assert.equal(stats.dimensions.keywords[0].label,'Engineer');assert.ok(!stats.dimensions.keywords.some(row=>row.label==='Applied AI'));assert.equal(stats.dimensions.platforms[0].label,'BOSSJOB');assert.equal(stats.dimensions.cohorts[0].medianCallbackDays,4);
});

test('local persistence keeps derived and manual fields through lead promotion and status changes',async()=>{
 const original=process.cwd(),directory=fs.mkdtempSync(path.join(os.tmpdir(),'job-analytics-fields-')),env={POSTGRES_URL:process.env.POSTGRES_URL,DATABASE_URL:process.env.DATABASE_URL,VERCEL:process.env.VERCEL};
 try{
  for(const key of Object.keys(env))delete process.env[key];process.chdir(directory);
  const db=loader()('src/lib/db.ts');const lead=await db.createApplication(sample({status:'LEAD',role_title:'Junior AI Engineer',job_platform:'Bossjob',first_response_at:'2026-10-05T12:30:00Z'}));
  assert.equal(lead.seniority_level,'JUNIOR');assert.equal(lead.role_family,undefined);
  await db.updateApplication(lead.id,{status:'APPLIED'});await db.updateApplication(lead.id,{role_title:'Senior AI Engineer'});
  let saved=await db.getApplicationById(lead.id);assert.equal(saved.seniority_level,'SENIOR');assert.equal(saved.job_platform,'BOSSJOB');assert.equal(saved.first_response_at,'2026-10-05T12:30:00.000Z');
  await db.updateApplication(lead.id,{seniority_level:'JUNIOR',role_family:'Applied AI',role_family_source:'manual'});await db.updateApplication(lead.id,{role_title:'Lead Engineer',status:'INTERVIEWING'});
  saved=await db.getApplicationById(lead.id);assert.equal(saved.seniority_level,'JUNIOR');assert.equal(saved.role_family,'Applied AI');assert.equal(saved.role_family_source,'manual');
  await db.updateApplication(lead.id,{seniority_level:null,first_response_at:null});saved=await db.getApplicationById(lead.id);assert.equal(saved.seniority_level,'LEAD_PRINCIPAL');assert.equal(saved.role_family,'Applied AI');assert.equal(saved.first_response_at,null);
 }finally{process.chdir(original);for(const [key,value]of Object.entries(env)){if(value===undefined)delete process.env[key];else process.env[key]=value;}fs.rmSync(directory,{recursive:true,force:true});}
});

test('application aging separates active unanswered records from callbacks and unknown dates',()=>{
 const {pipelineAnalytics}=loader()('src/lib/analytics.ts');
 const rows=[
  sample({id:'day0',date_applied:'2026-10-13'}),sample({id:'day7',date_applied:'2026-10-06'}),
  sample({id:'day8',date_applied:'2026-10-05'}),sample({id:'day14',date_applied:'2026-09-29'}),
  sample({id:'day15',date_applied:'2026-09-28'}),sample({id:'day30',date_applied:'2026-09-13'}),sample({id:'day31',date_applied:'2026-09-12'}),
  sample({id:'missing'}),sample({id:'invalid',date_applied:'bad'}),sample({id:'future',date_applied:'2026-10-14'}),
  sample({id:'responded',date_applied:'2026-09-01',first_response_at:'2026-09-06T00:00:00Z'}),
  sample({id:'undated-interview',date_applied:'2026-09-01',status:'INTERVIEWING',stage_history:[{status:'INTERVIEWING',at:'2026-09-08'}]}),
  sample({id:'rejected',date_applied:'2026-09-01',status:'REJECTED'}),sample({id:'withdrawn',date_applied:'2026-09-01',status:'WITHDRAWN'}),
  sample({id:'archived',date_applied:'2026-09-01',not_proceeding:true}),sample({id:'lead',date_applied:'2026-09-01',status:'LEAD'})
 ];
 const stats=pipelineAnalytics(rows,{},undefined,new Date('2026-10-13'));
 assert.equal(stats.total,16);assert.equal(stats.timing.submitted,15);assert.equal(stats.timing.pending,10);
 assert.deepEqual(stats.timing.buckets.map(row=>row.pending),[2,2,2,1]);assert.equal(stats.timing.pendingUnknownAges,3);
 assert.equal(stats.timing.missingSubmissionDates,1);assert.equal(stats.timing.invalidSubmissionDates,1);assert.equal(stats.timing.futureSubmissionDates,1);
 assert.deepEqual(stats.timing.callbacks,{count:1,averageDays:5,medianDays:5});assert.equal(stats.timing.unknownResponseTiming,4);
 assert.equal(stats.dimensions.cohorts.find(row=>row.label==='2026-09').responses,1);
 assert.equal(pipelineAnalytics(rows,{},undefined,new Date('2026-10-14')).timing.buckets[0].pending,2);
});

test('7/14/30-day response rates use mature cohorts and exclude unknown event timing',()=>{
 const {pipelineAnalytics}=loader()('src/lib/analytics.ts');
 const rows=[sample({id:'fast',date_applied:'2026-09-01',first_response_at:'2026-09-06T00:00:00Z'}),
  sample({id:'slow',date_applied:'2026-09-01',first_response_at:'2026-09-21T00:00:00Z'}),
  sample({id:'waiting',date_applied:'2026-09-01'}),
  sample({id:'unknown',date_applied:'2026-09-01',status:'OFFER',stage_history:[{status:'OFFER',at:'2026-09-05'}]}),
  sample({id:'recent',date_applied:'2026-10-12',first_response_at:'2026-10-13T00:00:00Z'}),
  sample({id:'missing-date',first_response_at:'2026-10-01T00:00:00Z'})];
 const stats=pipelineAnalytics(rows,{},undefined,new Date('2026-10-13'));
 assert.deepEqual(stats.timing.windows.map(row=>row.responseRate),[33,33,67]);
 for(const row of stats.timing.windows){assert.equal(row.mature,4);assert.equal(row.eligible,3);assert.equal(row.unknownTiming,1);assert.equal(row.immature,1);}
 assert.deepEqual(stats.timing.callbacks,{count:3,averageDays:8.7,medianDays:5});
 const noTiming=pipelineAnalytics([sample({date_applied:'2026-09-01',status:'INTERVIEWING'})],{},undefined,new Date('2026-10-13'));
 assert.equal(noTiming.timing.windows[0].responseRate,null);assert.equal(noTiming.timing.callbacks.count,0);assert.equal(noTiming.timing.pending,0);
});

test('age boundaries validate and change grouping without writing per-application ages',()=>{
 const load=loader();const {validatePreferences}=load('src/lib/preferences.ts');
 for(const value of [[7,7,30],[30,14,7],[0,14,30],[7,14],[7,14,30.5],[7,14,4000],['7',14,30]])assert.throws(()=>validatePreferences({analytics_age_boundaries:value}));
 assert.deepEqual(validatePreferences({}).analytics_age_boundaries,[7,14,30]);assert.deepEqual(validatePreferences({analytics_age_boundaries:[3,10,20]}).analytics_age_boundaries,[3,10,20]);
 const app=sample({date_applied:'2026-10-05'});const original=JSON.stringify(app);
 const stats=load('src/lib/analytics.ts').pipelineAnalytics([app],{},undefined,new Date('2026-10-13'),[3,10,20]);
 assert.deepEqual(stats.timing.buckets.map(row=>row.pending),[0,1,0,0]);assert.equal(stats.timing.buckets[3].label,'21+ days');assert.equal(JSON.stringify(app),original);
});

test('admin and member archive and restore preserve recruitment status and never enqueue Notion writes',async()=>{
 for(const role of ['admin','member']){
  const user={id:role==='admin'?'user_ji':'member',email:role+'@example.com',role,notion_enabled:role==='admin'};let queued=0;
  let saved=sample({owner:user.id,status:'INTERVIEWING',notion_status:'Initial Interview',last_synced_at:'2026-10-10',stage_history:[{status:'APPLIED',notion_status:'Applied',at:'2026-10-08'}]});
  const route=loader({'@/lib/session-account':{getSessionAccount:async()=>user},'@/lib/db':{getApplicationById:async()=>saved,updateApplication:async(_id,updates)=>saved={...saved,...updates}},'@/lib/application-notion-sync':{scheduleApplicationNotionSync:()=>queued++}})('src/app/api/applications/[id]/route.ts');
  const update=body=>route.PUT(new Request('http://local',{method:'PUT',body:JSON.stringify(body)}),{params:Promise.resolve({id:'app'})});
  assert.equal((await update({not_proceeding:true,analytics_stage:'OFFER'})).status,200);
  assert.equal(saved.status,'INTERVIEWING');assert.equal(saved.notion_status,'Initial Interview');assert.equal(saved.analytics_stage,'INTERVIEW');assert.equal(saved.not_proceeding,true);assert.equal(saved.sync_status,'SYNCED');assert.equal(saved.last_synced_at,'2026-10-10');assert.equal(queued,0);
  assert.equal((await update({not_proceeding:false})).status,200);assert.equal(saved.not_proceeding,false);assert.equal(saved.status,'INTERVIEWING');assert.equal(queued,0);
  await update({status:'INTERVIEWING',notion_status:'Final Interview'});assert.equal(saved.analytics_stage,'FINAL');assert.equal(queued,role==='admin'?1:0);
 }
});

test('legacy withdrawals restore their previous status and historical phase remains automatic',()=>{
 const workflow=loader()('src/lib/application-workflow.ts');
 const archived=sample({status:'WITHDRAWN',notion_status:'Not Proceeding',stage_history:[{status:'INTERVIEWING',notion_status:'Final Interview',at:'2026-10-09'}]});
 const restored=workflow.applicationWorkflowUpdates(archived,{status:'WITHDRAWN',not_proceeding:false});
 assert.equal(restored.status,'INTERVIEWING');assert.equal(restored.notion_status,'Final Interview');assert.equal(restored.analytics_stage,'FINAL');assert.equal(workflow.isArchivedApplication({...archived,...restored}),false);
 const source=sample({status:'INTERVIEWING',notion_status:'Interview'});const withdrawn=workflow.applicationWorkflowUpdates(source,{status:'WITHDRAWN',notion_status:'Not Proceeding'});
 assert.equal(withdrawn.status,'INTERVIEWING');assert.equal(withdrawn.notion_status,'Interview');assert.equal(workflow.displayApplicationStatusLabel({...source,...withdrawn}),'Not Proceeding');
});

test('existing admin industry preset matches the member option without changing custom or member tags',async()=>{
 const previous=process.env.POSTGRES_URL;const rows=[{id:'user_ji',name:'Jizelle Casia',industry:'IT / AI & Forward-Deployed Software'},{id:'member',name:'Member',industry:'IT / AI & Forward-Deployed Software'}];const writes=[];
 const sql=(strings,...values)=>{const query=strings.join('?');if(query.startsWith('SELECT'))return Promise.resolve(rows);writes.push({query,values});return Promise.resolve([]);};
 try{
  process.env.POSTGRES_URL='postgres://mock-only';const db=loader({'@neondatabase/serverless':{neon:()=>sql}})('src/lib/db.ts');
  const users=await db.getUsers();assert.equal(users[0].industry,'IT / AI & Software');assert.equal(users[1].industry,'IT / AI & Forward-Deployed Software');assert.equal(writes.length,1);assert.deepEqual(writes[0].values,['IT / AI & Software','user_ji']);
  rows[0].industry='My custom industry';writes.length=0;await db.getUsers();assert.equal(rows[0].industry,'My custom industry');assert.equal(writes.length,0);
 }finally{if(previous===undefined)delete process.env.POSTGRES_URL;else process.env.POSTGRES_URL=previous;}
});

test('application validation rejects malformed objects and coerced salaries while preserving numeric strings and zero',()=>{
 const {applicationValidationError}=loader()('src/lib/application-validation.ts');
 for(const value of [null,[],false,'draft'])assert.match(applicationValidationError(value),/application object/);
 for(const value of [false,[],{},' '])assert.match(applicationValidationError({salary_min:value}),/nonnegative/);
 for(const value of [0,'0','12500.50'])assert.equal(applicationValidationError({salary_min:value}),null);
 assert.match(applicationValidationError({job_url:false}),/http/);
 assert.match(applicationValidationError({is_lead:'false'}),/lead flag/);
 assert.match(applicationValidationError({contact_email:123}),/must be text/);
});

test('Google setup generates a random auth secret once and preserves existing secrets',async()=>{
 const keys=['GOOGLE_CLIENT_ID','GOOGLE_CLIENT_SECRET','NEXTAUTH_SECRET'];const previous=Object.fromEntries(keys.map(key=>[key,process.env[key]]));let content='';
 try{
  for(const key of keys)delete process.env[key];
  const route=loader({'@/lib/session-account':{getSessionAccount:async()=>({id:'admin',role:'admin'})},fs:{existsSync:()=>Boolean(content),readFileSync:()=>content,writeFileSync:(_file,value)=>{content=value;}}})('src/app/api/settings/google/route.ts');
  const request=()=>new Request('http://local/api/settings/google',{method:'POST',body:JSON.stringify({clientId:'example-client',clientSecret:'example-secret'})});
  assert.equal((await route.POST(request())).status,200);const secret=content.match(/^NEXTAUTH_SECRET=(.+)$/m)?.[1];
  assert.match(secret,/^[a-f0-9]{64}$/);assert.equal(process.env.NEXTAUTH_SECRET,secret);
  assert.equal((await route.POST(request())).status,200);assert.equal(content.match(/^NEXTAUTH_SECRET=(.+)$/m)?.[1],secret);
 }finally{for(const [key,value]of Object.entries(previous)){if(value===undefined)delete process.env[key];else process.env[key]=value;}}
});

test('application saves return before Notion work, and background failures remain retryable',async()=>{
 const callbacks=[];let saved=sample();let pushes=0;let fail=false;let release;
 const blocked=new Promise(resolve=>release=resolve);
 const load=loader({
  'next/server':{...require('next/server'),after:callback=>callbacks.push(callback)},
  '@/lib/session-account':{getSessionAccount:async()=>({id:'user_ji',role:'admin',notion_enabled:true})},
  '@/lib/db':{getApplicationById:async()=>saved,getCompanies:async()=>[],getOrCreateCompany:async()=>({id:'company',name:'Example'}),createApplication:async data=>(saved={...sample(),...data}),updateApplication:async(id,data)=>(saved={...saved,...data})},
  '@/lib/notion':{pushApplicationToNotion:async app=>{pushes++;assert.equal(app.notes,saved.notes);if(fail)throw Error('Notion unavailable');await blocked;saved={...saved,sync_status:'SYNCED'};}}
 });
 const req=body=>new Request('http://local',{method:'POST',body:JSON.stringify(body)});
 const create=load('src/app/api/applications/route.ts');
 const response=await create.POST(req({company_name:'Example',role_title:'Engineer',status:'APPLIED'}));
 assert.equal(response.status,201);assert.equal((await response.json()).data.sync_status,'PENDING');assert.equal(pushes,0);assert.equal(callbacks.length,1);
 saved.notes='Newer saved notes';
 const running=callbacks.shift()();await new Promise(resolve=>setImmediate(resolve));
 assert.equal(pushes,1);assert.equal(saved.sync_status,'PENDING');release();await running;assert.equal(saved.sync_status,'SYNCED');
 const edit=load('src/app/api/applications/[id]/route.ts');
 assert.equal((await edit.PUT(req({notes:'Updated note'}),{params:Promise.resolve({id:saved.id})})).status,200);
 assert.equal(pushes,1);assert.equal(callbacks.length,1);
 fail=true;await callbacks.shift()();assert.equal(saved.sync_status,'ERROR');assert.equal(saved.notes,'Updated note');
 await create.POST(req({company_name:'Example',role_title:'Lead',status:'LEAD'}));assert.equal(callbacks.length,0);
});

test('normal PostgreSQL requests skip schema maintenance; migrations run explicitly',async()=>{
 const previous=process.env.POSTGRES_URL;let queries=[];
 const sql=(strings)=>{queries.push(strings.join('?'));return Promise.resolve([]);};sql.transaction=async items=>Promise.all(items);
 try{
  process.env.POSTGRES_URL='postgres://mock-only';
  const db=loader({'@neondatabase/serverless':{neon:()=>sql}})('src/lib/db.ts');
  await db.getCompanies();assert.equal(queries.length,1);assert.match(queries[0],/SELECT/);
  queries=[];await db.migrateDatabase();assert.ok(queries.some(query=>/CREATE TABLE/.test(query)));assert.ok(queries.some(query=>/duplicate_applications_archive/.test(query)));
  queries=[];await db.getCompanies();assert.equal(queries.length,1);
  const migration=require('./migrate_db.cjs');assert.equal(typeof migration.loadTypescript(path.join(ROOT,'src/lib/db.ts')).migrateDatabase,'function');
 }finally{if(previous===undefined)delete process.env.POSTGRES_URL;else process.env.POSTGRES_URL=previous;}
});

test('sign-in refreshes a member photo without requiring a name change',async()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'jobhunt-avatar-'));const original=process.cwd();
 const env={POSTGRES_URL:process.env.POSTGRES_URL,DATABASE_URL:process.env.DATABASE_URL,VERCEL:process.env.VERCEL};
 try{
  for(const key of Object.keys(env))delete process.env[key];process.chdir(directory);
  const db=loader()('src/lib/db.ts');
  const invited=await db.createUser({name:'Member Example',email:'photo@example.com',industry:'Tourism',avatar:'https://example.com/old.jpg',role:'member'});
  const signedIn=await db.getOrCreateUser({name:invited.name,email:invited.email,avatar:'https://example.com/new.jpg'});
  assert.equal(signedIn.id,invited.id);assert.equal(signedIn.name,invited.name);assert.equal(signedIn.avatar,'https://example.com/new.jpg');
  const persisted=await db.getUserByEmail(invited.email);assert.equal(persisted.avatar,signedIn.avatar);assert.equal(persisted.industry,'Tourism');assert.equal(persisted.role,'member');assert.equal(persisted.notion_enabled,false);
  const unchanged=await db.getOrCreateUser({name:invited.name,email:invited.email});assert.equal(unchanged.avatar,signedIn.avatar);
  const renamed=await db.getOrCreateUser({name:'Updated Member Name',email:invited.email});assert.equal(renamed.name,'Updated Member Name');assert.equal(renamed.avatar,signedIn.avatar);
 }finally{process.chdir(original);for(const [key,value]of Object.entries(env)){if(value===undefined)delete process.env[key];else process.env[key]=value;}fs.rmSync(directory,{recursive:true,force:true});}
});

test('search links keep keywords separate from location and use JobStreet keyword paths',()=>{
 const {JOB_SEARCH_PLATFORMS,jobSearchUrl}=loader()('src/lib/job-search-links.ts');
 assert.equal(JOB_SEARCH_PLATFORMS.length,4);
 assert.equal(jobSearchUrl('jobstreet',' Hospitality Management ','Metro Manila'),'https://ph.jobstreet.com/hospitality-management-jobs');
 assert.equal(jobSearchUrl('jobstreet','C++ / C#'),'https://ph.jobstreet.com/c%2B%2B-%2F-c%23-jobs');
 const linkedin=new URL(jobSearchUrl('linkedin','AI & Automation','Las Piñas'));
 assert.equal(linkedin.searchParams.get('keywords'),'AI & Automation');assert.equal(linkedin.searchParams.get('location'),'Las Piñas');
 const indeed=new URL(jobSearchUrl('indeed','Front Office Associate','Metro Manila'));
 assert.equal(indeed.searchParams.get('q'),'Front Office Associate');assert.equal(indeed.searchParams.get('l'),'Metro Manila');
 const google=new URL(jobSearchUrl('google','Reservations Associate','Philippines'));
 assert.equal(google.searchParams.get('q'),'Reservations Associate Philippines jobs');assert.equal(google.searchParams.get('ibp'),'htl;jobs');
});

test('AI keyword generation supports role-only ideas without inventing salary or choosing a platform',async()=>{
 const previousFetch=global.fetch;const previousKey=process.env.AI_API_KEY;
 try{
  process.env.AI_API_KEY='test-key';let prompt;
  global.fetch=async(_url,options)=>{prompt=JSON.parse(options.body);return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({leads:[{id:'keyword',title:' Front Office Associate ',description:'Search entry-level hotel roles',salary_range:'invented'},{title:'   '},null]})}}]}));};
  const {generateTailoredLeads}=loader()('src/lib/ai.ts');const ideas=await generateTailoredLeads({profileText:'Hotel front office internship',targetRole:'Hospitality Management',locationPreference:'Philippines'});
  assert.equal(ideas.length,1);assert.equal(ideas[0].title,'Front Office Associate');assert.equal(ideas[0].company_name,'');assert.equal(ideas[0].salary_range,undefined);
  assert.match(prompt.messages[0].content,/Do not require an employer name/);assert.match(prompt.messages[0].content,/user's choice/);assert.match(prompt.messages[1].content,/Hotel front office internship/);
 }finally{global.fetch=previousFetch;if(previousKey===undefined)delete process.env.AI_API_KEY;else process.env.AI_API_KEY=previousKey;}
});

test('charts partition unique records, distinguish inferred interviews, and exclude invalid activity dates',()=>{
 const {pipelineAnalytics,applicationDay}=loader()('src/lib/analytics.ts');
 const rows=[sample({id:'offer',status:'ACCEPTED',role_fit:'STRONG',date_applied:'2026-10-12'}),sample({id:'offer',status:'APPLIED',updated_at:'2026-10-09'}),sample({id:'lead',status:'LEAD',role_fit:'POSSIBLE'}),sample({id:'rejected',status:'REJECTED',notion_status:'Not Accepted',date_applied:'2026-09-13',role_fit:'WEAK',stage_history:[{status:'INTERVIEWING',notion_status:'Final Interview'}]}),sample({id:'invalid',date_applied:'2026-02-30'}),sample({id:'future',date_applied:'2026-10-13'}),sample({id:'missing'}),sample({id:'old',date_applied:'2026-09-12'})];
 const stats=pipelineAnalytics(rows,{},undefined,new Date('2026-10-12T05:00:00Z'));
 assert.equal(stats.total,7); assert.equal(stats.submitted,6);assert.equal(stats.quality.duplicateRecords,1);
 assert.equal(stats.fits.reduce((n,f)=>n+f.total,0),stats.total);assert.equal(stats.outcomes.reduce((n,o)=>n+o.count,0),stats.total);
 assert.equal(stats.fits.reduce((n,f)=>n+f.submitted,0),stats.submitted);
 assert.deepEqual(stats.funnel[3],{label:'Final interview',phase:'FINAL',count:2,recorded:1,inferred:1});
 assert.equal(stats.recent,2);assert.equal(stats.activity.at(-1).count,1);assert.equal(stats.activity.at(-2).count,2);
 assert.equal(stats.quality.missingDates,1);assert.equal(stats.quality.invalidDates,1);assert.equal(stats.quality.futureDates,1);
 assert.equal(applicationDay('2026-10-11T18:00:00Z'),'2026-10-12');assert.equal(applicationDay('2026-02-30'),null);
 assert.equal(stats.fits[1].offerRate,null);assert.equal(pipelineAnalytics([]).coverage,null);
 const closed=pipelineAnalytics([sample({status:'REJECTED',notion_status:'Rejected'})]);assert.equal(closed.outcomes.find(o=>o.key==='OTHER_CLOSED').count,1);assert.equal(closed.rejections,0);
});

test('member AI uses the saved master resume and ATS uses requirements, never personal notes',async()=>{
 const member={id:'member',email:'member@example.com',role:'member'};let input,profile='Master version 1';
 const app=sample({id:'mine',owner:'member',information:'Build Python APIs and maintain reliable SQL databases.',notes:'Private interview feedback, not job requirements.'});
 const load=loader({'@/lib/session-account':{getSessionAccount:async()=>member},'@/lib/db':{getCandidateProfile:async id=>{assert.equal(id,'member');return profile;},getApplicationById:async()=>app,getAnalyticsApplications:async()=>[app]},'@/lib/portfolio-evidence':{portfolioEvidence:async()=>{throw Error('Member accessed admin portfolio');}},'@/lib/ai':{analyzeResumeWithGemini:async data=>{input=data;return {};},generateTailoredLeads:async data=>{input=data;return [];},matchLeadsWithProfile:async data=>{input=data;return [];},generateLeadPitch:async data=>{input=data;return {};},callGeminiJSON:async(system,data)=>{input=JSON.parse(data);return insightFixture();}}});
 const request=data=>new Request('http://local',{method:'POST',body:JSON.stringify(data)});
 const ats=load('src/app/api/ai/analyze/route.ts');assert.equal((await ats.POST(request({applicationId:'mine',resumeText:'Forged stale resume',jobDescription:'Wrong requirement'}))).status,200);assert.equal(input.resumeText,profile);assert.equal(input.jobDescription,app.information);assert.equal(input.jobDescription.includes(app.notes),false);
 profile='Master version 2';const pipeline=load('src/app/api/analytics/analyze/route.ts');assert.equal((await pipeline.POST(request({owner:'other',stats:{total:999}}))).status,200);assert.equal(input.total,1);assert.equal(input.candidate.resume,profile);assert.equal(input.candidate.source,'master_resume');
 for(const [path,body] of [['generate',{targetRole:'Developer'}],['ai-match',{leads:[{id:'x',title:'Developer',company_name:'Example'}]}],['pitch',{leadTitle:'Developer',companyName:'Example'}]]){assert.equal((await load('src/app/api/leads/'+path+'/route.ts').POST(request({...body,profileText:'Forged'}))).status,200);assert.equal(input.profileText,profile);}
 profile='';assert.equal((await pipeline.POST(request({}))).status,200);assert.equal(input.candidate.source,'missing');
 assert.equal((await ats.POST(request({jobDescription:'Job title only'}))).status,400);
});

test('admin evidence prefers master resume and only falls back to the live portfolio',async()=>{
 let profile='Master resume',calls=0;
 const {candidateEvidence}=loader({'@/lib/db':{getCandidateProfile:async()=>profile},'@/lib/portfolio-evidence':{portfolioEvidence:async()=>{calls++;return 'Published portfolio';}}})('src/lib/candidate-evidence.ts');
 const admin={id:'admin',email:'jizelle.casia@gmail.com',role:'admin'};
 assert.equal((await candidateEvidence(admin)).source,'master_resume');assert.equal(calls,0);profile='';assert.equal((await candidateEvidence(admin)).source,'portfolio');assert.equal(calls,1);assert.equal((await candidateEvidence({...admin,role:'member'})).source,'missing');assert.equal(calls,1);
});

test('ATS preserves a zero score and rejects missing scores instead of inventing 75 percent',async()=>{
 const savedFetch=global.fetch, savedKey=process.env.AI_API_KEY;let result={matchScore:0,summary:'No relevant experience.'};
 try{process.env.AI_API_KEY='unit-test-key';global.fetch=async()=>new Response(JSON.stringify({choices:[{message:{content:JSON.stringify(result)}}]}));
  const {analyzeResumeWithGemini}=loader()('src/lib/ai.ts');const args={resumeText:'Unrelated resume',jobDescription:'Required engineering experience.'};
  assert.equal((await analyzeResumeWithGemini(args)).matchScore,0);result={summary:'Incomplete response'};await assert.rejects(()=>analyzeResumeWithGemini(args),/invalid resume assessment/);
 }finally{global.fetch=savedFetch;if(savedKey===undefined)delete process.env.AI_API_KEY;else process.env.AI_API_KEY=savedKey;}
});

test('ATS can finish a streamed body after the short AI deadline and bounds report output',async context=>{
 const savedFetch=global.fetch,savedTimeout=AbortSignal.timeout,savedKey=process.env.AI_API_KEY,budgets=[],requests=[];
 context.mock.timers.enable({apis:['setTimeout']});
 try{
  process.env.AI_API_KEY='unit-test-key';
  AbortSignal.timeout=milliseconds=>{budgets.push(milliseconds);const controller=new AbortController();setTimeout(()=>controller.abort(Object.assign(new Error('Test AI timeout'),{name:'TimeoutError'})),milliseconds);return controller.signal;};
  global.fetch=async(url,options)=>{
   requests.push(JSON.parse(options.body));
   return {ok:true,text:()=>new Promise((resolve,reject)=>{
    setTimeout(()=>resolve(JSON.stringify({choices:[{message:{content:JSON.stringify({matchScore:0,summary:'No relevant experience.'})}}]})),30000);
    options.signal.addEventListener('abort',()=>reject(options.signal.reason),{once:true});
   })};
  };
  const load=loader(),ai=load('src/lib/ai.ts'),limits=load('src/lib/ai-request-limits.ts');
  const ats=ai.analyzeResumeWithGemini({resumeText:'Saved resume',jobDescription:'Required experience and relevant qualifications.'});
  const briefFailure=assert.rejects(ai.callGeminiJSON('Brief assessment','Job and resume'),error=>error.name==='TimeoutError');
  await Promise.resolve();context.mock.timers.tick(25000);await briefFailure;context.mock.timers.tick(5000);
  assert.equal((await ats).matchScore,0);assert.deepEqual(budgets,[limits.ATS_AI_TIMEOUT_MS,limits.DEFAULT_AI_TIMEOUT_MS]);assert.equal(limits.DEFAULT_AI_TIMEOUT_MS,25000);
  assert.equal(requests[0].max_tokens,limits.ATS_MAX_OUTPUT_TOKENS);assert.equal(requests[1].max_tokens,undefined);assert.match(requests[0].messages[0].content,/three bullet rewrites/);
  assert.ok(limits.ATS_BROWSER_TIMEOUT_MS>180000);assert.ok(limits.ATS_AI_TIMEOUT_MS<180000);
 }finally{global.fetch=savedFetch;AbortSignal.timeout=savedTimeout;context.mock.timers.reset();if(savedKey===undefined)delete process.env.AI_API_KEY;else process.env.AI_API_KEY=savedKey;}
});

test('ATS route distinguishes provider timeouts and records timing without logging candidate text',async()=>{
 const warnings=[],savedWarn=console.warn;console.warn=(...items)=>warnings.push(items);
 try{
  for(const name of ['TimeoutError','AbortError']){
   const route=loader({'@/lib/session-account':{getSessionAccount:async()=>({id:'member',name:'Member',email:'member@example.com',role:'member'})},'@/lib/db':{},'@/lib/ai':{analyzeResumeWithGemini:async()=>{throw Object.assign(new Error('PRIVATE_PROVIDER_DETAIL'),{name});}}})('src/app/api/ai/analyze/route.ts');
   assert.equal(route.maxDuration,180);const response=await route.POST(new Request('http://local',{method:'POST',body:JSON.stringify({jobDescription:'Actual requirements including relevant experience.'})}));
   assert.equal(response.status,504);const body=await response.json();assert.equal(body.code,'AI_TIMEOUT');assert.match(body.error,/ATS report in time/);assert.doesNotMatch(JSON.stringify(body),/PRIVATE_PROVIDER_DETAIL|previous report/);
  }
  assert.equal(warnings.length,2);assert.doesNotMatch(JSON.stringify(warnings),/PRIVATE_PROVIDER_DETAIL|Saved member master resume|member@example/);
 }finally{console.warn=savedWarn;}
});

test('admin endpoints reject members and all AI/PDF tools require authentication',async()=>{
 let user={id:'member',email:'member@example.com',role:'member',notion_enabled:true};
 const load=loader({'@/lib/session-account':{getSessionAccount:async()=>user},'@/lib/notion':{},'@/lib/ai':{},'@/lib/db':{}});
 for(const path of ['settings/google','rpa','portfolio','notion/sync']){const route=load('src/app/api/'+path+'/route.ts');assert.equal((await route.GET(new Request('http://local'))).status,403);if(route.POST)assert.equal((await route.POST(new Request('http://local',{method:'POST'}))).status,403);}
 user=null;
 for(const path of ['ai/analyze','analytics/analyze','leads/generate','leads/ai-match','leads/pitch','resume/parse-pdf'])assert.equal((await load('src/app/api/'+path+'/route.ts').POST(new Request('http://local',{method:'POST'}))).status,401);
 const previous=process.env.NOTION_WEBHOOK_SECRET;delete process.env.NOTION_WEBHOOK_SECRET;
 try{assert.equal((await load('src/app/api/notion/webhook/route.ts').POST(new Request('http://local',{method:'POST'}))).status,503);}finally{if(previous!==undefined)process.env.NOTION_WEBHOOK_SECRET=previous;}
});

test('company edits preserve IDs and cannot mutate another creator’s shared company',async()=>{
 const me={id:'member',email:'member@example.com',role:'member'};let writes=[];
 const own={id:'own',created_by:'member',name:'Before'},foreign={id:'foreign',created_by:'other',name:'Shared'};
 const route=loader({'@/lib/session-account':{getSessionAccount:async()=>me},'@/lib/notion':{},'@/lib/db':{getCompanies:async()=>[own,foreign],getApplications:async()=>[sample({owner:'member',company_id:'foreign'})],deleteCompany:async()=>{throw Error('Unexpected shared company deletion');},getOrCreateCompany:async()=>foreign,updateCompany:async(id,data)=>{writes.push({id,data});return {...own,...data};}}})('src/app/api/companies/route.ts');
 const req=body=>new Request('http://local',{method:'POST',body:JSON.stringify(body)});
 assert.equal((await route.POST(req({id:'own',name:'After',website:'https://example.com',industry:'Finance'}))).status,201);assert.equal(writes[0].id,'own');assert.equal(writes[0].data.website,'https://example.com');
 assert.equal((await route.POST(req({id:'foreign',name:'Hijacked'}))).status,403);assert.equal((await route.POST(req({name:'Shared',logo_url:'Forged logo',industry:'Changed'}))).status,201);assert.equal(writes.length,1);
 assert.equal((await route.DELETE(new Request('http://local/api/companies?id=foreign',{method:'DELETE'}))).status,403);
 const {applicationValidationError}=loader()('src/lib/application-validation.ts');assert.match(applicationValidationError({status:'MADE_UP'}),/Invalid status/);assert.match(applicationValidationError({salary_min:-1}),/nonnegative/);assert.match(applicationValidationError({job_url:'javascript:alert(1)'}),/http/);assert.equal(applicationValidationError({salary_min:0,status:'LEAD'}),null);
});

test('ownership isolates admins and members by exact account identity',()=>{
 const {ownsApplication}=loader()('src/lib/ownership.ts');const me={id:'user_ji',email:'ji@example.com',role:'admin'};assert.ok(ownsApplication({owner:'user_ji'},me));assert.ok(ownsApplication({owner:'JI@example.com'},me));assert.ok(ownsApplication({owner:'admin'},me));assert.equal(ownsApplication({owner:'user_friend'},me),false);assert.equal(ownsApplication({owner:'ji'},me),false);assert.equal(ownsApplication({owner:'admin'},{id:'user_friend',email:'friend@example.com',role:'member'}),false);
});
test('analytics separates unassessed roles and retains recorded interview history',()=>{
 const {pipelineAnalytics,isInternship,isSubmitted}=loader()('src/lib/analytics.ts');const apps=[sample({id:'a',role_fit:'STRONG',status:'ACCEPTED'}),sample({id:'b',role_fit:'STRONG',status:'REJECTED',stage_history:[{status:'INTERVIEWING',notion_status:'Final Interview',at:'2026-10-10'}]}),sample({id:'c',role_fit:'POSSIBLE',status:'LEAD'}),sample({id:'d',role_fit:'WEAK'}),sample({id:'e',status:'REJECTED'})];const stats=pipelineAnalytics(apps);assert.equal(stats.submitted,4);assert.equal(stats.unassessed,1);assert.equal(stats.fits[0].submitted,2);assert.equal(stats.fits[0].progressionRate,100);assert.equal(stats.fits[0].offerRate,50);assert.equal(stats.fits[1].progressionRate,null);assert.equal(stats.funnel[1].count,2);assert.equal(stats.funnel[3].count,2);assert.ok(isInternship(sample({role_title:'IT Intern',job_type:undefined})));assert.equal(pipelineAnalytics([]).offerRate,null);assert.equal(isSubmitted(sample({status:'REJECTED',notion_status:'Not Accepting Interns'})),false);assert.equal(isSubmitted(sample({status:'REJECTED',notion_status:'Repeated'})),false);
});
test('local persistence keeps independent resume profiles and fit ratings through status changes',async()=>{
 const original=process.cwd();const directory=fs.mkdtempSync(path.join(os.tmpdir(),'job-pipeline-'));const saved={POSTGRES_URL:process.env.POSTGRES_URL,DATABASE_URL:process.env.DATABASE_URL,VERCEL:process.env.VERCEL};
 try{for(const key of Object.keys(saved))delete process.env[key];process.chdir(directory);const db=loader()('src/lib/db.ts');await db.saveCandidateProfile('user_ji','My resume');await db.saveCandidateProfile('user_friend','Friend resume');assert.equal(await db.getCandidateProfile('user_ji'),'My resume');await db.saveCandidatePreferences('user_ji',{target_roles:['Developer']});await db.saveCandidateProfile('user_ji','Updated resume');assert.deepEqual((await db.getCandidatePreferences('user_ji')).target_roles,['Developer']);assert.equal(await db.getCandidateProfile('user_ji'),'Updated resume');assert.equal(await db.getCandidatePreferences('user_friend'),null);const app=await db.createApplication(sample({role_fit:'STRONG',role_fit_source:'manual',job_description:'TypeScript and SQL engineering'}));await db.updateApplication(app.id,{status:'INTERVIEWING',notion_status:'Final Interview'});await db.updateApplication(app.id,{status:'REJECTED',notion_status:'Not Accepted'});const savedApp=await db.getApplicationById(app.id);assert.equal(savedApp.role_fit,'STRONG');assert.equal(savedApp.role_fit_source,'manual');assert.equal(savedApp.stage_history.length,3);assert.equal(loader()('src/lib/analytics.ts').pipelineAnalytics([savedApp]).funnel[3].count,1);
 }finally{process.chdir(original);for(const [key,value]of Object.entries(saved)){if(value===undefined)delete process.env[key];else process.env[key]=value;}fs.rmSync(directory,{recursive:true,force:true});}
});
test('application APIs scope reads, ignore forged owner, and enforce new defaults',async()=>{
 let user={id:'user_ji',email:'ji@example.com',role:'admin'};const apps=[sample(),sample({id:'friend',owner:'user_friend'})];let created;
 const load=loader({'@/lib/session-account':{getSessionAccount:async()=>user},'@/lib/db':{getApplications:async()=>apps,getCompanies:async()=>[],createApplication:async data=>(created={...data,id:'new'}),getApplicationById:async id=>id==='new'?created:apps.find(app=>app.id===id),updateApplication:async()=>{throw Error('Should not update another account');},deleteApplication:async()=>{throw Error('Should not delete another account');}},'@/lib/notion':{getNotionConfig:()=>({isConfigured:false}),pushApplicationToNotion:async()=>{}}});
 const routes=load('src/app/api/applications/route.ts');const result=await (await routes.GET()).json();assert.deepEqual(result.data.map(app=>app.id),['app']);
 const response=await routes.POST(new Request('http://local/api/applications',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({company_name:'New',role_title:'Engineer',owner:'user_friend'})}));assert.equal(response.status,201);assert.equal(created.owner,'user_ji');assert.equal(created.notion_status,'Not started');assert.equal(created.status,'LEAD');assert.equal(created.work_model,null);assert.equal(created.job_type,null);assert.equal(created.salary_currency,null);
 const id=load('src/app/api/applications/[id]/route.ts');assert.equal((await id.GET(new Request('http://local'),{params:Promise.resolve({id:'friend'})})).status,404);assert.equal((await id.PUT(new Request('http://local',{method:'PUT',body:JSON.stringify({status:'ACCEPTED'})}),{params:Promise.resolve({id:'friend'})})).status,404);assert.equal((await id.DELETE(new Request('http://local',{method:'DELETE'}),{params:Promise.resolve({id:'friend'})})).status,404);user=null;assert.equal((await routes.GET()).status,401);
});

test('saving JSON-imported drafts creates and links companies once, including Not started roles',async()=>{
 const original=process.cwd(),directory=fs.mkdtempSync(path.join(os.tmpdir(),'job-import-companies-')),env={POSTGRES_URL:process.env.POSTGRES_URL,DATABASE_URL:process.env.DATABASE_URL,VERCEL:process.env.VERCEL};
 try{
  for(const key of Object.keys(env))delete process.env[key];process.chdir(directory);
  let user={id:'member',email:'member@example.com',role:'member',notion_enabled:false};
  const load=loader({'@/lib/session-account':{getSessionAccount:async()=>user},'@/lib/notion':{pushApplicationToNotion:async()=>{throw Error('Member must not write to Notion');}}});
  const db=load('src/lib/db.ts'),route=load('src/app/api/applications/route.ts'),companyRoute=load('src/app/api/companies/route.ts');
  const imported=load('src/lib/job-import.ts').parseJobImport(JSON.stringify({job_title:'Reservations Associate',company:'  City   Garden Hotel  ',description:'Handle hotel reservations.'}));
  const post=body=>route.POST(new Request('http://local',{method:'POST',body:JSON.stringify(body)}));
  assert.equal((await db.getCompanies()).length,0);
  const first=await post({...imported,ensure_company:true,owner:'forged'});assert.equal(first.status,201);const firstApp=(await first.json()).data;
  assert.equal(firstApp.status,'LEAD');assert.ok(firstApp.company_id);assert.equal(firstApp.owner,'member');assert.equal(firstApp.company_name,'City Garden Hotel');assert.equal(firstApp.ensure_company,undefined);
  const second=(await (await post({...imported,company_name:'CITY GARDEN HOTEL',ensure_company:true})).json()).data;
  assert.equal(second.company_id,firstApp.company_id);assert.equal((await db.getCompanies()).length,1);
  const visible=(await (await companyRoute.GET(new Request('http://local'))).json()).data;
  assert.equal(visible.length,1);assert.equal(visible[0].applicationCount,2);
  const edit=load('src/app/api/applications/[id]/route.ts');
  const edited=await edit.PUT(new Request('http://local',{method:'PUT',body:JSON.stringify({ensure_company:true,company_name:'New Import Company'})}),{params:Promise.resolve({id:firstApp.id})});
  const editedApp=(await edited.json()).data;assert.equal(editedApp.status,'LEAD');assert.notEqual(editedApp.company_id,firstApp.company_id);assert.equal(editedApp.ensure_company,undefined);assert.equal((await db.getCompanies()).length,2);
  await post({...imported,company_name:'Quick Add Lead Only'});assert.equal((await db.getCompanies()).length,2);
  assert.equal((await post({...imported,ensure_company:'true'})).status,400);
  user={id:'other',email:'other@example.com',role:'member'};
  assert.equal((await edit.PUT(new Request('http://local',{method:'PUT',body:JSON.stringify({ensure_company:true,company_name:'Unauthorized'})}),{params:Promise.resolve({id:firstApp.id})})).status,404);
  assert.equal((await db.getCompanies()).length,2);
 }finally{process.chdir(original);for(const [key,value]of Object.entries(env)){if(value===undefined)delete process.env[key];else process.env[key]=value;}fs.rmSync(directory,{recursive:true,force:true});}
});

test('concurrent Postgres company creation reuses case and whitespace variants without overwriting shared data',async()=>{
 const previous=process.env.POSTGRES_URL;let inserts=0;
 try{
  process.env.POSTGRES_URL='postgres://test-only';
  const rows=new Map([['legacy',{id:'legacy',name:'  Legacy   Company  ',created_by:'other',logo_url:'original-logo'}]]);
  let transactionTail=Promise.resolve();
  const sql=(strings,...values)=>{
   const query=strings.join('?');
   const execute=async()=>{
   if(query.includes('SELECT * FROM companies'))return [...rows.values()].filter(row=>row.name.trim().replace(/\s+/g,' ').toLowerCase()===values[0]);
   if(query.includes('INSERT INTO companies')){inserts++;assert.match(query,/WHERE NOT EXISTS/);const [id,name,logo_url,website,created_by]=values;if([...rows.values()].some(row=>row.name.trim().replace(/\s+/g,' ').toLowerCase()===values.at(-1)))return [];const row={id,name,logo_url,website,created_by};rows.set(id,row);return [row];}
   if(query.includes('UPDATE companies'))throw Error('Shared company was modified');
   return [];
   };return {query,then:(resolve,reject)=>execute().then(resolve,reject)};
  };
  sql.transaction=(queries,options)=>{
   if(!queries[0].query.includes('pg_advisory_xact_lock'))return Promise.all(queries);
   assert.equal(options.isolationLevel,'ReadCommitted');
   const result=transactionTail.then(async()=>{const output=[];for(const query of queries)output.push(await query);return output;});transactionTail=result.then(()=>{},()=>{});return result;
  };
  const db=loader({'@neondatabase/serverless':{neon:()=>sql}})('src/lib/db.ts');
  const legacy=await db.getOrCreateCompany('legacy company','replacement',undefined,'member');assert.equal(legacy.id,'legacy');assert.equal(legacy.logo_url,'original-logo');assert.equal(inserts,0);
  const created=await Promise.all([db.getOrCreateCompany(' New   Company ',undefined,undefined,'member'),db.getOrCreateCompany('NEW COMPANY',undefined,undefined,'other')]);
  assert.equal(created[0].id,created[1].id);assert.equal(rows.size,2);assert.equal(inserts,2);assert.equal(created[0].created_by,'member');
  rows.get(created[0].id).name='Renamed Company';
  const reusedName=await db.getOrCreateCompany('New Company',undefined,undefined,'member');assert.notEqual(reusedName.id,created[0].id);assert.equal(rows.size,3);
 }finally{if(previous===undefined)delete process.env.POSTGRES_URL;else process.env.POSTGRES_URL=previous;}
});
test('role-fit AI validates evidence, protects manual ratings, and rejects foreign records',async()=>{
 let app=sample({role_fit:'STRONG',role_fit_source:'manual'});let raw={fit:'WEAK',explanation:'Missing requirements',strengths:['Python'],gaps:['SQL']};let calls=0;let writes=0;
 const route=loader({'@/lib/session-account':{getSessionAccount:async()=>({id:'user_ji',email:'ji@example.com'})},'@/lib/db':{getApplicationById:async()=>app,getCandidateProfile:async()=> 'Resume evidence',saveRoleFitIfCurrent:async(snapshot,data)=>{writes++;return {...app,role_fit:data.fit,role_fit_source:'ai',role_fit_analysis:data};}},'@/lib/ai':{callGeminiJSON:async()=>{calls++;if(raw instanceof Error)throw raw;return raw;}}})('src/app/api/role-fit/route.ts');
 const request=body=>new Request('http://local',{method:'POST',body:JSON.stringify(body)});
 assert.equal((await route.POST(request({id:'app'}))).status,200);assert.equal(calls,0);app={...app,owner:'user_friend'};assert.equal((await route.POST(request({id:'app',force:true}))).status,404);app=sample();assert.equal((await route.POST(request({id:'app'}))).status,422);app={...app,job_description:'Experience building Python services with SQL databases.'};raw={fit:'INVENTED'};assert.equal((await route.POST(request({id:'app'}))).status,502);assert.equal(writes,0);raw={fit:'POSSIBLE',explanation:'Python transfers; SQL is missing.',strengths:['Python'],gaps:['SQL']};const data=await (await route.POST(request({id:'app'}))).json();assert.equal(data.application.role_fit,'POSSIBLE');assert.equal(data.application.role_fit_source,'ai');assert.equal(writes,1);raw=new DOMException('timeout','TimeoutError');const timedOut=await route.POST(request({id:'app'}));assert.equal(timedOut.status,502);assert.match((await timedOut.json()).error,/leave this role unassessed/);assert.equal(writes,1);
});
test('weak and strong fit default priority and preserve independent overrides',async()=>{
 let saved=sample({job_description:'Experience building Python services with SQL databases.'});
 const load=loader({'@/lib/session-account':{getSessionAccount:async()=>({id:'user_ji',role:'member'})},'@/lib/notion':{},'@/lib/db':{getCompanies:async()=>[],createApplication:async data=>(saved={...sample(),...data}),getApplicationById:async()=>saved,updateApplication:async(id,data)=>(saved={...saved,...data}),saveRoleFitIfCurrent:async(snapshot,data)=>(saved={...saved,role_fit:data.fit,role_fit_source:'ai',role_fit_analysis:data,priority:data.fit!==snapshot.role_fit&&['WEAK','STRONG'].includes(data.fit)?data.fit==='WEAK'?'LOW':'HIGH':snapshot.priority})},'@/lib/ai':{callGeminiJSON:async()=>({fit:'WEAK',explanation:'Missing required experience.',strengths:[],gaps:['SQL']})}});
 const req=body=>new Request('http://local',{method:'POST',body:JSON.stringify(body)});
 const create=load('src/app/api/applications/route.ts');
 assert.equal((await create.POST(req({company_name:'Example',role_title:'Engineer',role_fit:'WEAK'}))).status,201);
 assert.equal(saved.priority,'LOW');
 const edit=load('src/app/api/applications/[id]/route.ts');const params={params:Promise.resolve({id:saved.id})};
 await edit.PUT(req({priority:'HIGH'}),params);assert.equal(saved.priority,'HIGH');assert.equal(saved.role_fit,'WEAK');
 await edit.PUT(req({role_fit:'WEAK',notes:'Keep my chosen priority'}),params);assert.equal(saved.priority,'HIGH');
 await edit.PUT(req({role_fit:'STRONG'}),params);assert.equal(saved.priority,'HIGH');
 await edit.PUT(req({priority:'LOW'}),params);assert.equal(saved.role_fit,'STRONG');
 await edit.PUT(req({role_fit:'STRONG',notes:'Keep my strong-fit override'}),params);assert.equal(saved.priority,'LOW');
 await edit.PUT(req({role_fit:'POSSIBLE'}),params);assert.equal(saved.priority,'LOW');
 await edit.PUT(req({role_fit:'STRONG'}),params);assert.equal(saved.priority,'HIGH');
 await edit.PUT(req({role_fit:'WEAK'}),params);assert.equal(saved.priority,'LOW');
 await edit.PUT(req({role_fit:'STRONG'}),params);
 await edit.PUT(req({role_fit:'WEAK',priority:'HIGH'}),params);assert.equal(saved.priority,'HIGH');
 saved={...saved,role_fit:'STRONG',role_fit_source:'ai',job_description:'Experience building Python services with SQL databases.'};
 const ai=load('src/app/api/role-fit/route.ts');
 assert.equal((await ai.POST(req({id:saved.id}))).status,200);assert.equal(saved.priority,'LOW');
 saved.priority='HIGH';
 await ai.POST(req({id:saved.id}));assert.equal(saved.priority,'HIGH');
});

test('salary offer statistics use recorded amounts, retain zero, and separate currencies and pay periods',()=>{
 const {pipelineAnalytics}=loader()('src/lib/analytics.ts');
 const rows=[sample({id:'zero',offer_amount:0}),sample({id:'one',offer_amount:50000}),sample({id:'two',offer_amount:'70000.00',status:'WITHDRAWN'}),sample({id:'two',offer_amount:1000,updated_at:'2026-10-01'}),sample({id:'three',offer_amount:90000}),sample({id:'annual',offer_amount:840000,offer_pay_period:'ANNUAL'}),sample({id:'usd',offer_amount:2000,offer_currency:'USD'}),sample({id:'advertised',salary_min:40000,salary_max:80000}),sample({id:'blank',offer_amount:null}),sample({id:'invalid',offer_amount:-1})];
 const stats=pipelineAnalytics(rows);assert.equal(stats.salaryOffers.count,6);assert.equal(stats.salaryOffers.missing,3);
 const monthly=stats.salaryOffers.groups.find(group=>group.key==='PHP:MONTHLY');assert.equal(monthly.count,4);assert.equal(monthly.median,60000);assert.equal(monthly.min,0);assert.equal(monthly.max,90000);
 assert.equal(stats.salaryOffers.groups.find(group=>group.key==='PHP:ANNUAL').median,840000);assert.equal(stats.salaryOffers.groups.find(group=>group.key==='USD:MONTHLY').median,2000);
 assert.equal(pipelineAnalytics([]).salaryOffers.count,0);assert.deepEqual(pipelineAnalytics([]).salaryOffers.groups,[]);
});

test('expected salary compares offers against the same application and unit, excluding missing and mismatched values',()=>{
 const {pipelineAnalytics}=loader()('src/lib/analytics.ts');
 const rows=[sample({id:'below',offer_amount:50000,expected_salary_amount:60000}),sample({id:'equal',offer_amount:70000,expected_salary_amount:'70000.00'}),sample({id:'above',offer_amount:90000,expected_salary_amount:80000}),sample({id:'waiting',expected_salary_amount:65000}),sample({id:'currency',offer_amount:2000,offer_currency:'USD',expected_salary_amount:90000}),sample({id:'period',offer_amount:840000,offer_pay_period:'ANNUAL',expected_salary_amount:75000}),sample({id:'invalid',expected_salary_amount:false}),sample({id:'blank',expected_salary_amount:''}),sample({id:'zero',expected_salary_amount:0,offer_amount:0,offer_pay_period:'HOURLY',expected_salary_pay_period:'HOURLY'}),sample({id:'below',expected_salary_amount:1,offer_amount:900000,updated_at:'2026-09-01'})];
 const stats=pipelineAnalytics(rows).salaryOffers;
 assert.equal(stats.expectedCount,7);
 const group=stats.expectations.find(value=>value.key==='PHP:MONTHLY');
 assert.equal(group.count,6);assert.equal(group.median,72500);assert.equal(group.matched,3);assert.equal(group.met,2);assert.equal(group.medianGap,0);
 assert.deepEqual(group.pairs.map(pair=>pair.gap),[-10000,0,10000]);
 assert.equal(stats.expectations.find(value=>value.key==='PHP:HOURLY').met,1);
 const pending=pipelineAnalytics([sample({expected_salary_amount:45000})]).salaryOffers;
 assert.equal(pending.count,0);assert.equal(pending.expectations[0].median,45000);assert.equal(pending.expectations[0].medianGap,null);
});

test('offer API validates, normalizes, edits and clears only the signed-in application',async()=>{
 let saved;const load=loader({'@/lib/session-account':{getSessionAccount:async()=>({id:'user_ji',role:'member'})},'@/lib/notion':{},'@/lib/db':{getCompanies:async()=>[],createApplication:async data=>(saved={...sample(),...data}),getApplicationById:async()=>saved,updateApplication:async(id,data)=>(saved={...saved,...data})}});
 const req=body=>new Request('http://local',{method:'POST',body:JSON.stringify(body)});const route=load('src/app/api/applications/route.ts');
 assert.equal((await route.POST(req({role_title:'Engineer',company_name:'Example',status:'LEAD',offer_amount:'65000.50',offer_currency:'php',offer_pay_period:'MONTHLY',expected_salary_amount:'70000.50',expected_salary_currency:' php ',expected_salary_pay_period:'MONTHLY'}))).status,201);assert.equal(saved.offer_amount,65000.5);assert.equal(saved.offer_currency,'PHP');assert.equal(saved.expected_salary_amount,70000.5);assert.equal(saved.expected_salary_currency,'PHP');
 const edit=load('src/app/api/applications/[id]/route.ts');const params={params:Promise.resolve({id:'app'})};
 assert.equal((await edit.PUT(req({notes:'Updated note'}),params)).status,200);assert.equal(saved.offer_amount,65000.5);assert.equal(saved.expected_salary_amount,70000.5);
 for(const body of [{offer_amount:-1},{offer_amount:false},{offer_amount:'NaN'},{offer_currency:'INVALID'},{offer_pay_period:'DAILY'},{expected_salary_amount:-1},{expected_salary_amount:false},{expected_salary_amount:'NaN'},{expected_salary_currency:'INVALID'},{expected_salary_pay_period:'DAILY'}])assert.equal((await edit.PUT(req(body),params)).status,400);
 assert.equal((await edit.PUT(req({offer_amount:''}),params)).status,200);assert.equal(saved.offer_amount,null);assert.equal(saved.expected_salary_amount,70000.5);
 assert.equal((await edit.PUT(req({expected_salary_amount:''}),params)).status,200);assert.equal(saved.expected_salary_amount,null);
});

test('local offer persistence survives promotion, Notion-style updates and explicit clearing',async()=>{
 const original=process.cwd(),directory=fs.mkdtempSync(path.join(os.tmpdir(),'job-offers-')),env={POSTGRES_URL:process.env.POSTGRES_URL,DATABASE_URL:process.env.DATABASE_URL,VERCEL:process.env.VERCEL};
 try {for(const key of Object.keys(env))delete process.env[key];process.chdir(directory);const db=loader()('src/lib/db.ts');const lead=await db.createApplication(sample({status:'LEAD',offer_amount:0,offer_currency:'PHP',offer_pay_period:'MONTHLY',expected_salary_amount:70000,expected_salary_currency:'PHP',expected_salary_pay_period:'MONTHLY'}));await db.updateApplication(lead.id,{status:'APPLIED'});await db.updateApplication(lead.id,{status:'WITHDRAWN',notes:'Notion changed notes',sync_status:'SYNCED'});const restored=await db.getApplicationById(lead.id);assert.equal(restored.offer_amount,0);assert.equal(restored.offer_currency,'PHP');assert.equal(restored.offer_pay_period,'MONTHLY');assert.equal(restored.expected_salary_amount,70000);assert.equal(restored.expected_salary_currency,'PHP');assert.equal(restored.expected_salary_pay_period,'MONTHLY');await db.updateApplication(lead.id,{expected_salary_amount:null});assert.equal((await db.getApplicationById(lead.id)).expected_salary_amount,null);await db.updateApplication(lead.id,{offer_amount:null});assert.equal((await db.getApplicationById(lead.id)).offer_amount,null);
 } finally {process.chdir(original);for(const [key,value]of Object.entries(env)){if(value===undefined)delete process.env[key];else process.env[key]=value;}fs.rmSync(directory,{recursive:true,force:true});}
});

test('offer PDF contains distributions and medians without company/application lists',async()=>{
 const {analyticsPdf}=loader()('src/lib/analytics-export.ts');const rows=[sample({id:'one',role_title:'PRIVATE_OFFER_ROLE',company_name:'PRIVATE_OFFER_COMPANY',offer_amount:60000,expected_salary_amount:65000}),sample({id:'two',offer_amount:80000}),sample({id:'usd',offer_amount:1200,offer_currency:'USD',offer_pay_period:'HOURLY'})];const pdf=await analyticsPdf(rows,'Member','All roles');assert.ok(pdf.getNumberOfPages() >= 4);
 const {extractText}=require('unpdf');const text=(await extractText(new Uint8Array(pdf.output('arraybuffer')),{mergePages:true})).text;assert.match(text,/Recorded salary offers/);assert.match(text,/PHP 70,000.00/);assert.match(text,/USD \/ Hourly/);assert.doesNotMatch(text,/PRIVATE_OFFER/);assert.match(text,/Salary expectations/);assert.match(text,/0 of 1 matching offers meet expectations/);assert.match(text,/-PHP 5,000.00/);
 fs.writeFileSync(path.join(ROOT,'.data','salary-offer-report-preview.pdf'),Buffer.from(pdf.output('arraybuffer')));
});

test('PDF stays compact for 500 applications and includes targets without AI, individual records or resume',async()=>{
 const {analyticsPdf}=loader()('src/lib/analytics-export.ts');
 const rows=Array.from({length:500},(_,i)=>sample({id:String(i),company_name:'Private Employer '+i,role_title:i % 2 ? 'Junior Private Role' : 'Senior Private Role',role_fit:'STRONG',notes:'PRIVATE_APPLICATION_NOTES',information:'PRIVATE_JOB_DESCRIPTION',role_fit_analysis:{explanation:'PRIVATE_FIT_EXPLANATION'}}));
 const targets={target_roles:['Solutions Architect'],target_companies:['Target Employer'],preferred_locations:['Las Piñas'],work_models:['REMOTE'],job_types:['FULL_TIME'],salary_min:60000,salary_currency:'PHP',dealbreakers:'Daytime schedule',portfolio_summary:'PRIVATE_RESUME_CONTENT',resumeText:'PRIVATE_RESUME_CONTENT'};
 const insight={summary:'Recorded progress suggests reviewing targeting.',nextSteps:['Review relevant role requirements.']};
 const pdf=await analyticsPdf(rows,'Jizelle Casia','All my roles',{},undefined,targets);
 const smaller=await analyticsPdf(rows.slice(0,35),'Jizelle Casia','All my roles',{},undefined,targets);
 assert.equal(pdf.getNumberOfPages(),smaller.getNumberOfPages());assert.ok(pdf.getNumberOfPages() <= 5);
 const {extractText}=require('unpdf');const result=await extractText(new Uint8Array(pdf.output('arraybuffer')),{mergePages:true});
 for(const expected of ['Jizelle Casia','500','Role fit and outcomes','Unassessed: 0','Target Employer','Solutions Architect','Las Pinas','PHP 60,000.00','Daytime schedule'])assert.ok(result.text.includes(expected),expected);
 assert.doesNotMatch(result.text,/Private Employer|Private Role|PRIVATE_|Application details|AI interpretation|No AI/);
 fs.mkdirSync(path.join(ROOT,'.data'),{recursive:true});fs.writeFileSync(path.join(ROOT,'.data','analytics-report-preview.pdf'),Buffer.from(pdf.output('arraybuffer')));
});

test('PDF handles empty analytics and paginates long preferences without losing content',async()=>{
 const {analyticsPdf}=loader()('src/lib/analytics-export.ts');const {extractText,getDocumentProxy}=require('unpdf');
 const empty=await analyticsPdf([],'Member','Internships');assert.equal(empty.getNumberOfPages(),4);
 const emptyText=(await extractText(new Uint8Array(empty.output('arraybuffer')),{mergePages:true})).text;
 assert.match(emptyText,/N\/A/);assert.doesNotMatch(emptyText,/AI interpretation|No AI/);assert.doesNotMatch(emptyText,/NaN|Infinity/);
 const dealbreakers=Array.from({length:70},(_,i)=>`Preference ${i}: review recorded pipeline evidence before adjusting your targets.`).join('\n');
 const long=await analyticsPdf([sample()],'Member','All roles',{},undefined,{dealbreakers});assert.ok(long.getNumberOfPages()>4);
 const doc=await getDocumentProxy(new Uint8Array(long.output('arraybuffer')));
 const text=(await extractText(doc,{mergePages:true})).text;assert.match(text,/Preference 69/);assert.doesNotMatch(text,/AI interpretation|No AI/);
 for(let i=1;i<=doc.numPages;i++){const page=await doc.getPage(i);const content=await page.getTextContent();for(const item of content.items){if(!item.str)continue;assert.ok(item.transform[5]>=15 && item.transform[5]<=page.view[3]-25,`Text outside page ${i}: ${item.str}`);assert.ok(item.transform[4]+item.width<=page.view[2]-25,`Text overflows page ${i}: ${item.str}`);}}
});

test('resume profile is scoped to the session account and ignores a forged owner',async()=>{
 let user={id:'user_friend',email:'friend@example.com'};const profiles={user_ji:'Private admin resume',user_friend:'Friend resume'};
 const route=loader({'@/lib/session-account':{getSessionAccount:async()=>user},'@/lib/db':{getCandidateProfile:async id=>profiles[id]||null,saveCandidateProfile:async(id,text)=>{profiles[id]=text;}}})('src/app/api/profile/route.ts');
 assert.equal((await (await route.GET()).json()).resumeText,'Friend resume');await route.PUT(new Request('http://local',{method:'PUT',body:JSON.stringify({owner:'user_ji',resumeText:'Updated friend resume'})}));assert.equal(profiles.user_ji,'Private admin resume');assert.equal(profiles.user_friend,'Updated friend resume');user=null;assert.equal((await route.GET()).status,401);
});

test('job title keywords are industry-neutral, overlap by distinct submitted application, and ignore legacy families',()=>{
 const load=loader(),{jobTitleKeywords}=load('src/lib/job-title-keywords.ts'),{analyticsReportData}=load('src/lib/analytics-report.ts'),{pipelineAnalytics}=load('src/lib/analytics.ts');
 const keys=title=>jobTitleKeywords(title).map(item=>item.key);
 for(const [title,expected]of [['Senior AI Automation Engineer',['ai','automation','engineer','ai automation']],['Junior Front Office Manager',['front','office','manager','front office']],['Staff Nurse RN',['staff','nurse','rn','staff nurse']],['Customer Service Representative',['customer service','representative']],['Food and Beverage Manager',['food and beverage','manager']],['C++ / C# / .NET Developer',['c++','c#','.net','developer']]])for(const keyword of expected)assert.ok(keys(title).includes(keyword),title+': '+keyword);
 assert.ok(!keys('Senior Front Office Manager').includes('senior'));assert.deepEqual(keys(''),[]);assert.deepEqual(keys('Hiring full-time remote'),[]);
 const rows=Array.from({length:5},(_,i)=>sample({id:String(i),role_title:i?'AI Automation Engineer':'AI AI Automation Engineer',role_family:'Wrong historical category',status:i<2?'OFFER':'APPLIED'}));
 rows.push({...rows[0],updated_at:'2000-01-01',role_title:'Wrong old duplicate'},sample({id:'lead',role_title:'Unsubmitted Secret Title',status:'LEAD'}),sample({id:'hospitality',role_title:'Senior Front Office Manager',status:'SCREENING'}),sample({id:'blank',role_title:undefined}));
 const stats=pipelineAnalytics(rows),report=analyticsReportData(rows,stats);
 for(const key of ['ai','automation','engineer']){const keyword=report.keywords.find(row=>row.key===key);assert.equal(keyword.submitted,5);assert.equal(keyword.progressed,2);assert.equal(keyword.offers,2);assert.equal(keyword.progressionRate,40);}
 const office=report.keywords.find(row=>row.key==='front office');assert.equal(office.submitted,1);assert.equal(office.progressionRate,null);
 assert.ok(!report.keywords.some(row=>/historical|unsubmitted|duplicate/.test(row.key)));assert.ok(report.keywords.reduce((sum,row)=>sum+row.submitted,0)>stats.submitted);
 assert.equal(report.fits.reduce((sum,row)=>sum+row.submitted,0),stats.submitted);assert.deepEqual(report.keywords,stats.dimensions.keywords);
 const reordered=pipelineAnalytics([...rows].reverse()).dimensions.keywords;assert.deepEqual(reordered,stats.dimensions.keywords);
});

test('PDF embeds the original transparent logo on every A4 page and uses plain-language labels',async()=>{
 const load=loader(),{analyticsPdf}=load('src/lib/analytics-export.ts'),{extractImages,getDocumentProxy,extractText}=require('unpdf');
 const rows=[sample({id:'brand',role_title:'Junior Software Developer',offer_amount:60000}),sample({id:'long',role_title:'Senior Job Title With A Very Long Description That Must Remain In The Application',role_family:'A very long saved manual role family with many words that should stay readable without overlapping charts',role_family_source:'manual'})];
 const pdf=await analyticsPdf(rows,'Report member','All (combined)'),bytes=new Uint8Array(pdf.output('arraybuffer')),binary=Buffer.from(bytes),doc=await getDocumentProxy(bytes);
 assert.equal(doc.numPages,4);assert.ok(binary.includes(Buffer.from('/SMask')),'PNG transparency is embedded');
 const text=(await extractText(doc,{mergePages:true})).text;
 assert.doesNotMatch(text,/\bn\s*[=<]\s*\d+/);assert.match(text,/applications/);assert.match(text,/limited\s+application\s+data/);
 for(let i=1;i<=doc.numPages;i++){
  const images=await extractImages(doc,i);assert.equal(images.length,1);assert.equal(images[0].width,1774);assert.equal(images[0].height,887);
  const page=await doc.getPage(i);assert.ok(Math.abs(page.view[2]-595.28)<1);assert.ok(Math.abs(page.view[3]-841.89)<1);
  const content=await page.getTextContent();assert.ok(content.items.some(item=>item.str?.startsWith('Report date:')));
  const metadata=['PERSONAL ANALYTICS','All (combined)'].map(text=>content.items.find(item=>item.str===text));
  metadata.push(content.items.find(item=>item.str?.startsWith('As of ')));
  assert.ok(metadata.every(Boolean),`Missing header text on page ${i}`);
  for(let j=1;j<metadata.length;j++){
   assert.ok(Math.abs(metadata[j].transform[5]-metadata[0].transform[5])<0.1,`Header text is misaligned on page ${i}`);
   assert.ok(metadata[j-1].transform[4]+metadata[j-1].width+8<=metadata[j].transform[4],`Header columns overlap on page ${i}`);
  }
  for(const item of content.items){if(!item.str?.trim())continue;assert.ok(item.height>=7.4,`Unreadable text on page ${i}: ${item.str}`);assert.ok(item.transform[4]>=25&&item.transform[4]+item.width<=page.view[2]-25,`Text overflows page ${i}: ${item.str}`);}
 }
 fs.writeFileSync(path.join(ROOT,'.data','analytics-branded-stress.pdf'),binary);
});

test('PDF logo loading reports asset failures, retries safely, and reuses successful image data',async()=>{
 const originalFetch=global.fetch;let requests=0,available=false;
 try{
  const bytes=fs.readFileSync(path.join(ROOT,'public/job-hunt official text.png'));
  global.fetch=async url=>{assert.equal(url,'/local-logo.png');requests++;return {ok:available,arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)};};
  const {loadAnalyticsLogo}=loader({'../../public/job-hunt official text.png':{src:'/local-logo.png',width:1774,height:887}})('src/lib/analytics-branding.ts');
  await assert.rejects(loadAnalyticsLogo(),/Could not load the Job Hunt logo/);available=true;
  const [first,second]=await Promise.all([loadAnalyticsLogo(),loadAnalyticsLogo()]);assert.deepEqual(Buffer.from(first),bytes);assert.equal(first,second);assert.equal(requests,2);
 }finally{global.fetch=originalFetch;}
});

test('callback visuals use saved events only and require sufficient dated cohorts for a heatmap',()=>{
 const load=loader(),{analyticsReportData}=load('src/lib/analytics-report.ts'),{pipelineAnalytics}=load('src/lib/analytics.ts');
 const rows=Array.from({length:5},(_,i)=>sample({id:String(i),date_applied:i<3?'2026-08-01':'2026-09-01',first_response_at:i<3?'2026-08-06T00:00:00Z':'2026-09-21T00:00:00Z'}));
 rows.push(sample({id:'no-event',date_applied:'2026-08-01',status:'OFFER',stage_history:[{status:'SCREENING',at:'2026-08-03'}]}),sample({id:'before',date_applied:'2026-09-01',first_response_at:'2026-08-01T00:00:00Z'}),sample({id:'future',date_applied:'2026-09-01',first_response_at:'2099-01-01T00:00:00Z'}));
 const stats=pipelineAnalytics(rows,{},undefined,new Date('2026-10-13')),report=analyticsReportData(rows,stats);
 assert.equal(report.responseCount,stats.timing.callbacks.count);assert.deepEqual(report.callbackBins.map(bin=>bin.count),[3,0,2,0]);assert.equal(report.heatmapReady,true);
 const few=rows.slice(0,3);assert.equal(analyticsReportData(few,pipelineAnalytics(few)).heatmapReady,false);
 assert.equal(report.responseCohorts.reduce((sum,row)=>sum+row.responses,0),5);
});

test('PDF stays four pages across many categories and shows recorded evidence and eligible timing samples',async()=>{
 const load=loader(),{analyticsPdf}=load('src/lib/analytics-export.ts'),{extractText,getDocumentProxy}=require('unpdf');
 const rows=Array.from({length:160},(_,i)=>sample({id:String(i),role_title:'Junior Software Developer',role_family:'Custom family '+i,role_family_source:'manual',job_platform:'Platform '+i,date_applied:i%2?'2026-08-01':'2026-09-01',first_response_at:i%2?'2026-08-06T00:00:00Z':'2026-09-21T00:00:00Z',status:i%3?'APPLIED':'OFFER',role_fit:i%2?'STRONG':null,role_fit_analysis:{preference_alignment:i%2?'ALIGNED':'MIXED'}}));
 const pdf=await analyticsPdf(rows,'Report Member','All (combined)',{},undefined,{analytics_age_boundaries:[3,10,20]});assert.equal(pdf.getNumberOfPages(),4);
 const doc=await getDocumentProxy(new Uint8Array(pdf.output('arraybuffer'))),text=(await extractText(doc,{mergePages:true})).text;
 for(const title of ['Application pipeline','Application effectiveness','Application timing','Career insights','21+ days','Top 3 of 3','eligible','recorded salary offers'])assert.ok(text.includes(title),title);
 assert.doesNotMatch(text,/NaN|Infinity/);
 for(let i=1;i<=doc.numPages;i++){const page=await doc.getPage(i),content=await page.getTextContent();for(const item of content.items){if(!item.str)continue;assert.ok(item.transform[5]>=15&&item.transform[5]<=page.view[3]-25,`Text outside page ${i}: ${item.str}`);assert.ok(item.transform[4]>=25&&item.transform[4]+item.width<=page.view[2]-25,`Text overflows page ${i}: ${item.str}`);}}
 fs.writeFileSync(path.join(ROOT,'.data','analytics-visual-report.pdf'),Buffer.from(pdf.output('arraybuffer')));
});
test('AI pipeline interpretation uses server-derived statistics for only the signed-in owner',async()=>{
 let stats;const route=loader({'@/lib/session-account':{getSessionAccount:async()=>({id:'user_ji',email:'ji@example.com'})},'@/lib/db':{getAnalyticsApplications:async()=>[sample()]},'@/lib/ai':{callGeminiJSON:async(system,input)=>{stats=JSON.parse(input);return insightFixture();}}})('src/app/api/analytics/analyze/route.ts');const response=await route.POST(new Request('http://local',{method:'POST',body:JSON.stringify({owner:'friend',stats:{total:99}})}));assert.equal(response.status,200);assert.equal(stats.total,1);assert.equal(stats.funnel[4].count,0);
});

test('pipeline insights validate evidence and numerical claims and assign server metadata',()=>{
 const load=loader(),{pipelineAnalytics}=load('src/lib/analytics.ts'),{pipelineMetricCatalog,validatePipelineInsight}=load('src/lib/pipeline-insights.ts');
 const stats=pipelineAnalytics([sample()]),catalog=pipelineMetricCatalog(stats),metadata={scope:'OTHER',generatedAt:'2026-10-14T00:00:00Z',snapshotVersion:'server-version',reportingDate:'2026-10-14'};
 const raw=insightFixture();raw.observations[0].claims=[{metric:'pipeline.submitted',value:1}];raw.scope='forged';raw.snapshotVersion='forged';
 const report=validatePipelineInsight(raw,catalog,metadata,['No usable callback dates.']);assert.equal(report.scope,'OTHER');assert.equal(report.snapshotVersion,'server-version');assert.equal(report.observations[0].evidence[0].display,'1 application');assert.equal(report.limitations[0],'No usable callback dates.');
 for(const change of [r=>r.observations[0].claims[0].value=999,r=>r.observations[0].evidence=['foreign.metric'],r=>r.summary='You have 999 applications.',r=>r.summary='Private email user@example.com',r=>r.recommendations='invalid',r=>r.implications=Array(4).fill(r.observations[0]),r=>r.observations[0].claims=[{metric:'pipeline.offerRate',value:0}]]){const invalid=structuredClone(raw);change(invalid);assert.throws(()=>validatePipelineInsight(invalid,catalog,metadata,[]),/invalid insight|unsupported numerical claim/);}
 assert.throws(()=>validatePipelineInsight(null,catalog,metadata,[]),/invalid insight/);
});

test('insight context minimizes personal data, preserves manual fits and supports missing resumes and nontechnical scopes',async()=>{
 const user={id:'member',name:'Private Candidate',email:'candidate@example.com',role:'member'};
 let resume='Private Candidate\nEmail: candidate@example.com\nAddress: SECRET STREET\nPhone: +63 912 345 6789\nRetail sales and customer service experience.\nReferences\nSECRET REFEREE';
 let preferences={target_roles:['Retail associate'],dealbreakers:'Daytime shifts',salary_currency:'PHP'};
 const rows=[sample({id:'retail',owner:'member',role_title:'Retail Associate',company_name:'PRIVATE_COMPANY',notes:'PRIVATE_NOTES',information:'PRIVATE_JOB_DESCRIPTION',offer_amount:20000,expected_salary_amount:22000,role_fit:'WEAK',role_fit_source:'manual',role_fit_analysis:{fit:'STRONG',explanation:'Customer service qualifications match this role.',strengths:['Retail sales'],gaps:['Management experience']}}),sample({id:'intern',owner:'member',job_type:'INTERNSHIP',role_title:'Sales Intern',date_applied:'2024-01-01',status:'OFFER'})];
 const load=loader({'@/lib/db':{getCandidateProfile:async owner=>{assert.equal(owner,user.id);return resume;},getCandidatePreferences:async owner=>{assert.equal(owner,user.id);return preferences;},getAnalyticsApplications:async account=>{assert.equal(account.id,user.id);return rows;}}});
 const {pipelineInsightContext}=load('src/lib/pipeline-insight-context.ts');const combined=await pipelineInsightContext(user,'ALL');const data=JSON.stringify(combined.payload);
 assert.doesNotMatch(data,/PRIVATE_COMPANY|PRIVATE_NOTES|PRIVATE_JOB_DESCRIPTION|SECRET STREET|SECRET REFEREE|candidate@example|912 345|Private Candidate/);
 const retail=combined.payload.applicationContext.records.find(row=>row.role==='Retail Associate');assert.equal(retail.effectiveRoleFit,'WEAK');assert.equal(retail.savedAssessment.fit,'STRONG');assert.equal(retail.fitSource,'manual');assert.match(combined.payload.candidate.resume,/Retail sales/);
 assert.equal((await pipelineInsightContext(user,'INTERNSHIP')).stats.total,1);assert.equal((await pipelineInsightContext(user,'OTHER')).stats.total,1);
 const stable=await pipelineInsightContext(user,'ALL');assert.equal(stable.snapshotVersion,combined.snapshotVersion);
 preferences={...preferences,target_roles:['Store supervisor']};assert.notEqual((await pipelineInsightContext(user,'ALL')).snapshotVersion,combined.snapshotVersion);
 resume='';const missing=await pipelineInsightContext(user,'OTHER');assert.equal(missing.payload.candidate.source,'missing');assert.ok(missing.limitations.some(text=>text.includes('No master resume')));assert.equal(missing.stats.total,1);
 rows[0]={...rows[0],status:'OFFER'};assert.notEqual((await pipelineInsightContext(user,'OTHER')).snapshotVersion,missing.snapshotVersion);
 const largeRows=Array.from({length:220},(_,i)=>sample({id:String(i),owner:user.id,role_title:'Occupation'+i+' Specialist'}));rows.splice(0,rows.length,...largeRows);const large=await pipelineInsightContext(user,'ALL');assert.equal(large.payload.applicationContext.records.length,200);assert.equal(large.payload.dimensions.keywords.length,12);assert.equal(large.stats.total,220);
});

test('saved insights are scoped, marked outdated, never auto-generated and retained after invalid AI or provider failures',async()=>{
 const user={id:'member',name:'Member',email:'member@example.com'};let rows=[sample({owner:'member'})],stored=null,calls=0,mode='valid',saved=0,released=0;
 const load=loader({'@/lib/session-account':{getSessionAccount:async()=>user},'@/lib/db':{getAnalyticsApplications:async()=>rows,getPipelineInsight:async(owner,scope)=>{assert.equal(owner,'member');return stored?.scope===scope?stored:null;},savePipelineInsight:async(owner,scope,report)=>{assert.equal(owner,'member');assert.equal(scope,'OTHER');stored=report;saved++;return true;},releasePipelineInsight:async()=>released++},'@/lib/ai':{callGeminiJSON:async()=>{calls++;if(mode==='error')throw Error('SECRET_PROVIDER_ERROR');if(mode==='malformed')return {summary:'invalid'};if(mode==='number'){const raw=insightFixture();raw.observations[0].claims=[{metric:'pipeline.submitted',value:999}];return raw;}return insightFixture();}}});
 const get=load('src/app/api/analytics/insights/route.ts'),post=load('src/app/api/analytics/analyze/route.ts'),request=()=>new Request('http://local/api/analytics/analyze',{method:'POST',body:JSON.stringify({scope:'OTHER',owner:'foreign'})});
 assert.equal((await (await get.GET(new Request('http://local/api/analytics/insights?scope=OTHER'))).json()).data.report,null);assert.equal(calls,0);
 const result=await post.POST(request());assert.equal(result.status,200);assert.equal(result.headers.get('cache-control'),'private, no-store');assert.equal(stored.scope,'OTHER');assert.equal(saved,1);
 const read=async scope=>(await (await get.GET(new Request('http://local/api/analytics/insights?scope='+scope))).json()).data;
 assert.equal((await read('OTHER')).outdated,false);assert.equal((await read('ALL')).report,null);assert.equal(calls,1);
 rows.push(sample({id:'new',owner:'member',date_applied:undefined}));assert.equal((await read('OTHER')).outdated,true);assert.equal(calls,1);
 for(mode of ['error','malformed','number']){const response=await post.POST(request());assert.equal(response.status,502);assert.doesNotMatch(JSON.stringify(await response.json()),/SECRET_PROVIDER_ERROR|999/);assert.equal(saved,1);assert.equal((await read('OTHER')).report.generatedAt,stored.generatedAt);}
 assert.equal(released,4);
 const invalid=await post.POST(new Request('http://local',{method:'POST',body:'{"scope":"forged"}'}));assert.equal(invalid.status,400);
 rows=[];assert.equal((await post.POST(request())).status,422);assert.equal(calls,4);
 const anonymous=loader({'@/lib/session-account':{getSessionAccount:async()=>null},'@/lib/db':{},'@/lib/ai':{callGeminiJSON:()=>{throw Error('Must not run');}}});assert.equal((await anonymous('src/app/api/analytics/insights/route.ts').GET(new Request('http://local'))).status,401);assert.equal((await anonymous('src/app/api/analytics/analyze/route.ts').POST(request())).status,401);
});

test('local insight leases prevent duplicate requests and keep profiles and last successful reports intact',async()=>{
 const original=process.cwd(),directory=fs.mkdtempSync(path.join(os.tmpdir(),'job-hunt-insights-')),env=Object.fromEntries(['POSTGRES_URL','DATABASE_URL','VERCEL'].map(key=>[key,process.env[key]]));
 try{for(const key of Object.keys(env))delete process.env[key];process.chdir(directory);const db=loader()('src/lib/db.ts');
  await db.saveCandidateProfile('member','Saved retail resume');await db.saveCandidatePreferences('member',{target_roles:['Retail associate']});
  assert.deepEqual(await Promise.all([db.claimPipelineInsight('member','ALL','one'),db.claimPipelineInsight('member','ALL','two')]),[true,false]);
  const report={summary:'Saved report',scope:'ALL',snapshotVersion:'version',generatedAt:'2026-10-14',reportingDate:'2026-10-14',observations:[],implications:[],recommendations:[],limitations:[]};
  assert.equal(await db.savePipelineInsight('member','ALL',report,'two'),false);assert.equal(await db.savePipelineInsight('member','ALL',report,'one'),true);
  await db.releasePipelineInsight('member','ALL','two');assert.equal(await db.claimPipelineInsight('member','ALL','three'),false);await db.releasePipelineInsight('member','ALL','one');assert.equal(await db.claimPipelineInsight('member','ALL','three'),true);
  assert.deepEqual(await db.getPipelineInsight('member','ALL'),report);assert.equal(await db.getPipelineInsight('other','ALL'),null);assert.equal(await db.getPipelineInsight('member','OTHER'),null);assert.equal(await db.getCandidateProfile('member'),'Saved retail resume');assert.deepEqual((await db.getCandidatePreferences('member')).target_roles,['Retail associate']);
  await db.releasePipelineInsight('member','ALL','three');assert.deepEqual(await db.getPipelineInsight('member','ALL'),report);
 }finally{process.chdir(original);for(const [key,value]of Object.entries(env)){if(value===undefined)delete process.env[key];else process.env[key]=value;}assert.equal(path.dirname(directory),os.tmpdir());fs.rmSync(directory,{recursive:true,force:true});}
});

test('simultaneous insight POSTs reject the duplicate before invoking AI',async()=>{
 let busy=false,calls=0,resolveAI,started;
 const ready=new Promise(resolve=>{started=resolve;});
 const load=loader({'@/lib/session-account':{getSessionAccount:async()=>({id:'member',name:'Member',email:'member@example.com'})},'@/lib/db':{getAnalyticsApplications:async()=>[sample()],claimPipelineInsight:async()=>{if(busy)return false;busy=true;return true;},releasePipelineInsight:async()=>{busy=false;}},'@/lib/ai':{callGeminiJSON:async()=>{calls++;started();return new Promise(resolve=>{resolveAI=resolve;});}}});
 const post=load('src/app/api/analytics/analyze/route.ts').POST,request=()=>new Request('http://local',{method:'POST',body:'{"scope":"ALL"}'});
 const first=post(request());await ready;assert.equal((await post(request())).status,409);assert.equal(calls,1);resolveAI(insightFixture());assert.equal((await first).status,200);assert.equal(busy,false);
});

test('Postgres insight leases bind ownership and perform atomic guarded writes without replacing resumes',async()=>{
 const previous=process.env.POSTGRES_URL,queries=[];const sql=async(strings,...values)=>{queries.push({query:strings.join('?'),values});return [{owner:'member'}];};
 try{process.env.POSTGRES_URL='postgres://mock-only';const db=loader({'@neondatabase/serverless':{neon:()=>sql}})('src/lib/db.ts');
  assert.equal(await db.claimPipelineInsight('member','OTHER','token'),true);await db.savePipelineInsight('member','OTHER',{summary:'Saved'},'token');await db.releasePipelineInsight('member','OTHER','token');await db.getPipelineInsight('member','OTHER');
  assert.match(queries[0].query,/ON CONFLICT\(owner\).*DO UPDATE/s);assert.match(queries[0].query,/WHERE coalesce.*expiresAt/s);assert.doesNotMatch(queries[0].query,/SET resume_text/);assert.ok(queries[0].values.includes('member'));assert.ok(queries[0].values.includes('OTHER'));
  for(const query of queries.slice(1,3)){assert.match(query.query,/WHERE owner=.*token/s);assert.ok(query.values.includes('token'));assert.ok(query.values.includes('member'));}
 }finally{if(previous===undefined)delete process.env.POSTGRES_URL;else process.env.POSTGRES_URL=previous;}
});
test('members can read their own account record but cannot list or modify other accounts',async()=>{
 const me={id:'member',email:'member@example.com',role:'member'};const load=loader({'@/lib/session-account':{getSessionAccount:async()=>me},'@/lib/db':{getUsers:async()=>[me,{id:'other',email:'other@example.com'}],getUserById:async()=>me,updateUser:async()=>{throw Error('Unexpected write');},deleteUser:async()=>{throw Error('Unexpected delete');}}});const list=load('src/app/api/users/route.ts');assert.deepEqual((await (await list.GET()).json()).data.map(user=>user.id),['member']);const route=load('src/app/api/users/[id]/route.ts');assert.equal((await route.GET(new Request('http://local'),{params:Promise.resolve({id:'other'})})).status,404);assert.equal((await route.PUT(new Request('http://local',{method:'PUT',body:JSON.stringify({role:'admin'})}),{params:Promise.resolve({id:'member'})})).status,403);assert.equal((await route.DELETE(new Request('http://local',{method:'DELETE'}),{params:Promise.resolve({id:'other'})})).status,403);
});

test('job JSON imports only validated draft fields and rejects candidate data',()=>{
 const {parseJobImport}=loader()('src/lib/job-import.ts');const job=parseJobImport(JSON.stringify({job:{title:'Developer',company:{name:'Example'},qualifications:['Python','SQL'],location:'Makati',work_model:'On-site',employment_type:'Full-time',salary:{min:25000,max:35000,currency:'php'},owner:'friend',status:'ACCEPTED'}}));assert.equal(job.role_title,'Developer');assert.equal(job.work_model,'ON_SITE');assert.equal(job.salary_currency,'PHP');assert.match(job.job_description,/SQL/);assert.equal(job.owner,undefined);assert.equal(job.status,undefined);assert.throws(()=>parseJobImport('{bad'));assert.throws(()=>parseJobImport(JSON.stringify({candidate:{name:'Person'}})));assert.throws(()=>parseJobImport(JSON.stringify({title:'Dev',salary_min:50,salary_max:10})));assert.throws(()=>parseJobImport(JSON.stringify({title:'Dev',job_url:'javascript:alert(1)'})));
});

test('job JSON preserves structured descriptions, responsibilities and qualifications',()=>{
 const {parseJobImport}=loader()('src/lib/job-import.ts');
 const job=parseJobImport(JSON.stringify({job_title:'AI Forward Deployed Engineer',company:'Globe Telecom',location:'Taguig, National Capital Region, Philippines',workplace_type:'On-site',employment_type:'Full-time',description:{overview:'Build enterprise AI applications.',key_responsibilities:['Integrate models with business systems.','Measure reliability.']},qualifications:{required:['Python','SQL'],preferred:'Experience deploying AI services.'},notes:'Candidate notes must stay separate.'}));
 assert.equal(job.role_title,'AI Forward Deployed Engineer');assert.equal(job.work_model,'ON_SITE');assert.equal(job.job_type,'FULL_TIME');assert.match(job.job_description,/Overview:\nBuild enterprise AI applications\./);assert.match(job.job_description,/Key responsibilities:\n- Integrate models/);assert.match(job.job_description,/Qualifications:\nRequired:\n- Python\n- SQL/);assert.equal(job.notes,undefined);
 const bullets=parseJobImport(JSON.stringify({description:['Build APIs.','Support users.'],responsibilities:['Review deployments.'],requirements:'Experience with Python.'}));assert.match(bullets.job_description,/- Build APIs\.\n- Support users\./);assert.match(bullets.job_description,/Responsibilities:\n- Review deployments\./);assert.match(bullets.job_description,/Qualifications:\nExperience with Python\./);
 assert.throws(()=>parseJobImport(JSON.stringify({description:{overview:123}})),/must contain text/);
 assert.throws(()=>parseJobImport(JSON.stringify({candidate:{professional_summary:'Python developer',qualifications:['Python']}})),/Candidate\/profile JSON/);
});

test('Gemini JSON supports new fields while classification remains deterministic',()=>{
 const {parseJobImport,JOB_JSON_PROMPT}=loader()('src/lib/job-import.ts');
 for(const key of ['seniority_level','job_platform','first_response_at'])assert.ok(JOB_JSON_PROMPT.includes(key));
 assert.match(JOB_JSON_PROMPT,/do not classify it with AI/);assert.doesNotMatch(JOB_JSON_PROMPT,/role_family/);assert.match(JOB_JSON_PROMPT,/application_age/);
 const junior=parseJobImport(JSON.stringify({role_title:'Junior Software Developer',seniority_level:'SENIOR',seniority_level_source:'manual',role_family:'Invented family',role_family_source:'manual',job_url:'https://www.linkedin.com/jobs/view/123',first_response_at:null}));
 assert.equal(junior.seniority_level,'JUNIOR');assert.equal(junior.seniority_level_source,'derived');assert.equal(junior.role_family,undefined);assert.equal(junior.role_family_source,undefined);assert.equal(junior.job_platform,'LINKEDIN');assert.equal(junior.first_response_at,undefined);
 const bare=parseJobImport(JSON.stringify({role_title:'AI Engineer',seniority_level:'MID_LEVEL'}));assert.equal(bare.seniority_level,'UNSPECIFIED');
 for(const field of ['work_model','job_type'])assert.throws(()=>parseJobImport(JSON.stringify({role_title:'Constructor',[field]:'constructor'})),/must be/);
 const referral=parseJobImport(JSON.stringify({title:'Engineer',job_platform:'Referral',job_url:'https://app.example.com/jobs/1',first_response_at:'2026-10-05T12:30:00+08:00'}));
 assert.equal(referral.job_platform,'REFERRAL');assert.equal(referral.first_response_at,'2026-10-05T04:30:00.000Z');
 assert.equal(parseJobImport(JSON.stringify({title:'Associate',job_platform:'WALK_IN'})).job_platform,'Walk-in');
 assert.equal(parseJobImport(JSON.stringify({title:'Engineer',job_platform:'Custom channel'})).job_platform,'Custom channel');
 assert.equal(parseJobImport(JSON.stringify({title:'Engineer',job_url:'https://appficiency.bamboohr.com/careers/123'})).job_platform,'BAMBOOHR');
 assert.equal(parseJobImport(JSON.stringify({title:'Engineer',published_at:'2026-10-01',date_applied:'2026-10-02',status:'SCREENING'})).first_response_at,undefined);
 for(const value of ['invalid','2026-10-05','2026-02-30T12:00:00Z'])assert.throws(()=>parseJobImport(JSON.stringify({title:'Engineer',first_response_at:value})),/response/);
 assert.throws(()=>parseJobImport(JSON.stringify({title:'Engineer',job_platform:42})),/must be text/);
 assert.throws(()=>parseJobImport(JSON.stringify({title:'Engineer',job_platform:'x'.repeat(201)})),/200/);
});

test('salary displays group numeric database strings, retain zero and preserve unknown currency',()=>{
 const {formatSalaryRange}=loader()('src/lib/currencies.ts');
 assert.equal(formatSalaryRange('60000.00','80000.00'),'Currency unknown 60,000.00 – 80,000.00');
 assert.equal(formatSalaryRange(50000.5,75000.75,'php'),'PHP 50,000.50 – 75,000.75');
 assert.equal(formatSalaryRange(1200,2000,'USD'),'USD 1,200.00 – 2,000.00');
 assert.equal(formatSalaryRange(0,undefined),'Currency unknown 0.00');
 assert.equal(formatSalaryRange(undefined,80000),'Up to Currency unknown 80,000.00');
 assert.equal(formatSalaryRange(null,'',null),'');assert.equal(formatSalaryRange(NaN,Infinity),'');
});

test('screening statuses map to screening without changing interview or rejection categories',()=>{
 const {getStatusCategory}=loader()('src/lib/statuses.ts');
 assert.equal(getStatusCategory('Screening Call'),'SCREENING');
 assert.equal(getStatusCategory('Online Assessment'),'SCREENING');
 assert.equal(getStatusCategory('Online Assessment - Rejected'),'REJECTED');
 assert.equal(getStatusCategory('Screening / Interview'),'INTERVIEWING');
 assert.equal(getStatusCategory('Initial Interview'),'INTERVIEWING');
 assert.equal(getStatusCategory('Technical Test'),'INTERVIEWING');
 assert.equal(getStatusCategory('Screening - Not Accepted'),'REJECTED');
 assert.equal(getStatusCategory('Screening - Rejected'),'REJECTED');
});

test('assessment outcomes stay separate from reached phases, including legacy Applied records', () => {
 const load=loader();const statuses=load('src/lib/statuses.ts');const stages=load('src/lib/analytics-stages.ts');const workflow=load('src/lib/application-workflow.ts');const {pipelineAnalytics}=load('src/lib/analytics.ts');
 for(const name of ['Failed Assessment','Failed Online Assessment','Failed In Person Assessment','Interview - Rejected','Technical Test - Failed']) assert.equal(statuses.getStatusCategory(name),'REJECTED',name);
 for(const name of ['Assessment','Online Assessment','In Person Assessment']) {
  assert.equal(statuses.getStatusCategory(name),'SCREENING');
  assert.equal(workflow.displayApplicationStatus(sample({status:'APPLIED',notion_status:name})),'SCREENING');
 }
 const failed=sample({status:'APPLIED',notion_status:'Failed Online Assessment'});
 assert.equal(workflow.displayApplicationStatusLabel(failed),'Failed Assessment');
 assert.equal(workflow.displayApplicationStatus(failed),'REJECTED');
 assert.equal(load('src/lib/analytics.ts').currentOutcome(failed,{},[]),'OTHER_CLOSED');
 assert.equal(stages.stageForStatus(failed.notion_status,failed.status),'SCREENING');
 assert.equal(stages.stageForStatus('Failed Assessment','REJECTED',{'failed online assessment':'INTERVIEW'}),'INTERVIEW');
 const updates=workflow.applicationWorkflowUpdates(failed,{notion_status:'Failed Online Assessment'});
 assert.equal(updates.status,'REJECTED');assert.equal(updates.notion_status,'Failed Assessment');assert.equal(updates.analytics_stage,'SCREENING');
 const stats=pipelineAnalytics([failed,sample({id:'active',notion_status:'Online Assessment'}),sample({id:'physical',notion_status:'In Person Assessment'})]);
 assert.equal(stats.rejections,1);assert.equal(stats.funnel[1].count,3);assert.equal(stats.funnel[2].count,0);
 const mapped=sample({notion_status:'Company reviewing'});
 assert.equal(workflow.displayApplicationStatus(mapped,{'company reviewing':'SCREENING'}),'SCREENING');
 assert.equal(workflow.displayApplicationStatus(mapped,{'company reviewing':'SCREENING'},['Company reviewing']),'REJECTED');
 assert.equal(workflow.displayApplicationStatus({...mapped,not_proceeding:true},{},['Company reviewing']),'WITHDRAWN');
 const {validatePreferences}=load('src/lib/preferences.ts');const prefs=validatePreferences({analytics_status_stages:{'Failed Online Assessment':'SCREENING'},analytics_rejection_statuses:['Failed Online Assessment']});
 assert.deepEqual(prefs.analytics_rejection_statuses,['failed assessment']);assert.equal(prefs.analytics_status_stages['failed assessment'],'SCREENING');
});
test('preferences validate fields and save only to the signed-in account',async()=>{
 const {validatePreferences}=loader()('src/lib/preferences.ts');assert.throws(()=>validatePreferences({work_models:['INVALID']}));assert.throws(()=>validatePreferences({salary_min:-1}));let saved;const route=loader({'@/lib/session-account':{getSessionAccount:async()=>({id:'member'})},'@/lib/db':{getCandidatePreferences:async()=>null,saveCandidatePreferences:async(owner,data)=>{saved={owner,data};}}})('src/app/api/preferences/route.ts');assert.equal((await (await route.GET()).json()).data.salary_currency,'PHP');const response=await route.PUT(new Request('http://local',{method:'PUT',body:JSON.stringify({owner:'friend',target_roles:['Developer','Developer'],portfolio_summary:'Built Python tools',work_models:['REMOTE']})}));assert.equal(response.status,200);assert.equal(saved.owner,'member');assert.deepEqual(saved.data.target_roles,['Developer']);assert.equal(saved.data.portfolio_summary,'Built Python tools');
});

test('default view persists per account while new and legacy member preferences keep all job types',async()=>{
 let user={id:'admin'};const saved={legacy:{target_roles:['Analyst']}};
 const route=loader({'@/lib/session-account':{getSessionAccount:async()=>user},'@/lib/db':{getCandidatePreferences:async owner=>saved[owner]||null,saveCandidatePreferences:async(owner,data)=>{saved[owner]=data;}}})('src/app/api/preferences/route.ts');
 const put=value=>route.PUT(new Request('http://local',{method:'PUT',body:JSON.stringify({default_view:value,target_roles:['Developer']})}));
 assert.equal((await put('OTHER')).status,200);assert.equal((await(await route.GET()).json()).data.default_view,'OTHER');
 user={id:'member'};assert.equal((await(await route.GET()).json()).data.default_view,'ALL');
 assert.equal((await put('INTERNSHIP')).status,200);assert.equal((await(await route.GET()).json()).data.default_view,'INTERNSHIP');assert.equal(saved.admin.default_view,'OTHER');
 assert.equal((await put('FULL_TIME')).status,400);assert.equal(saved.member.default_view,'INTERNSHIP');
 user={id:'legacy'};const legacy=(await(await route.GET()).json()).data;assert.equal(legacy.default_view,'ALL');assert.deepEqual(legacy.target_roles,['Analyst']);
});

test('imports the Appficiency jobDetails JSON from LLM.txt',()=>{const fs=require('fs');const raw=fs.readFileSync('references/appficiency_job.json','utf8');const job=loader()('src/lib/job-import.ts').parseJobImport(raw);assert.equal(job.role_title,'Junior Solutions Architect');assert.equal(job.company_name,'Appficiency');assert.equal(job.work_model,'REMOTE');assert.equal(job.job_type,'FULL_TIME');assert.equal(job.job_url,'https://appficiency.bamboohr.com/careers/29');assert.match(job.location,/Makati/);assert.equal(job.owner,undefined);assert.equal(job.job_description,undefined);});

test('legacy admin email configuration resolves to the actual email',()=>{const {getAdminEmail}=loader()('src/lib/admin-email.ts');const previous=process.env.ADMIN_EMAIL;try{process.env.ADMIN_EMAIL='jizellecasia@gmail.com';assert.equal(getAdminEmail(),'jizelle.casia@gmail.com');delete process.env.ADMIN_EMAIL;assert.equal(getAdminEmail(),'jizelle.casia@gmail.com');}finally{if(previous===undefined)delete process.env.ADMIN_EMAIL;else process.env.ADMIN_EMAIL=previous;}});

test('custom analytics mappings and explicit phases preserve Not Proceeding progress',()=>{
 const {pipelineAnalytics}=loader()('src/lib/analytics.ts');
 const rows=[sample({notion_status:'Not Proceeding',status:'WITHDRAWN',analytics_stage:'INTERVIEW',not_proceeding:true}),sample({id:'test',notion_status:'Company test',status:'APPLIED'}),sample({id:'offer',notion_status:'Accepted - Not Proceeding',status:'OFFER',not_proceeding:true})];
 const before=pipelineAnalytics(rows);assert.equal(before.funnel[1].count,2);assert.equal(before.funnel[4].count,1);
 const configured=pipelineAnalytics(rows,{'company test':'SCREENING','accepted - not proceeding':'OFFER'});assert.equal(configured.funnel[1].count,3);assert.equal(configured.funnel[2].count,2);assert.equal(configured.funnel[4].count,1);assert.equal(configured.funnel[1].label,'Screening');
 const overridden=pipelineAnalytics([sample({notion_status:'Company test',status:'APPLIED'})],{'company test':'NOT_SUBMITTED'});assert.equal(overridden.submitted,0);
 const {validatePreferences}=loader()('src/lib/preferences.ts');assert.equal(validatePreferences({analytics_status_stages:{'Company Test':'SCREENING'}}).analytics_status_stages['company test'],'SCREENING');assert.throws(()=>validatePreferences({analytics_status_stages:{anything:'MADE_UP'}}));
});

test('rejections use selected current statuses and preserve reached phases',()=>{
 const {pipelineAnalytics}=loader()('src/lib/analytics.ts');
 const apps=[
  sample({id:'declined',role_fit:'STRONG',notion_status:'Not Accepted',status:'REJECTED',stage_history:[{status:'INTERVIEWING',notion_status:'Final Interview',at:'2026-10-10'}]}),
  sample({id:'future',role_fit:'POSSIBLE',notion_status:'Rejected',status:'REJECTED'}),
  sample({id:'withdrawn',notion_status:'Not Proceeding',status:'WITHDRAWN'}),
  sample({id:'duplicate',notion_status:'Repeated',status:'REJECTED'}),
  sample({id:'no-interns',notion_status:'Not Accepting Interns',status:'REJECTED'}),
  sample({id:'now-accepted',notion_status:'Accepted',status:'ACCEPTED',stage_history:[{status:'REJECTED',notion_status:'Not Accepted',at:'2026-10-10'}]}),
 ];
 const before=pipelineAnalytics(apps);assert.equal(before.rejections,1);assert.equal(before.rejectionRate,25);assert.equal(before.fits[0].rejections,1);assert.equal(before.fits[0].rejectionRate,100);assert.equal(before.funnel[3].count,2);
 const selected=pipelineAnalytics(apps,{},['NOT ACCEPTED','Rejected','not accepted']);assert.equal(selected.rejections,2);assert.equal(selected.rejectionRate,50);assert.equal(selected.fits[1].rejections,1);assert.equal(selected.funnel[3].count,before.funnel[3].count);
 assert.equal(pipelineAnalytics(apps,{},[]).rejections,0);assert.equal(pipelineAnalytics([]).rejectionRate,null);
 const {validatePreferences}=loader()('src/lib/preferences.ts');assert.deepEqual(validatePreferences({}).analytics_rejection_statuses,['Not Accepted','Failed Assessment']);assert.deepEqual(validatePreferences({analytics_rejection_statuses:['Rejected','rejected','Not Accepted']}).analytics_rejection_statuses,['rejected','not accepted']);assert.deepEqual(validatePreferences({analytics_rejection_statuses:[]}).analytics_rejection_statuses,[]);assert.throws(()=>validatePreferences({analytics_rejection_statuses:'Rejected'}));
});

test('legacy withdrawal labels cannot reappear as a live status option',async()=>{
 const {getStatusCategory,canonicalStatusName,SEEDED_STATUS_OPTIONS}=loader()('src/lib/statuses.ts');assert.equal(canonicalStatusName(' Do not Proceed '),'Not Proceeding');assert.equal(getStatusCategory('Do not Proceed'),'WITHDRAWN');assert.equal(getStatusCategory('Not Proceeding'),'WITHDRAWN');assert.equal(SEEDED_STATUS_OPTIONS.some(status=>/^do not proceed$/i.test(status.name)),false);
 const app=sample({notion_status:'Not Proceeding',status:'WITHDRAWN',stage_history:[{status:'WITHDRAWN',notion_status:'Do not Proceed',at:'2026-10-10'}]});
 const route=loader({'@/lib/session-account':{getSessionAccount:async()=>({id:'user_ji',email:'ji@example.com',role:'admin'})},'@/lib/db':{getApplications:async()=>[app],getCustomStatuses:async()=>[{id:'legacy',name:'Do not Proceed',owner:'user_ji',category:'WITHDRAWN'}]}})('src/app/api/statuses/route.ts');
 const statuses=(await(await route.GET()).json()).data;assert.equal(statuses.filter(status=>status.name==='Not Proceeding').length,1);assert.equal(statuses.some(status=>/^do not proceed$/i.test(status.name)),false);
 const {validatePreferences}=loader()('src/lib/preferences.ts');assert.equal(validatePreferences({analytics_status_stages:{'Do not Proceed':'INTERVIEW'}}).analytics_status_stages['not proceeding'],'INTERVIEW');
});

test('member status defaults and custom options are isolated from admin stages', async () => {
 let user={id:'member',role:'member'};let created;
 const route=loader({'@/lib/session-account':{getSessionAccount:async()=>user},'@/lib/db':{getCustomStatuses:async()=>[{id:'old',name:'Admin old'},{id:'mine',name:'My review',owner:'member'},{id:'other',name:'Private review',owner:'friend'}],getApplications:async()=>[],createCustomStatus:async data=>{created=data;return data;}}})('src/app/api/statuses/route.ts');
 const result=await (await route.GET()).json();assert.deepEqual(result.data.map(s=>s.name),['Not started','Applied','Screening / Interview','Accepted','Not Proceeding','My review']);
 assert.equal((await route.POST(new Request('http://local',{method:'POST',body:JSON.stringify({name:'Phone call',owner:'friend'})}))).status,201);assert.equal(created.owner,'member');
 user={id:'admin',role:'admin'};const admin=await (await route.GET()).json();assert.ok(admin.data.some(s=>s.name==='Technical Interview'));assert.ok(admin.data.some(s=>s.name==='Admin old'));assert.equal(admin.data.some(s=>s.name==='My review'),false);
 user=null;assert.equal((await route.GET()).status,401);assert.equal((await route.POST(new Request('http://local',{method:'POST',body:'{}'}))).status,401);
});

test('removed preset lead feed stays empty for every authenticated account', async () => {
 let user={id:'admin',role:'admin'};
 const route=loader({'@/lib/session-account':{getSessionAccount:async()=>user}})('src/app/api/leads/route.ts');
 for(const role of ['admin','member']){user={id:role,role};const response=await route.GET(new Request('http://local/api/leads?role=admin&q=React&source=LinkedIn'));assert.equal(response.status,200);const result=await response.json();assert.deepEqual(result.data,[]);assert.equal(result.portfolioConnected,false);assert.equal(result.matchedProfile,undefined);}
 user=null;assert.equal((await route.GET()).status,401);
});

test('automatic capture and retention for date_applied and first_response_at', async () => {
 const workflow = loader()('src/lib/application-workflow.ts');
 const { isScreeningOrProgression, applicationWorkflowUpdates } = workflow;

 assert.equal(isScreeningOrProgression('Not started', 'LEAD'), false);
 assert.equal(isScreeningOrProgression('Applied', 'APPLIED'), false);
 assert.equal(isScreeningOrProgression('Screening', 'SCREENING'), true);
 assert.equal(isScreeningOrProgression('Assessment', 'SCREENING'), true);
 assert.equal(isScreeningOrProgression('Initial Interview', 'INTERVIEWING'), true);
 assert.equal(isScreeningOrProgression('Technical Interview', 'INTERVIEWING'), true);
 assert.equal(isScreeningOrProgression('Final Interview', 'INTERVIEWING'), true);
 assert.equal(isScreeningOrProgression('Accepted', 'ACCEPTED'), true);
 assert.equal(isScreeningOrProgression('Not Accepted', 'REJECTED'), false);
 assert.equal(isScreeningOrProgression('Failed Assessment', 'REJECTED'), false);
 assert.equal(isScreeningOrProgression('Not Proceeding', 'WITHDRAWN'), false);
 assert.equal(isScreeningOrProgression('Custom Review', 'APPLIED', { 'custom review': 'SCREENING' }), true);

 const lead = sample({ status: 'LEAD', notion_status: 'Not started', date_applied: undefined });
 const applied = applicationWorkflowUpdates(lead, { status: 'APPLIED', notion_status: 'Applied' });
 assert.ok(applied.date_applied);
 assert.equal(applied.first_response_at, undefined);

 const keptApplied = applicationWorkflowUpdates(applied, { notes: 'Updated notes' });
 assert.equal(keptApplied.date_applied, applied.date_applied);

 const existingDate = '2026-10-15T00:00:00.000Z';
 const manualApp = sample({ status: 'LEAD', date_applied: existingDate });
 const updatedManual = applicationWorkflowUpdates(manualApp, { status: 'APPLIED', notion_status: 'Applied' });
 assert.equal(updatedManual.date_applied, existingDate);

 const inScreening = applicationWorkflowUpdates(applied, { status: 'SCREENING', notion_status: 'Screening' });
 assert.ok(inScreening.first_response_at);
 assert.equal(inScreening.date_applied, applied.date_applied);

 const inInterview = applicationWorkflowUpdates(inScreening, { status: 'INTERVIEWING', notion_status: 'Technical Interview' });
 assert.equal(inInterview.first_response_at, inScreening.first_response_at);

 const inAssessment = applicationWorkflowUpdates(applied, { status: 'SCREENING', notion_status: 'Online Assessment' });
 assert.ok(inAssessment.first_response_at);

 const inCustom = applicationWorkflowUpdates(applied, { status: 'APPLIED', notion_status: 'Custom Review' }, { 'custom review': 'SCREENING' });
 assert.ok(inCustom.first_response_at);

 const rejected = applicationWorkflowUpdates(applied, { status: 'REJECTED', notion_status: 'Not Accepted' });
 assert.equal(rejected.first_response_at, undefined);

 const explicitDate = '2026-10-20T12:00:00.000Z';
 const overridden = applicationWorkflowUpdates(applied, { status: 'SCREENING', notion_status: 'Screening', first_response_at: explicitDate });
 assert.equal(overridden.first_response_at, explicitDate);
});
