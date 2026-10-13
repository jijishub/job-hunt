const {test}=require('node:test');
const assert=require('node:assert/strict');
const {chromium}=require('playwright-core');

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
