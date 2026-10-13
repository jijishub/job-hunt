const {test}=require('node:test');
const assert=require('node:assert/strict');
const {chromium}=require('playwright-core');

test('ATS reports survive unchanged account refreshes, section navigation and model selection',async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),user={id:'ats-refresh',name:'ATS Refresh',email:'refresh@example.com',role:'member'};
  const app={id:'retail',owner:user.id,company_name:'Example Shop',role_title:'Retail Associate',status:'APPLIED',job_type:'FULL_TIME',work_model:'ON_SITE',priority:'MEDIUM',salary_currency:'PHP',created_at:'2026-10-14',updated_at:'2026-10-14',information:'Serve customers, manage inventory, and maintain accurate point-of-sale records.'};
  let calls=0,refresh=0,pending;
  await page.route('**/api/**',async route=>{
   const url=new URL(route.request().url());let data={success:true,data:[]};
   if(url.pathname==='/api/auth/session')data={user,expires:'2099-01-01'};
   else if(url.pathname==='/api/users')data.data=[{...user,avatar:refresh?`/ask-gemini.png?refresh=${refresh}`:undefined}];
   else if(url.pathname==='/api/applications')data.data=[app];
   else if(url.pathname==='/api/profile')data={success:true,resumeText:'Saved resume with retail sales and customer service experience.'};
   else if(url.pathname==='/api/preferences')data.data={default_view:'ALL',target_roles:[],target_companies:[],preferred_locations:[],work_models:[],job_types:[],dealbreakers:'',salary_currency:'PHP'};
   else if(url.pathname==='/api/notion/sync')data={configured:false};
   else if(url.pathname==='/api/ai/analyze'&&route.request().method()==='POST'){calls++;pending=route;return;}
   await route.fulfill({contentType:'application/json',body:JSON.stringify(data)});
  });
  await page.goto(process.env.PIPELINE_TEST_URL||'http://localhost:3100');await page.getByRole('button',{name:'AI Resume & ATS',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('[aria-label="ATS resume"]')?.value.includes('retail'));
  await page.getByLabel('ATS tracked opportunity').selectOption('retail');
  const run=page.getByRole('button',{name:/Run AI ATS Match/}),request=page.waitForRequest('**/api/ai/analyze');await run.click();await request;
  await pending.fulfill({contentType:'application/json',body:JSON.stringify({success:true,data:{matchScore:80,matchTier:'Strong Match',summary:'Preserved report for this retail job.',matchingSkills:[],missingKeywords:[],strengths:[],gaps:[],bulletRewrites:[],interviewTips:[],tailoredPitch:'Retail pitch.',modelUsed:'luna',analyzedAt:'2026-10-14'}})});
  const result=page.getByText('Preserved report for this retail job.',{exact:true}).first();await result.waitFor();
  refresh++;const refreshed=page.waitForResponse('**/api/users');await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));await refreshed;
  await page.waitForFunction(()=>document.querySelector('header img[alt="ATS Refresh"]')?.getAttribute('src')?.includes('refresh=1'),undefined,{timeout:10000});
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  assert.ok(await result.isVisible(),'Unchanged application data must not clear a completed report');
  await page.getByRole('button',{name:'Guide',exact:true}).click();await page.getByRole('button',{name:'AI Resume & ATS',exact:true}).first().click();assert.ok(await result.isVisible(),'Switching sections must retain the current report');
  await page.getByRole('button',{name:'Thinking',exact:true}).click();assert.ok(await result.isVisible(),'Choosing another model must retain the previous successful report');assert.equal(calls,1);
  await page.getByLabel('ATS job requirements').fill('Changed requirements for a different role with new experience requirements.');
  await page.getByRole('heading',{name:'Ready for AI Resume Analysis',exact:true}).waitFor();assert.equal(await result.count(),0);assert.equal(calls,1);
 }finally{await browser.close();}
});

test('ATS requests are on-demand, deduplicated, bounded and preserve a successful report after timeout',async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),user={id:'ats-member',name:'ATS Member',email:'ats@example.com',role:'member'};
  let calls=0,pending;
  await page.addInitScript(()=>{const original=window.fetch;window.__atsSignals=[];window.fetch=(input,options)=>{if(String(input).includes('/api/ai/analyze')&&options?.method==='POST')window.__atsSignals.push(Boolean(options.signal));return original(input,options);};});
  await page.route('**/api/**',async route=>{
   const url=new URL(route.request().url());let data={success:true,data:[]};
   if(url.pathname==='/api/auth/session')data={user,expires:'2099-01-01'};
   else if(url.pathname==='/api/users')data.data=[user];
   else if(url.pathname==='/api/profile')data={success:true,resumeText:'Saved resume with retail customer service and inventory management experience.'};
   else if(url.pathname==='/api/preferences')data.data={default_view:'ALL',target_roles:[],target_companies:[],preferred_locations:[],work_models:[],job_types:[],dealbreakers:'',salary_currency:'PHP'};
   else if(url.pathname==='/api/notion/sync')data={configured:false};
   else if(url.pathname==='/api/ai/analyze'&&route.request().method()==='POST'){calls++;pending=route;return;}
   await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
  });
  await page.goto(process.env.PIPELINE_TEST_URL||'http://localhost:3100');await page.getByRole('button',{name:'AI Resume & ATS',exact:true}).click();await page.getByLabel('ATS resume').waitFor();
  await page.waitForFunction(()=>document.querySelector('[aria-label="ATS resume"]')?.value.includes('retail'));
  await page.getByLabel('ATS job requirements').fill('Serve customers, manage inventory, process transactions and maintain clear retail records.');assert.equal(calls,0);
  const analyze=page.getByRole('button',{name:/Run AI ATS Match/}),request=page.waitForRequest('**/api/ai/analyze');await analyze.click();await request;
  assert.equal(calls,1);assert.ok(await page.getByRole('button',{name:/Analyzing with/}).isDisabled());assert.deepEqual(await page.evaluate(()=>window.__atsSignals),[true]);
  await pending.fulfill({status:200,contentType:'application/json',body:JSON.stringify({success:true,data:{matchScore:80,matchTier:'Strong Match',summary:'Saved retail experience matches customer service requirements.',matchingSkills:['Customer service'],missingKeywords:[],strengths:['Retail experience'],gaps:[],bulletRewrites:[],interviewTips:[],tailoredPitch:'A brief application pitch.',modelUsed:'luna',analyzedAt:'2026-10-14T00:00:00Z'}})});
  await page.getByText('Saved retail experience matches customer service requirements.',{exact:true}).first().waitFor();
  const retry=page.waitForRequest('**/api/ai/analyze');await analyze.click();await retry;await pending.fulfill({status:504,contentType:'text/html',body:'Gateway timeout'});
  await page.getByText('The server did not finish the ATS report in time. Try again later or choose a faster model.',{exact:true}).waitFor();assert.ok(await page.getByText('Saved retail experience matches customer service requirements.',{exact:true}).first().isVisible());assert.equal(calls,2);
  const third=page.waitForRequest('**/api/ai/analyze');await analyze.click();await third;await pending.fulfill({status:504,contentType:'application/json',body:JSON.stringify({success:false,error:'The AI service did not finish the ATS report in time. Try again later or choose a faster model.',code:'AI_TIMEOUT'})});
  await page.getByText('The AI service did not finish the ATS report in time. Try again later or choose a faster model.',{exact:true}).waitFor();assert.ok(await page.getByText('Saved retail experience matches customer service requirements.',{exact:true}).first().isVisible());assert.equal(calls,3);assert.ok(await analyze.isEnabled());
 }finally{await browser.close();}
});
