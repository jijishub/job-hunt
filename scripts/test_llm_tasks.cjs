const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const ts=require('typescript');
const {chromium}=require('playwright-core');
const {bossjobHelper}=require('./bossjob_browser.cjs');

test('duplicate Notion applications retain pending edits, archive alternatives, and reject repeated identities',async()=>{
 const root=path.resolve(__dirname,'..');const original=process.cwd();const directory=fs.mkdtempSync(path.join(os.tmpdir(),'job-hunt-dedup-'));
 const compiled=path.join(root,'.data',`db-test-${process.pid}.cjs`);
 const savedEnv={POSTGRES_URL:process.env.POSTGRES_URL,DATABASE_URL:process.env.DATABASE_URL,VERCEL:process.env.VERCEL};
 try {
  for(const key of Object.keys(savedEnv))delete process.env[key];
  fs.mkdirSync(path.join(directory,'.data'));fs.mkdirSync(path.dirname(compiled),{recursive:true});
  const base={company_name:'Example',role_title:'Engineer',status:'APPLIED',owner:'user_ji',notion_page_id:'ABC-DEF',priority:'MEDIUM',job_type:'FULL_TIME',work_model:'REMOTE',salary_currency:'PHP',created_at:'2026-01-01T00:00:00Z'};
  fs.writeFileSync(path.join(directory,'.data/db.json'),JSON.stringify({companies:[],users:[{id:'user_ji'}],applications:[{...base,id:'older',sync_status:'PENDING',updated_at:'2026-01-01T00:00:00Z'},{...base,id:'newer',status:'REJECTED',sync_status:'SYNCED',updated_at:'2026-02-01T00:00:00Z'}]}));
  fs.writeFileSync(compiled,ts.transpileModule(fs.readFileSync(path.join(root,'src/lib/db.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText);
  process.chdir(directory);const db=require(compiled);
  assert.deepEqual((await db.getApplications()).map(row=>row.id),['older']);
  assert.equal(JSON.parse(fs.readFileSync('.data/db.json','utf8')).duplicate_applications[0].id,'newer');
  const repeated=await db.createApplication({...base,id:'third',notion_page_id:'abcdef',sync_status:'SYNCED'});assert.equal(repeated.id,'older');
  await db.createApplication({...base,id:'other-owner',owner:'user_other',sync_status:'SYNCED'});
  await db.createApplication({...base,id:'direct',notion_page_id:undefined,sync_status:'PENDING'});
  assert.equal((await db.getApplications()).length,3);
 }finally{
  process.chdir(original);for(const [key,value]of Object.entries(savedEnv)){if(value===undefined)delete process.env[key];else process.env[key]=value;}
  fs.rmSync(directory,{recursive:true,force:true});fs.rmSync(compiled,{force:true});
 }
});

test('Bossjob main-session helper fills labeled fields and supplies exact resume bytes',async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage();await page.route('https://bossjob.ph/**',route=>route.fulfill({contentType:'text/html',body:'<form><label>Full name<input id="name"></label><label>Email<input id="email"></label><label>Resume<input type="file" accept="application/pdf"></label></form>'}));
  await page.goto('https://bossjob.ph/en-us/manage-profile');
  const payload={data:{source:{path:'active.pdf'},profile:{personal:{name:'Jizelle Casia',email:'ji@example.com'},experience:[],education:[]}},resume:Buffer.from('%PDF-test').toString('base64'),filename:'active.pdf'};
  await page.evaluate(bossjobHelper,payload);
  await page.getByRole('button',{name:'Fill open editor',exact:true}).click();assert.equal(await page.locator('#name').inputValue(),'Jizelle Casia');assert.equal(await page.locator('#email').inputValue(),'ji@example.com');
  await page.getByRole('button',{name:'Upload active resume',exact:true}).click();
  assert.deepEqual(await page.locator('input[type=file]').evaluate(async field=>({name:field.files[0].name,text:await field.files[0].text()})),{name:'active.pdf',text:'%PDF-test'});
  await page.evaluate(()=>{document.querySelector('form').insertAdjacentHTML('beforeend','<label>Full name<input id="duplicate"></label>');document.querySelector('#name').value='Unchanged';});
  await page.getByRole('button',{name:'Fill open editor',exact:true}).click();assert.equal(await page.locator('#name').inputValue(),'Unchanged');assert.match(await page.locator('#bossjob-helper').innerText(),/Ambiguous field/);
 }finally{await browser.close();}
});
