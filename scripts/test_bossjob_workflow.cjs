const {test}=require('node:test');
const assert=require('node:assert/strict');
const {chromium}=require('playwright-core');
const {bossjobHelper}=require('./bossjob_browser.cjs');
const {installBossjobWorkflow}=require('./bossjob_workflow.cjs');

const work=(title,company='GDS CAPITAL, INC.')=>({company,title,start_date:'2026-07',end_date:'2026-10',current:false,description:'First accomplishment.\nSecond accomplishment missing from parsing.\nThird accomplishment.'});
async function setup(profile,initial=[],flags={}){
 const browser=await chromium.launch({channel:'chrome',headless:true});
 const page=await browser.newPage();
 await page.route('https://bossjob.ph/**',route=>route.fulfill({contentType:'text/html',body:'<section id="work"><header><h2>Work Experience</h2><button id="add-work" aria-label="Add work experience">+</button></header><div id="work-records"></div></section><section id="education"><header><h2>Education</h2><button id="add-education" aria-label="Add education">+</button></header><div id="education-records"></div></section>'}));
 await page.goto('https://bossjob.ph/en-us/manage-profile');
 await page.evaluate(({initial,flags})=>{
  window.records=initial;window.saves=[];window.opens=[];
  const render=()=>{
   for(const kind of ['work','education']){
    const container=document.getElementById(kind+'-records');container.replaceChildren();
    window.records.filter(record=>record.kind===kind).forEach(record=>{
     const article=document.createElement('article');article.dataset.record=record.id;
     const heading=document.createElement('h3');heading.textContent=kind==='work'?record.title:record.institution;
     const company=document.createElement('p');company.textContent=kind==='work'?record.company:record.qualification;
     const dates=document.createElement('p');dates.textContent=kind==='work'?record.start_date+' – '+(record.current?'Present':record.end_date):record.start_year+' – '+record.end_year;
     const description=document.createElement('p');description.textContent=record.description;
     const edit=document.createElement('button');edit.type='button';edit.textContent='';if(!flags.unnamedEdit)edit.setAttribute('aria-label','Edit');edit.dataset.action='edit';edit.onclick=()=>open(kind,record);
     const del=document.createElement('button');del.type='button';del.setAttribute('aria-label','Delete');del.onclick=()=>{window.deleted=true;};
     article.append(heading,company,dates,description,edit,del);container.append(article);
    });
   }
  };
  const open=(kind,record)=>{
   window.opens.push({kind,id:record?.id||null});
   const root=document.createElement('div');root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');
   const fields=kind==='work'?['company','title','description','start_date','end_date']:['institution','qualification','description','start_year','end_year'];
   const captions={company:'Company name',title:'Job title',description:'Description',start_date:'Start date',end_date:'End date',institution:'School name',qualification:'Degree',start_year:'Start year',end_year:'Graduation year'};
   for(const key of fields){
    const label=document.createElement('label');label.textContent=captions[key];
    const input=document.createElement(key==='description'?'textarea':'input');input.name=key;
    if(key.endsWith('_date'))input.type=flags.fullDate?'date':'month';
    if(flags.missingDescription&&key==='description'){label.textContent='Unknown custom editor';input.name='custom_details';}
    if(flags.descriptionLimit&&key==='description')input.maxLength=flags.descriptionLimit;
    input.value=record?.[key]||'';label.append(input);root.append(label);
   }
   if(kind==='work'){const label=document.createElement('label');label.textContent='I currently work here';const checkbox=document.createElement('input');checkbox.name='current';checkbox.type='checkbox';checkbox.checked=!!record?.current;label.append(checkbox);root.append(label);}
   const save=document.createElement('button');save.textContent='Save';save.type='button';save.onclick=()=>{
    const values=Object.fromEntries([...root.querySelectorAll('input,textarea')].map(el=>[el.name,el.type==='checkbox'?el.checked:el.value]));
    window.saves.push({kind,id:record?.id||null,values});
    if(flags.reject){const error=document.createElement('p');error.setAttribute('role','alert');error.textContent='Required field is invalid';root.append(error);return;}
    if(flags.unconfirmed)return;
    if(record)Object.assign(record,values);else window.records.push({kind,id:'new-'+window.records.length,...values});
    root.remove();render();
   };
   root.append(save);document.body.append(root);
  };
  document.querySelector('#add-work').onclick=()=>open('work');document.querySelector('#add-education').onclick=()=>open('education');render();
 },{initial,flags});
 const payload={data:{variant:'business',source:{path:'business.pdf'},profile:{personal:{},experience:[],education:[],...profile}},resume:'',filename:'business.pdf',timeout_ms:700};
 await page.evaluate(`(${bossjobHelper.toString()})(${JSON.stringify(payload)},${installBossjobWorkflow.toString()})`);
 return {browser,page};
}
async function run(page){await page.getByRole('button',{name:/Sync work & education|Retry remaining/}).click();await page.waitForFunction(()=>document.querySelector('#bossjob-helper').dataset.running==='false');}

test('Bossjob updates partial parsed entries in place, adds missing work and education, and leaves separate same-company roles intact',async()=>{
 const engineer=work('Junior Forward-Deployed Engineer'),intern=work('IT Specialist Intern');
 const education={institution:'Example University',qualification:'BS Information Technology',start_year:'2022',end_year:'2026',description:'Degree and complete education honors.'};
 const {browser,page}=await setup({experience:[engineer,intern],education:[education]},[{kind:'work',id:'parsed-engineer',...engineer,company:'GDS Capital',description:'First accomplishment.'}]);
 try{
  await run(page);
  assert.match(await page.getByRole('status').innerText(),/sync completed/);
  const result=await page.evaluate(()=>({records:window.records,saves:window.saves,opens:window.opens,deleted:window.deleted}));
  assert.equal(result.records.length,3);
  assert.equal(result.records[0].id,'parsed-engineer');assert.equal(result.records[0].description,engineer.description);
  assert.deepEqual(result.saves.map(save=>save.id),['parsed-engineer',null,null]);
  assert.equal(result.deleted,undefined);
  await page.getByRole('button',{name:'Sync complete'}).click();await page.waitForFunction(()=>document.querySelector('#bossjob-helper').dataset.running==='false');
  assert.equal(await page.evaluate(()=>window.saves.length),3);
 }finally{await browser.close();}
});

test('Bossjob does not skip a full description with incorrect dates and does not overwrite another employer with the same role title',async()=>{
 const entry=work('Engineer');
 const {browser,page}=await setup({experience:[entry]},[{kind:'work',id:'correct-employer',...entry,start_date:'2025-01'},{kind:'work',id:'other-employer',...entry,company:'Another company',description:'Keep this unchanged'}]);
 try{
  await run(page);assert.match(await page.getByRole('status').innerText(),/sync completed/);
  const records=await page.evaluate(()=>window.records);
  assert.equal(records[0].start_date,entry.start_date);assert.equal(records[1].description,'Keep this unchanged');
 }finally{await browser.close();}
});

test('Bossjob stops on duplicate parsed identities, unmapped dates, and character limits without saving partial entries',async()=>{
 const entry=work('Engineer');
 for(const flags of [{duplicate:true},{fullDate:true},{descriptionLimit:15},{missingDescription:true}]){
  const initial=[{kind:'work',id:'parsed',...entry,description:'Partial'}];if(flags.duplicate)initial.push({...initial[0],id:'duplicate'});
  const {browser,page}=await setup({experience:[entry]},initial,flags);
  try{
   await run(page);assert.doesNotMatch(await page.getByRole('status').innerText(),/sync completed/);
   assert.equal(await page.evaluate(()=>window.saves.length),0);
   assert.equal(await page.evaluate(()=>window.deleted),undefined);
  }finally{await browser.close();}
 }
});

test('Bossjob can use a user-picked unnamed Edit icon and retains pending Save state to avoid duplicate submissions',async()=>{
 const entry=work('Engineer');
 const {browser,page}=await setup({experience:[entry]},[{kind:'work',id:'parsed',...entry,description:'Partial'}],{unnamedEdit:true,unconfirmed:true});
 try{
  await run(page);assert.match(await page.getByRole('status').innerText(),/no identifiable label/);
  await page.getByRole('button',{name:'Choose this entry’s Edit / +'}).click();await page.locator('[data-action=edit]').click();
  await page.waitForFunction(()=>document.querySelector('#bossjob-helper').dataset.running==='false'&&window.saves.length===1);
  await run(page);assert.equal(await page.evaluate(()=>window.saves.length),1);assert.match(await page.getByRole('status').innerText(),/No second Save/);
 }finally{await browser.close();}
});

test('Bossjob pauses for truncated parsed role and school names instead of creating duplicates',async()=>{
 const entry=work('Engineer');
 const cases=[
  {profile:{experience:[entry]},initial:[{kind:'work',id:'partial',...entry,title:'Parsed title',company:'GDS Capital'}]},
  {profile:{education:[{institution:'Example University - City Campus',qualification:'BS Information Technology',start_year:'2022',end_year:'2026',description:'Honors'}]},initial:[{kind:'education',id:'school',institution:'Example University',qualification:'BS Information Technology',start_year:'2022',end_year:'2026',description:'Partial'}]},
 ];
 for(const fixture of cases){const {browser,page}=await setup(fixture.profile,fixture.initial);try{await run(page);assert.match(await page.getByRole('status').innerText(),/possibly incomplete/);assert.equal(await page.evaluate(()=>window.opens.length),0);assert.equal(await page.evaluate(()=>window.saves.length),0);}finally{await browser.close();}}
});
