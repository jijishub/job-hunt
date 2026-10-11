const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const os=require('node:os');const Module=require('node:module');const ts=require('typescript');
const ROOT=path.resolve(__dirname,'..');
function loader(overrides={}){
 if(overrides['@/lib/db']) overrides['@/lib/db']={getCandidatePreferences:async()=>null,...overrides['@/lib/db']};
 const cache=new Map();
 function load(file){const filename=path.resolve(ROOT,file);if(cache.has(filename))return cache.get(filename).exports;const m=new Module(filename,module);m.filename=filename;m.paths=Module._nodeModulePaths(path.dirname(filename));cache.set(filename,m);const original=m.require.bind(m);m.require=id=>{if(Object.hasOwn(overrides,id))return overrides[id];const target=id.startsWith('@/')?path.join(ROOT,'src',id.slice(2)):id.startsWith('.')?path.resolve(path.dirname(filename),id):null;if(target){if(target.endsWith('.json'))return original(target);if(fs.existsSync(target+'.ts'))return load(target+'.ts');}return original(id);};m._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,filename);return m.exports;}
 return load;
}
const sample=(values={})=>({id:'app',company_name:'Example',role_title:'Engineer',status:'APPLIED',owner:'user_ji',priority:'MEDIUM',job_type:'FULL_TIME',work_model:'ON_SITE',salary_currency:'PHP',sync_status:'SYNCED',created_at:'2026-10-10T00:00:00Z',updated_at:'2026-10-10T00:00:00Z',...values});

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
test('role-fit AI validates evidence, protects manual ratings, and rejects foreign records',async()=>{
 let app=sample({role_fit:'STRONG',role_fit_source:'manual'});let raw={fit:'WEAK',explanation:'Missing requirements',strengths:['Python'],gaps:['SQL']};let calls=0;let writes=0;
 const route=loader({'@/lib/session-account':{getSessionAccount:async()=>({id:'user_ji',email:'ji@example.com'})},'@/lib/db':{getApplicationById:async()=>app,getCandidateProfile:async()=> 'Resume evidence',updateApplication:async(id,data)=>{writes++;return {...app,...data};}},'@/lib/ai':{callGeminiJSON:async()=>{calls++;if(raw instanceof Error)throw raw;return raw;}}})('src/app/api/role-fit/route.ts');
 const request=body=>new Request('http://local',{method:'POST',body:JSON.stringify(body)});
 assert.equal((await route.POST(request({id:'app'}))).status,200);assert.equal(calls,0);app={...app,owner:'user_friend'};assert.equal((await route.POST(request({id:'app',force:true}))).status,404);app=sample();assert.equal((await route.POST(request({id:'app'}))).status,422);app={...app,job_description:'Experience building Python services with SQL databases.'};raw={fit:'INVENTED'};assert.equal((await route.POST(request({id:'app'}))).status,502);assert.equal(writes,0);raw={fit:'POSSIBLE',explanation:'Python transfers; SQL is missing.',strengths:['Python'],gaps:['SQL']};const data=await (await route.POST(request({id:'app'}))).json();assert.equal(data.application.role_fit,'POSSIBLE');assert.equal(data.application.role_fit_source,'ai');assert.equal(writes,1);raw=new DOMException('timeout','TimeoutError');const timedOut=await route.POST(request({id:'app'}));assert.equal(timedOut.status,502);assert.match((await timedOut.json()).error,/leave this role unassessed/);assert.equal(writes,1);
});
test('PDF export produces a readable multi-page personal report',async()=>{
 const {analyticsPdf}=loader()('src/lib/analytics-export.ts');const rows=Array.from({length:35},(_,i)=>sample({id:String(i),role_title:`Engineer ${i}`,role_fit:'STRONG'}));const pdf=await analyticsPdf(rows,'Jizelle Casia','All my roles');assert.ok(pdf.getNumberOfPages()>1);const {extractText}=require('unpdf');const result=await extractText(new Uint8Array(pdf.output('arraybuffer')),{mergePages:true});assert.match(result.text,/Jizelle Casia/);assert.match(result.text,/Role fit and conversion/);assert.match(result.text,/Engineer 34/);assert.match(result.text,/Unassessed: 0/);
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
test('preferences validate fields and save only to the signed-in account',async()=>{
 const {validatePreferences}=loader()('src/lib/preferences.ts');assert.throws(()=>validatePreferences({work_models:['INVALID']}));assert.throws(()=>validatePreferences({salary_min:-1}));let saved;const route=loader({'@/lib/session-account':{getSessionAccount:async()=>({id:'member'})},'@/lib/db':{getCandidatePreferences:async()=>null,saveCandidatePreferences:async(owner,data)=>{saved={owner,data};}}})('src/app/api/preferences/route.ts');assert.equal((await (await route.GET()).json()).data.salary_currency,'PHP');const response=await route.PUT(new Request('http://local',{method:'PUT',body:JSON.stringify({owner:'friend',target_roles:['Developer','Developer'],portfolio_summary:'Built Python tools',work_models:['REMOTE']})}));assert.equal(response.status,200);assert.equal(saved.owner,'member');assert.deepEqual(saved.data.target_roles,['Developer']);assert.equal(saved.data.portfolio_summary,'Built Python tools');
});

test('imports the Appficiency jobDetails JSON from LLM.txt',()=>{const fs=require('fs');const raw=fs.readFileSync('references/appficiency_job.json','utf8');const job=loader()('src/lib/job-import.ts').parseJobImport(raw);assert.equal(job.role_title,'Junior Solutions Architect');assert.equal(job.company_name,'Appficiency');assert.equal(job.work_model,'REMOTE');assert.equal(job.job_type,'FULL_TIME');assert.equal(job.job_url,'https://appficiency.bamboohr.com/careers/29');assert.match(job.location,/Makati/);assert.equal(job.owner,undefined);assert.equal(job.job_description,undefined);});

test('legacy admin email configuration resolves to the actual email',()=>{const {getAdminEmail}=loader()('src/lib/admin-email.ts');const previous=process.env.ADMIN_EMAIL;try{process.env.ADMIN_EMAIL='jizellecasia@gmail.com';assert.equal(getAdminEmail(),'jizelle.casia@gmail.com');delete process.env.ADMIN_EMAIL;assert.equal(getAdminEmail(),'jizelle.casia@gmail.com');}finally{if(previous===undefined)delete process.env.ADMIN_EMAIL;else process.env.ADMIN_EMAIL=previous;}});

test('custom analytics mappings and explicit phases preserve Not Proceeding progress',()=>{
 const {pipelineAnalytics}=loader()('src/lib/analytics.ts');
 const rows=[sample({notion_status:'Not Proceeding',status:'WITHDRAWN',analytics_stage:'INTERVIEW',not_proceeding:true}),sample({notion_status:'Company test',status:'APPLIED'}),sample({notion_status:'Accepted - Not Proceeding',status:'OFFER',not_proceeding:true})];
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
