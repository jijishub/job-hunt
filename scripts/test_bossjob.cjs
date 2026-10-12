const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {chromium}=require('playwright-core');
const {parseOptions,main}=require('./bossjob_sync.cjs');
const {bossjobHelper}=require('./bossjob_browser.cjs');

test('Bossjob defaults to business and generates the helper from the exact business PDF',async()=>{
 assert.deepEqual(parseOptions([]),{variant:'business',prepareOnly:false});
 assert.deepEqual(parseOptions(['--prepare','--variant','technical']),{variant:'technical',prepareOnly:true});
 assert.throws(()=>parseOptions(['--variant']),/business or technical/);
 assert.throws(()=>parseOptions(['--variant','wrong']),/business or technical/);
 assert.throws(()=>parseOptions(['--wrong']),/Unknown option/);
 await main(['--prepare']);
 const root=path.resolve(__dirname,'..');
 const helper=fs.readFileSync(path.join(root,'.data/bossjob/helper.js'),'utf8');
 const payloadStart=('('+bossjobHelper.toString()+')(').length;
 const payload=JSON.parse(helper.slice(payloadStart,helper.indexOf(',\nfunction installBossjobWorkflow',payloadStart)));
 assert.equal(payload.data.variant,'business');
 assert.equal(payload.data.source.path,'references/Active Resume/BusinessSolutions/JizelleCasia_Resume.pdf');
 const bytes=fs.readFileSync(path.join(root,payload.data.source.path));
 assert.deepEqual(Buffer.from(payload.resume,'base64'),bytes);
 assert.equal(payload.data.source.sha256,crypto.createHash('sha256').update(bytes).digest('hex'));
 assert.ok(payload.data.profile.experience.every(entry=>entry.company&&entry.title&&entry.description));
});

test('Bossjob fills work and education independently of PDF parsing and handles accessible labels and native months',async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}});
  await page.route('https://bossjob.ph/**',route=>route.fulfill({contentType:'text/html',body:`
   <div role="dialog" aria-modal="true"><form id="work">
    <span id="company-label">Company Name *</span><input id="company" aria-labelledby="company-label">
    <div><label>Position Title (required)</label><input id="title"></div>
    <label>Work Description: <textarea id="description"></textarea></label>
    <label>Start date<input id="start" type="month"></label>
    <label>End date<input id="end" type="month"></label>
    <input aria-label="Email" value="keep@example.com"><button type="submit">Save</button>
   </form></div>`}));
  await page.goto('https://bossjob.ph/en-us/manage-profile');
  let saves=0;await page.exposeFunction('recordSave',()=>saves++);
  await page.evaluate(()=>document.querySelector('form').onsubmit=event=>{event.preventDefault();window.recordSave();});
  const values={company:'Business Company',title:'Business Solutions Specialist',description:'Business-specific responsibilities',start_date:'2026-03',end_date:'2026-06',current:false};
  const profile={personal:{name:'Personal Name'},experience:[values],education:[{institution:'Example University',qualification:'BS Information Technology',start_year:'2022',end_year:'2026',description:'Education honors'}]};
  await page.evaluate(bossjobHelper,{data:{variant:'business',source:{path:'business.pdf'},profile},resume:'',filename:'business.pdf'});
  await page.getByLabel('Resume section').selectOption('1');
  await page.getByRole('button',{name:'Fill open editor',exact:true}).click();
  assert.equal(await page.locator('#company').inputValue(),values.company);
  assert.equal(await page.locator('#title').inputValue(),values.title);
  assert.equal(await page.locator('#description').inputValue(),values.description);
  assert.equal(await page.locator('#start').inputValue(),'2026-03');
  assert.equal(await page.locator('#end').inputValue(),'2026-06');
  assert.equal(await page.locator('input[aria-label=Email]').inputValue(),'keep@example.com');
  assert.equal(saves,0);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  assert.match(await page.locator('#bossjob-helper').innerText(),/business resume/);
  fs.mkdirSync('.data',{recursive:true});await page.locator('#bossjob-helper').screenshot({path:'.data/bossjob-business-helper.png'});
  await page.evaluate(()=>document.querySelector('[role=dialog]').innerHTML=`<form><label>School name<input id="school"></label><label>Degree<select id="degree"><option value="unknown">Choose</option><option value="bsit">BS Information Technology</option></select></label><label>Start year<input id="year"></label><label>Graduation year<input id="graduation"></label><label>Description<textarea id="education-description"></textarea></label></form>`);
  await page.getByLabel('Resume section').selectOption('2');
  await page.getByRole('button',{name:'Fill open editor',exact:true}).click();
  assert.equal(await page.locator('#school').inputValue(),'Example University');
  assert.equal(await page.locator('#degree').inputValue(),'bsit');
  assert.equal(await page.locator('#year').inputValue(),'2022');assert.equal(await page.locator('#graduation').inputValue(),'2026');
  assert.equal(await page.locator('#education-description').inputValue(),'Education honors');
  await page.getByLabel('Resume section').selectOption('1');
  await page.getByRole('button',{name:'Fill open editor',exact:true}).click();
  assert.equal(await page.locator('#education-description').inputValue(),'Education honors');
 }finally{await browser.close();}
});

test('Bossjob reports unmatched custom controls and keeps date-only guesses out of work fields',async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage();
  await page.route('https://bossjob.ph/**',route=>route.fulfill({contentType:'text/html',body:'<form><label>Company name<input id="company"></label><label>Job title<input id="title"></label><label>Start date<input id="date" type="date" value="2025-01-01"></label><input role="combobox" aria-label="Job title" value="Do not overwrite"></form>'}));
  await page.goto('https://bossjob.ph/en-us/manage-profile');
  await page.evaluate(bossjobHelper,{data:{variant:'business',source:{path:'business.pdf'},profile:{personal:{},experience:[{company:'Company',title:'Role',start_date:'2026-03'}],education:[]}},resume:'',filename:'business.pdf'});
  await page.getByLabel('Resume section').selectOption('1');await page.getByRole('button',{name:'Fill open editor',exact:true}).click();
  assert.equal(await page.locator('#date').inputValue(),'2025-01-01');
  assert.equal(await page.getByRole('combobox',{name:'Job title'}).inputValue(),'Do not overwrite');
  assert.match(await page.getByRole('status').innerText(),/start date/);
  await page.evaluate(()=>document.querySelector('form').insertAdjacentHTML('beforeend','<label>Company name<input></label>'));
  await page.locator('#company').fill('Retain this');await page.getByRole('button',{name:'Fill open editor',exact:true}).click();
  assert.equal(await page.locator('#company').inputValue(),'Retain this');assert.match(await page.getByRole('status').innerText(),/Ambiguous field/);
 }finally{await browser.close();}
});

test('Bossjob recognizes basic_info field names and copies editor controls rather than profile values',async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage();await page.context().grantPermissions(['clipboard-read','clipboard-write'],{origin:'https://bossjob.ph'});
  await page.route('https://bossjob.ph/**',route=>route.fulfill({contentType:'text/html',body:'<form><input name="email_address"><input name="phone_number"><input name="current_location"><input name="date_of_birth" type="month" value="2004-05"><input name="home_address" value="Keep existing address"><input name="password" type="password" value="do-not-export"><select name="job_seeker_type"><option value="experienced">Experienced</option></select></form>'}));
  await page.goto('https://bossjob.ph/en-us/manage-profile');
  const personal={name:'Example Candidate',email:'resume@example.com',phone:'+63 912 345 6789',location:'Resume City'};
  await page.evaluate(bossjobHelper,{data:{variant:'business',source:{path:'business.pdf'},profile:{personal,experience:[],education:[]}},resume:'',filename:'business.pdf'});
  await page.getByRole('button',{name:'Fill open editor',exact:true}).click();
  assert.equal(await page.locator('[name=email_address]').inputValue(),personal.email);
  assert.equal(await page.locator('[name=phone_number]').inputValue(),personal.phone);
  assert.equal(await page.locator('[name=current_location]').inputValue(),personal.location);
  assert.equal(await page.locator('[name=date_of_birth]').inputValue(),'2004-05');
  assert.equal(await page.locator('[name=home_address]').inputValue(),'Keep existing address');
  await page.getByRole('button',{name:'Copy editor controls (JSON)',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('[role=status]').textContent.includes('Editor field inspection copied'));
  const json=await page.evaluate(()=>navigator.clipboard.readText()),fields=JSON.parse(json);
  assert.ok(Array.isArray(fields));assert.ok(fields.every(field=>field.tag&&field.name&&!Object.hasOwn(field,'value')));
  assert.ok(fields.some(field=>field.name==='current_location'&&field.tag==='INPUT'));
  assert.deepEqual(fields.find(field=>field.name==='job_seeker_type').options,[{value:'experienced',text:'Experienced'}]);
  assert.doesNotMatch(json,/do-not-export|resume@example.com|Keep existing address/);
  await page.evaluate(()=>document.querySelector('form').remove());await page.getByRole('button',{name:'Copy editor controls (JSON)',exact:true}).click();
  assert.match(await page.getByRole('status').innerText(),/Open exactly one profile editor/);
  await page.evaluate(()=>document.body.insertAdjacentHTML('beforeend','<div><input name="custom_job_title" aria-label="Job title"><button type="button">Save</button></div>'));
  await page.getByRole('button',{name:'Copy editor controls (JSON)',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('[role=status]').textContent.includes('Editor field inspection copied'));
  const custom=JSON.parse(await page.evaluate(()=>navigator.clipboard.readText()));
  assert.ok(custom.some(field=>field.name==='custom_job_title'&&field.editor==='BODY'));
 }finally{await browser.close();}
});
