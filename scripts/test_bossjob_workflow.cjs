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
 const payload={data:{variant:'business',source:{path:'business.pdf'},profile:{personal:{},experience:[],education:[],...profile}},resume:'',filename:'business.pdf',timeout_ms:700,...flags.payload};
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

test('Bossjob full profile automatically uploads once and saves every supported section without clicks',async()=>{
 const personal={name:'Example Candidate',email:'business@example.com',phone:'+63 912 345 6789',website:'example.com',location:'Manila'};
 const {browser,page}=await setup({personal,experience:[work('Engineer')],education:[{institution:'Example University',qualification:'BS Information Technology',start_year:'2022',end_year:'2026',description:'Education honors'}],skills:['Python','Power BI'],certifications:['Cisco Networking']});
 try{
  await page.evaluate(()=>{
   window.extraSaves=[];window.uploads=0;
   const input=document.createElement('input');input.type='file';input.accept='application/pdf';input.hidden=true;
   input.onchange=()=>{window.uploads++;const ack=document.createElement('p');ack.textContent=input.files[0].name;document.body.append(ack);};document.body.append(input);
   for(const [kind,title,fields] of [['personal','Personal Information',['name','email','phone','website','location']],['skills','Skills',['skills']],['certifications','Certifications',['certifications']]]){
    const section=document.createElement('section');section.dataset.profileSection=kind;const heading=document.createElement('h2');heading.textContent=title;const content=document.createElement('p');const edit=document.createElement('button');edit.textContent='Edit';
    edit.onclick=()=>{
     const form=document.createElement('form');form.setAttribute('role','dialog');form.onsubmit=event=>event.preventDefault();
     for(const key of fields){const label=document.createElement('label');label.textContent=key;const control=document.createElement('textarea');control.name=key;label.append(control);form.append(label);}
     const save=document.createElement('div');save.dataset.sentryComponent='BossButton';save.textContent='Confirm';save.onclick=()=>{const values=[...form.querySelectorAll('textarea')].map(el=>el.value);content.textContent=values.join(' ');window.extraSaves.push(kind);form.remove();};form.append(save);document.body.append(form);
    };section.append(heading,content,edit);document.body.append(section);
   }
  });
  const payload={data:{variant:'business',source:{path:'business.pdf'},profile:{personal,experience:[work('Engineer')],education:[{institution:'Example University',qualification:'BS Information Technology',start_year:'2022',end_year:'2026',description:'Education honors'}],skills:['Python','Power BI'],certifications:['Cisco Networking']}},resume:btoa('%PDF-business'),filename:'business.pdf',full_profile:true,auto_sync:true,auto_upload:true,timeout_ms:1500};
  await page.evaluate(`(${bossjobHelper.toString()})(${JSON.stringify(payload)},${installBossjobWorkflow.toString()})`);
  await page.waitForFunction(()=>document.querySelector('#bossjob-helper').dataset.running==='false');
  assert.match(await page.getByRole('status').innerText(),/Entire profile sync completed/);
  assert.deepEqual(await page.evaluate(()=>window.extraSaves),['personal','skills','certifications']);
  assert.equal(await page.evaluate(()=>window.saves.length),2);assert.equal(await page.evaluate(()=>window.uploads),1);
  await page.getByRole('button',{name:'Sync complete'}).click();await page.waitForFunction(()=>document.querySelector('#bossjob-helper').dataset.running==='false');
  assert.equal(await page.evaluate(()=>window.uploads),1);assert.equal(await page.evaluate(()=>window.extraSaves.length),3);
 }finally{await browser.close();}
});

test('Bossjob fills captured custom title, Ant month picker, Quill and div Confirm controls',async()=>{
 const entry=work('Custom Business Engineer','Example Company');
 const {browser,page}=await setup({experience:[entry]},[{kind:'work',id:'parsed',...entry,description:'Partial'}]);
 try{
  await page.evaluate(entry=>{
   document.querySelector('[data-action=edit]').onclick=()=>{
    const form=document.createElement('form');form.className='work-experience-form';form.onsubmit=event=>event.preventDefault();
    form.__reactFiber$fixture={memoizedProps:{operateType:'edit',initialValues:{id:'parsed',company:entry.company,job_title:entry.title}}};
    form.innerHTML='<div class="ant-form-item"><label>Job title</label><div data-sentry-component="JobTitleCom"><div class="ant-select"><div class="ant-select-selector">Choose</div><input><span class="inputLabel"></span><span class="highlightSpan" hidden>Add</span></div></div></div><label>Company name<input name="company"></label><div class="ant-picker"><input placeholder="Start time" readonly></div><div class="ant-picker"><input placeholder="End time" readonly></div><div class="ant-form-item"><div class="ant-form-item-label"><label>Description</label></div><div class="ql-container"><div class="ql-editor" contenteditable="true"></div><div class="ql-clipboard" contenteditable="true"></div></div></div><div data-sentry-component="BossButton">Confirm</div>';
    const title=form.querySelector('[data-sentry-component=JobTitleCom]');title.querySelector('.ant-select-selector').onclick=()=>{title.querySelector('.highlightSpan').hidden=false;};title.querySelector('.highlightSpan').onclick=()=>{title.querySelector('.inputLabel').textContent=title.querySelector('input').value;title.querySelector('.highlightSpan').hidden=true;const old=form.querySelector('.ql-container');const replacement=old.cloneNode(true);replacement.__quill=old.__quill;old.replaceWith(replacement);};
    for(const input of form.querySelectorAll('.ant-picker input'))input.onclick=()=>{
     document.querySelector('.ant-picker-dropdown')?.remove();const picker=document.createElement('div');picker.className='ant-picker-dropdown';picker.innerHTML='<button type="button" class="ant-picker-header-super-prev-btn">Previous</button><button type="button" class="ant-picker-year-btn">2027</button><table><tbody><tr></tr></tbody></table>';
     const render=()=>{const row=picker.querySelector('tr');row.replaceChildren();for(let month=1;month<=12;month++){const cell=document.createElement('td');cell.title=picker.querySelector('.ant-picker-year-btn').textContent+'-'+String(month).padStart(2,'0');cell.textContent=String(month);cell.onclick=()=>{input.value=cell.title;picker.remove();};row.append(cell);}};
     picker.querySelector('.ant-picker-header-super-prev-btn').onclick=()=>{const year=picker.querySelector('.ant-picker-year-btn');year.textContent=String(Number(year.textContent)-1);render();};render();document.body.append(picker);
    };
    form.querySelector('.ql-container').__quill={setText:(text,source)=>{window.quillSource=source;form.querySelector('.ql-editor').textContent=text;}};
    form.querySelector('[data-sentry-component=BossButton]').onclick=()=>{
     window.saves.push({title:title.querySelector('.inputLabel').textContent,company:form.querySelector('[name=company]').value,start:form.querySelector('[placeholder="Start time"]').value,end:form.querySelector('[placeholder="End time"]').value,description:form.querySelector('.ql-editor').textContent});
     const card=document.querySelector('.experience-item')||document.querySelector('[data-record=parsed]');card.querySelectorAll('p')[1].textContent=entry.start_date+' - '+entry.end_date;card.querySelectorAll('p')[2].textContent=entry.description;form.remove();
    };document.body.append(form);
   };
  },entry);
  await run(page);
  assert.match(await page.getByRole('status').innerText(),/sync completed/);
  assert.deepEqual(await page.evaluate(()=>window.saves[0]),{title:entry.title,company:entry.company,start:entry.start_date,end:entry.end_date,description:entry.description});
  assert.equal(await page.evaluate(()=>window.quillSource),'user');
 }finally{await browser.close();}
});

test('Bossjob opens hover-hidden Edit controls inside the exact experience card',async()=>{
 const entry=work('Engineer');
 const {browser,page}=await setup({experience:[entry]},[{kind:'work',id:'parsed',...entry,description:'Partial'}],{unnamedEdit:true});
 try{
  await page.evaluate(()=>{
   const card=document.querySelector('[data-record=parsed]');card.classList.add('experience-item');card.querySelector('p').classList.add('company');
   const edit=card.querySelector('[data-action=edit]');edit.classList.add('btn-edit');const toolbar=document.createElement('span');toolbar.className='ope-btns';toolbar.style.visibility='hidden';card.append(toolbar);toolbar.append(edit);
  });
  await run(page);assert.match(await page.getByRole('status').innerText(),/sync completed/);
  assert.equal(await page.evaluate(()=>window.saves.length),1);assert.equal(await page.evaluate(()=>window.deleted),undefined);
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

test('Bossjob update-only retry never creates a missing record',async()=>{
 const {browser,page}=await setup({experience:[work('Engineer')]},[],{payload:{update_only:true}});
 try{await run(page);assert.match(await page.getByRole('status').innerText(),/only edits existing records/);assert.equal(await page.evaluate(()=>window.opens.length),0);assert.equal(await page.evaluate(()=>window.saves.length),0);}finally{await browser.close();}
});

test('Bossjob refuses a live work editor without an existing record ID',async()=>{
 const entry=work('Engineer');const {browser,page}=await setup({experience:[entry]},[{kind:'work',id:'parsed',...entry,description:'Partial'}]);
 try{
  await page.evaluate(()=>{
   const edit=document.querySelector('[data-action=edit]');const original=edit.onclick;edit.onclick=()=>{original();document.querySelector('[role=dialog]').classList.add('work-experience-form');};
  });
  await run(page);assert.match(await page.getByRole('status').innerText(),/record ID is not verified/);assert.equal(await page.evaluate(()=>window.saves.length),0);
 }finally{await browser.close();}
});

test('Bossjob persists an unconfirmed save across helper replacement',async()=>{
 const entry=work('Engineer');const {browser,page}=await setup({experience:[entry]},[{kind:'work',id:'parsed',...entry,description:'Partial'}],{unconfirmed:true});
 try{
  await run(page);assert.equal(await page.evaluate(()=>window.saves.length),1);
  await page.evaluate(()=>document.querySelector('[role=dialog]').remove());
  const payload={data:{variant:'business',source:{path:'business.pdf'},profile:{personal:{},experience:[entry],education:[]}},resume:'',filename:'business.pdf',timeout_ms:700};
  await page.evaluate(`(${bossjobHelper.toString()})(${JSON.stringify(payload)},${installBossjobWorkflow.toString()})`);
  await run(page);assert.match(await page.getByRole('status').innerText(),/earlier Save.*unconfirmed/);assert.equal(await page.evaluate(()=>window.saves.length),1);
 }finally{await browser.close();}
});

test('Bossjob remaining mode saves personal summary and legacy Founder in place, leaving other sections alone',async()=>{
 const entry={...work('Founder & Digital Product Freelancer','CLOUDJI NOTION TEMPLATES'),existing_titles:['Founder']};
 const summary='Business solutions and digital product founder summary.';
 const {browser,page}=await setup({summary,experience:[entry,work('Engineer')],skills:['Python']},[{kind:'work',id:'cloudji',...entry,title:'Founder',description:'Partial'}],{payload:{full_profile:true,update_only:true,only_tasks:['summary','work:CLOUDJI NOTION TEMPLATES']}});
 try{
  await page.evaluate(()=>{
   window.summarySaves=0;const section=document.createElement('section');section.dataset.profileSection='summary';section.innerHTML='<h2>Personal summary</h2><p>Old technical summary</p><button>Edit</button>';
   section.querySelector('button').onclick=()=>{
    const form=document.createElement('form');form.setAttribute('role','dialog');form.innerHTML='<label>Personal summary<textarea name="summary"></textarea></label><button type="button">Save</button>';
    form.querySelector('button').onclick=()=>{section.querySelector('p').textContent=form.querySelector('textarea').value;window.summarySaves++;form.remove();};document.body.append(form);
   };document.body.append(section);
  });
  await page.getByRole('button',{name:'Sync entire business profile'}).click();await page.waitForFunction(()=>document.querySelector('#bossjob-helper').dataset.running==='false');
  assert.match(await page.getByRole('status').innerText(),/sync completed/);assert.equal(await page.evaluate(()=>window.summarySaves),1);
  assert.deepEqual(await page.evaluate(()=>window.saves.map(save=>save.id)),['cloudji']);assert.equal(await page.evaluate(()=>window.records.length),1);
  assert.equal(await page.locator('[data-profile-section=summary] p').innerText(),summary);
  await page.getByRole('button',{name:'Sync complete'}).click();await page.waitForFunction(()=>document.querySelector('#bossjob-helper').dataset.running==='false');
  assert.equal(await page.evaluate(()=>window.saves.length),1);assert.equal(await page.evaluate(()=>window.summarySaves),1);
 }finally{await browser.close();}
});

test('Bossjob closes a blank legacy Cloudji editor and reopens its verified existing ID before saving',async()=>{
 const entry={...work('Founder & Digital Product Freelancer','CLOUDJI NOTION TEMPLATES'),existing_titles:['Founder']};
 const {browser,page}=await setup({experience:[entry]},[{kind:'work',id:'cloudji',...entry,title:'Founder',description:'Partial'}],{payload:{update_only:true}});
 try{
  await page.evaluate(entry=>{
   window.editAttempts=0;const card=document.querySelector('[data-record=cloudji]');card.classList.add('experience-item');card.querySelector('p').classList.add('company');
   const edit=card.querySelector('[data-action=edit]');const original=edit.onclick;edit.onclick=()=>{
    original();window.editAttempts++;const root=document.querySelector('[role=dialog]');root.classList.add('work-experience-form');
    if(window.editAttempts===1){const cancel=document.createElement('button');cancel.type='button';cancel.textContent='Cancel';cancel.onclick=()=>root.remove();root.append(cancel);}
    else root.__reactFiber$fixture={memoizedProps:{operateType:'edit',initialValues:{id:'cloudji',company:entry.company,job_title:'Founder'}}};
   };
  },entry);
  await run(page);assert.match(await page.getByRole('status').innerText(),/sync completed/);assert.equal(await page.evaluate(()=>window.editAttempts),2);
  assert.deepEqual(await page.evaluate(()=>window.saves.map(save=>save.id)),['cloudji']);assert.equal(await page.evaluate(()=>window.records.length),1);
 }finally{await browser.close();}
});
