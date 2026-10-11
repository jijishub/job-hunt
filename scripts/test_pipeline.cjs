const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const os=require('node:os');const Module=require('node:module');const ts=require('typescript');
const ROOT=path.resolve(__dirname,'..');
function loader(overrides={}){
 if(overrides['@/lib/db']) overrides['@/lib/db']={getCandidatePreferences:async()=>null,getCandidateProfile:async()=> 'Saved member master resume',...overrides['@/lib/db']};
 const cache=new Map();
 function load(file){const filename=path.resolve(ROOT,file);if(cache.has(filename))return cache.get(filename).exports;const m=new Module(filename,module);m.filename=filename;m.paths=Module._nodeModulePaths(path.dirname(filename));cache.set(filename,m);const original=m.require.bind(m);m.require=id=>{if(Object.hasOwn(overrides,id))return overrides[id];const target=id.startsWith('@/')?path.join(ROOT,'src',id.slice(2)):id.startsWith('.')?path.resolve(path.dirname(filename),id):null;if(target){if(target.endsWith('.json'))return original(target);if(fs.existsSync(target+'.ts'))return load(target+'.ts');}return original(id);};m._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,filename);return m.exports;}
 return load;
}
const sample=(values={})=>({id:'app',company_name:'Example',role_title:'Engineer',status:'APPLIED',owner:'user_ji',priority:'MEDIUM',job_type:'FULL_TIME',work_model:'ON_SITE',salary_currency:'PHP',sync_status:'SYNCED',created_at:'2026-10-10T00:00:00Z',updated_at:'2026-10-10T00:00:00Z',...values});

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
 const load=loader({'@/lib/session-account':{getSessionAccount:async()=>member},'@/lib/db':{getCandidateProfile:async id=>{assert.equal(id,'member');return profile;},getApplicationById:async()=>app,getApplications:async()=>[app,sample({owner:'other',id:'foreign',status:'ACCEPTED'})]},'@/lib/portfolio-evidence':{portfolioEvidence:async()=>{throw Error('Member accessed admin portfolio');}},'@/lib/ai':{analyzeResumeWithGemini:async data=>{input=data;return {};},generateTailoredLeads:async data=>{input=data;return [];},matchLeadsWithProfile:async data=>{input=data;return [];},generateLeadPitch:async data=>{input=data;return {};},callGeminiJSON:async(system,data)=>{input=JSON.parse(data);return {summary:'Grounded interpretation',nextSteps:['Review targeting']};}}});
 const request=data=>new Request('http://local',{method:'POST',body:JSON.stringify(data)});
 const ats=load('src/app/api/ai/analyze/route.ts');assert.equal((await ats.POST(request({applicationId:'mine',resumeText:'Forged stale resume',jobDescription:'Wrong requirement'}))).status,200);assert.equal(input.resumeText,profile);assert.equal(input.jobDescription,app.information);assert.equal(input.jobDescription.includes(app.notes),false);
 profile='Master version 2';const pipeline=load('src/app/api/analytics/analyze/route.ts');assert.equal((await pipeline.POST(request({owner:'other',stats:{total:999}}))).status,200);assert.equal(input.total,1);assert.equal(input.candidate.resume,profile);assert.equal(input.candidate.source,'master_resume');
 for(const [path,body] of [['generate',{targetRole:'Developer'}],['ai-match',{leads:[{id:'x',title:'Developer',company_name:'Example'}]}],['pitch',{leadTitle:'Developer',companyName:'Example'}]]){assert.equal((await load('src/app/api/leads/'+path+'/route.ts').POST(request({...body,profileText:'Forged'}))).status,200);assert.equal(input.profileText,profile);}
 profile='';assert.equal((await pipeline.POST(request({}))).status,422);
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
 const response=await routes.POST(new Request('http://local/api/applications',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({company_name:'New',role_title:'Engineer',owner:'user_friend'})}));assert.equal(response.status,201);assert.equal(created.owner,'user_ji');assert.equal(created.notion_status,'Not started');assert.equal(created.status,'LEAD');assert.equal(created.work_model,'ON_SITE');assert.equal(created.salary_currency,'PHP');
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
 const route=loader({'@/lib/session-account':{getSessionAccount:async()=>({id:'user_ji',email:'ji@example.com'})},'@/lib/db':{getApplicationById:async()=>app,getCandidateProfile:async()=> 'Resume evidence',updateApplication:async(id,data)=>{writes++;return {...app,...data};}},'@/lib/ai':{callGeminiJSON:async()=>{calls++;if(raw instanceof Error)throw raw;return raw;}}})('src/app/api/role-fit/route.ts');
 const request=body=>new Request('http://local',{method:'POST',body:JSON.stringify(body)});
 assert.equal((await route.POST(request({id:'app'}))).status,200);assert.equal(calls,0);app={...app,owner:'user_friend'};assert.equal((await route.POST(request({id:'app',force:true}))).status,404);app=sample();assert.equal((await route.POST(request({id:'app'}))).status,422);app={...app,job_description:'Experience building Python services with SQL databases.'};raw={fit:'INVENTED'};assert.equal((await route.POST(request({id:'app'}))).status,502);assert.equal(writes,0);raw={fit:'POSSIBLE',explanation:'Python transfers; SQL is missing.',strengths:['Python'],gaps:['SQL']};const data=await (await route.POST(request({id:'app'}))).json();assert.equal(data.application.role_fit,'POSSIBLE');assert.equal(data.application.role_fit_source,'ai');assert.equal(writes,1);raw=new DOMException('timeout','TimeoutError');const timedOut=await route.POST(request({id:'app'}));assert.equal(timedOut.status,502);assert.match((await timedOut.json()).error,/leave this role unassessed/);assert.equal(writes,1);
});
test('salary offer statistics use recorded amounts, retain zero, and separate currencies and pay periods',()=>{
 const {pipelineAnalytics}=loader()('src/lib/analytics.ts');
 const rows=[sample({id:'zero',offer_amount:0}),sample({id:'one',offer_amount:50000}),sample({id:'two',offer_amount:'70000.00',status:'WITHDRAWN'}),sample({id:'two',offer_amount:1000,updated_at:'2026-10-01'}),sample({id:'three',offer_amount:90000}),sample({id:'annual',offer_amount:840000,offer_pay_period:'ANNUAL'}),sample({id:'usd',offer_amount:2000,offer_currency:'USD'}),sample({id:'advertised',salary_min:40000,salary_max:80000}),sample({id:'blank',offer_amount:null}),sample({id:'invalid',offer_amount:-1})];
 const stats=pipelineAnalytics(rows);assert.equal(stats.salaryOffers.count,6);assert.equal(stats.salaryOffers.missing,3);
 const monthly=stats.salaryOffers.groups.find(group=>group.key==='PHP:MONTHLY');assert.equal(monthly.count,4);assert.equal(monthly.median,60000);assert.equal(monthly.min,0);assert.equal(monthly.max,90000);
 assert.equal(stats.salaryOffers.groups.find(group=>group.key==='PHP:ANNUAL').median,840000);assert.equal(stats.salaryOffers.groups.find(group=>group.key==='USD:MONTHLY').median,2000);
 assert.equal(pipelineAnalytics([]).salaryOffers.count,0);assert.deepEqual(pipelineAnalytics([]).salaryOffers.groups,[]);
});

test('offer API validates, normalizes, edits and clears only the signed-in application',async()=>{
 let saved;const load=loader({'@/lib/session-account':{getSessionAccount:async()=>({id:'user_ji',role:'member'})},'@/lib/notion':{},'@/lib/db':{getCompanies:async()=>[],createApplication:async data=>(saved={...sample(),...data}),getApplicationById:async()=>saved,updateApplication:async(id,data)=>(saved={...saved,...data})}});
 const req=body=>new Request('http://local',{method:'POST',body:JSON.stringify(body)});const route=load('src/app/api/applications/route.ts');
 assert.equal((await route.POST(req({role_title:'Engineer',company_name:'Example',status:'LEAD',offer_amount:'65000.50',offer_currency:'php',offer_pay_period:'MONTHLY'}))).status,201);assert.equal(saved.offer_amount,65000.5);assert.equal(saved.offer_currency,'PHP');
 const edit=load('src/app/api/applications/[id]/route.ts');const params={params:Promise.resolve({id:'app'})};
 assert.equal((await edit.PUT(req({notes:'Updated note'}),params)).status,200);assert.equal(saved.offer_amount,65000.5);
 for(const body of [{offer_amount:-1},{offer_amount:false},{offer_amount:'NaN'},{offer_currency:'INVALID'},{offer_pay_period:'DAILY'}])assert.equal((await edit.PUT(req(body),params)).status,400);
 assert.equal((await edit.PUT(req({offer_amount:''}),params)).status,200);assert.equal(saved.offer_amount,null);
});

test('local offer persistence survives promotion, Notion-style updates and explicit clearing',async()=>{
 const original=process.cwd(),directory=fs.mkdtempSync(path.join(os.tmpdir(),'job-offers-')),env={POSTGRES_URL:process.env.POSTGRES_URL,DATABASE_URL:process.env.DATABASE_URL,VERCEL:process.env.VERCEL};
 try {for(const key of Object.keys(env))delete process.env[key];process.chdir(directory);const db=loader()('src/lib/db.ts');const lead=await db.createApplication(sample({status:'LEAD',offer_amount:0,offer_currency:'PHP',offer_pay_period:'MONTHLY'}));await db.updateApplication(lead.id,{status:'APPLIED'});await db.updateApplication(lead.id,{status:'WITHDRAWN',notes:'Notion changed notes',sync_status:'SYNCED'});const restored=await db.getApplicationById(lead.id);assert.equal(restored.offer_amount,0);assert.equal(restored.offer_currency,'PHP');assert.equal(restored.offer_pay_period,'MONTHLY');await db.updateApplication(lead.id,{offer_amount:null});assert.equal((await db.getApplicationById(lead.id)).offer_amount,null);
 } finally {process.chdir(original);for(const [key,value]of Object.entries(env)){if(value===undefined)delete process.env[key];else process.env[key]=value;}fs.rmSync(directory,{recursive:true,force:true});}
});

test('offer PDF contains distributions and medians without company/application lists',async()=>{
 const {analyticsPdf}=loader()('src/lib/analytics-export.ts');const rows=[sample({id:'one',role_title:'PRIVATE_OFFER_ROLE',company_name:'PRIVATE_OFFER_COMPANY',offer_amount:60000}),sample({id:'two',offer_amount:80000}),sample({id:'usd',offer_amount:1200,offer_currency:'USD',offer_pay_period:'HOURLY'})];const pdf=await analyticsPdf(rows,'Member','All roles');assert.equal(pdf.getNumberOfPages(),4);
 const {extractText}=require('unpdf');const text=(await extractText(new Uint8Array(pdf.output('arraybuffer')),{mergePages:true})).text;assert.match(text,/Recorded salary offers/);assert.match(text,/PHP 70,000.00/);assert.match(text,/USD \/ Hourly/);assert.doesNotMatch(text,/PRIVATE_OFFER/);
 fs.writeFileSync(path.join(ROOT,'.data','salary-offer-report-preview.pdf'),Buffer.from(pdf.output('arraybuffer')));
});

test('PDF stays compact for 500 applications and includes targets and AI without individual records or resume',async()=>{
 const {analyticsPdf}=loader()('src/lib/analytics-export.ts');
 const rows=Array.from({length:500},(_,i)=>sample({id:String(i),company_name:'Private Employer '+i,role_title:`Private Role ${i}`,role_fit:'STRONG',notes:'PRIVATE_APPLICATION_NOTES',information:'PRIVATE_JOB_DESCRIPTION',role_fit_analysis:{explanation:'PRIVATE_FIT_EXPLANATION'}}));
 const targets={target_roles:['Solutions Architect'],target_companies:['Target Employer'],preferred_locations:['Las Piñas'],work_models:['REMOTE'],job_types:['FULL_TIME'],salary_min:60000,salary_currency:'PHP',dealbreakers:'Daytime schedule',portfolio_summary:'PRIVATE_RESUME_CONTENT',resumeText:'PRIVATE_RESUME_CONTENT'};
 const insight={summary:'Recorded progress suggests reviewing targeting.',nextSteps:['Review relevant role requirements.']};
 const pdf=await analyticsPdf(rows,'Jizelle Casia','All my roles',insight,{},undefined,targets);
 const smaller=await analyticsPdf(rows.slice(0,35),'Jizelle Casia','All my roles',insight,{},undefined,targets);
 assert.equal(pdf.getNumberOfPages(),3);assert.equal(smaller.getNumberOfPages(),3);
 const {extractText}=require('unpdf');const result=await extractText(new Uint8Array(pdf.output('arraybuffer')),{mergePages:true});
 for(const expected of ['Jizelle Casia','500','Role fit and conversion','Unassessed: 0','Target Employer','Solutions Architect','Las Pinas','PHP 60,000.00','Daytime schedule',insight.summary,insight.nextSteps[0]])assert.ok(result.text.includes(expected),expected);
 assert.doesNotMatch(result.text,/Private Employer|Private Role|PRIVATE_|Application details/);
 fs.mkdirSync(path.join(ROOT,'.data'),{recursive:true});fs.writeFileSync(path.join(ROOT,'.data','analytics-report-preview.pdf'),Buffer.from(pdf.output('arraybuffer')));
});

test('PDF handles empty analytics and paginates long insights without losing content',async()=>{
 const {analyticsPdf}=loader()('src/lib/analytics-export.ts');const {extractText,getDocumentProxy}=require('unpdf');
 const empty=await analyticsPdf([],'Member','Internships');assert.equal(empty.getNumberOfPages(),3);
 const emptyText=(await extractText(new Uint8Array(empty.output('arraybuffer')),{mergePages:true})).text;
 assert.match(emptyText,/N\/A/);assert.match(emptyText,/No AI analysis generated/);assert.doesNotMatch(emptyText,/NaN|Infinity/);
 const summary=Array.from({length:70},(_,i)=>`Insight ${i}: review recorded pipeline evidence before adjusting your targets.`).join('\n');
 const long=await analyticsPdf([sample()],'Member','All roles',{summary,nextSteps:['FINAL_NEXT_STEP']});assert.ok(long.getNumberOfPages()>3);
 const doc=await getDocumentProxy(new Uint8Array(long.output('arraybuffer')));
 const text=(await extractText(doc,{mergePages:true})).text;assert.match(text,/Insight 69/);assert.match(text,/FINAL_NEXT_STEP/);
 for(let i=1;i<=doc.numPages;i++){const page=await doc.getPage(i);const content=await page.getTextContent();for(const item of content.items){if(!item.str)continue;assert.ok(item.transform[5]>=15 && item.transform[5]<=page.view[3]-25,`Text outside page ${i}: ${item.str}`);assert.ok(item.transform[4]+item.width<=page.view[2]-25,`Text overflows page ${i}: ${item.str}`);}}
});

test('resume profile is scoped to the session account and ignores a forged owner',async()=>{
 let user={id:'user_friend',email:'friend@example.com'};const profiles={user_ji:'Private admin resume',user_friend:'Friend resume'};
 const route=loader({'@/lib/session-account':{getSessionAccount:async()=>user},'@/lib/db':{getCandidateProfile:async id=>profiles[id]||null,saveCandidateProfile:async(id,text)=>{profiles[id]=text;}}})('src/app/api/profile/route.ts');
 assert.equal((await (await route.GET()).json()).resumeText,'Friend resume');await route.PUT(new Request('http://local',{method:'PUT',body:JSON.stringify({owner:'user_ji',resumeText:'Updated friend resume'})}));assert.equal(profiles.user_ji,'Private admin resume');assert.equal(profiles.user_friend,'Updated friend resume');user=null;assert.equal((await route.GET()).status,401);
});
test('AI pipeline interpretation uses server-derived statistics for only the signed-in owner',async()=>{
 let stats;const route=loader({'@/lib/session-account':{getSessionAccount:async()=>({id:'user_ji',email:'ji@example.com'})},'@/lib/db':{getApplications:async()=>[sample(),sample({id:'friend',owner:'friend',status:'OFFER'})]},'@/lib/ai':{callGeminiJSON:async(system,input)=>{stats=JSON.parse(input);return {summary:'One tracked application',nextSteps:['Review targeting']};}}})('src/app/api/analytics/analyze/route.ts');const response=await route.POST(new Request('http://local',{method:'POST',body:JSON.stringify({owner:'friend',stats:{total:99}})}));assert.equal(response.status,200);assert.equal(stats.total,1);assert.equal(stats.funnel[4].count,0);
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

test('salary displays group numeric database strings, retain zero and default to PHP',()=>{
 const {formatSalaryRange}=loader()('src/lib/currencies.ts');
 assert.equal(formatSalaryRange('60000.00','80000.00'),'PHP 60,000.00 – 80,000.00');
 assert.equal(formatSalaryRange(50000.5,75000.75,'php'),'PHP 50,000.50 – 75,000.75');
 assert.equal(formatSalaryRange(1200,2000,'USD'),'USD 1,200.00 – 2,000.00');
 assert.equal(formatSalaryRange(0,undefined),'PHP 0.00');
 assert.equal(formatSalaryRange(undefined,80000),'Up to PHP 80,000.00');
 assert.equal(formatSalaryRange(null,'',null),'');assert.equal(formatSalaryRange(NaN,Infinity),'');
});

test('screening statuses map to screening without changing interview or rejection categories',()=>{
 const {getStatusCategory}=loader()('src/lib/statuses.ts');
 assert.equal(getStatusCategory('Screening Call'),'SCREENING');
 assert.equal(getStatusCategory('Initial Interview'),'INTERVIEWING');
 assert.equal(getStatusCategory('Technical Test'),'INTERVIEWING');
 assert.equal(getStatusCategory('Screening - Not Accepted'),'REJECTED');
 assert.equal(getStatusCategory('Screening - Rejected'),'REJECTED');
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
 const {validatePreferences}=loader()('src/lib/preferences.ts');assert.deepEqual(validatePreferences({}).analytics_rejection_statuses,['Not Accepted']);assert.deepEqual(validatePreferences({analytics_rejection_statuses:['Rejected','rejected','Not Accepted']}).analytics_rejection_statuses,['rejected','not accepted']);assert.deepEqual(validatePreferences({analytics_rejection_statuses:[]}).analytics_rejection_statuses,[]);assert.throws(()=>validatePreferences({analytics_rejection_statuses:'Rejected'}));
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
 const result=await (await route.GET()).json();assert.deepEqual(result.data.map(s=>s.name),['Not started','Applied','Interview','Accepted','Not Proceeding','My review']);
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
