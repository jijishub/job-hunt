const {test}=require('node:test');const assert=require('node:assert/strict');const {chromium}=require('playwright-core');const fs=require('node:fs');

test('offer dot plot separates currency and period, respects scope and supports empty and mobile views',async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try {
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  const user={id:'member',email:'member@example.com',name:'Offer Tester',role:'member',notion_enabled:false};
  const base={owner:user.id,company_name:'Example',role_title:'Engineer',status:'OFFER',job_type:'FULL_TIME',work_model:'REMOTE',priority:'MEDIUM',salary_currency:'PHP',created_at:'2026-10-12',updated_at:'2026-10-12'};
  const apps=[...Array.from({length:3},(_,i)=>({...base,id:'php'+i,expected_salary_amount:60000+i*10000,expected_salary_currency:'PHP',expected_salary_pay_period:'MONTHLY',offer_amount:50000+i*20000,offer_currency:'PHP',offer_pay_period:'MONTHLY'})),{...base,id:'usd',expected_salary_amount:100000,offer_amount:2000,offer_currency:'USD',offer_pay_period:'MONTHLY'},{...base,id:'annual',expected_salary_amount:75000,offer_amount:840000,offer_currency:'PHP',offer_pay_period:'ANNUAL'},{...base,id:'intern',job_type:'INTERNSHIP',expected_salary_amount:15000},{...base,id:'foreign',owner:'other',offer_amount:9999999,expected_salary_amount:9999999}];
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/api/**',async route=>{
   const pathname=new URL(route.request().url()).pathname;let data={success:true,data:[]};
   if(pathname==='/api/auth/session')data={user,expires:'2099-01-01'};
   else if(pathname==='/api/users')data={success:true,data:[user]};
   else if(pathname==='/api/applications')data={success:true,data:apps};
   else if(pathname==='/api/preferences')data={success:true,data:{default_view:'OTHER',target_roles:[],target_companies:[],preferred_locations:[],work_models:[],job_types:[],salary_currency:'PHP',salary_min:60000,dealbreakers:'',portfolio_summary:''}};
   await route.fulfill({contentType:'application/json',body:JSON.stringify(data)});
  });
  await page.goto(process.env.PIPELINE_TEST_URL||'http://localhost:3100');await page.waitForFunction(()=>document.querySelector('[aria-label="Application type"]')?.value==='OTHER');
  await page.getByRole('button',{name:'Analytics',exact:true}).click();
  const chart=page.getByRole('region',{name:'Recorded salary offers',exact:true});
  await chart.getByText('PHP 70,000.00',{exact:true}).waitFor();assert.equal(await chart.getByTestId('salary-offer-point').count(),3);assert.match(await chart.innerText(),/2 of 3 offers meet it/);assert.doesNotMatch(await chart.innerText(),/9,999,999/);
  const expected=page.getByRole('region',{name:'Salary expectations',exact:true});
  await expected.getByText('PHP 75,000.00',{exact:true}).waitFor();assert.match(await expected.innerText(),/2 of 3/);assert.equal(await expected.getByTestId('salary-gap-point').count(),3);assert.doesNotMatch(await expected.innerText(),/9,999,999/);
  await expected.getByRole('button',{name:'Review expected salaries',exact:true}).click();assert.match(await page.locator('#analytics-role-review').innerText(),/Expected: PHP/);assert.equal(await page.locator('#analytics-role-review').getByRole('button',{name:'Review salary'}).count(),5);
  await chart.getByLabel('Offer comparison group').selectOption('USD:MONTHLY');await chart.getByText('USD 2,000.00',{exact:true}).waitFor();assert.equal(await chart.getByTestId('salary-offer-point').count(),1);
  await chart.getByLabel('Offer comparison group').selectOption('PHP:ANNUAL');await chart.getByText('PHP 840,000.00',{exact:true}).waitFor();assert.doesNotMatch(await chart.innerText(),/monthly minimum/);
  await chart.getByLabel('Offer comparison group').selectOption('PHP:MONTHLY');fs.mkdirSync('.data',{recursive:true});await chart.screenshot({path:'.data/salary-offers-desktop.png'});
  await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1));await chart.screenshot({path:'.data/salary-offers-mobile.png'});await expected.screenshot({path:'.data/salary-expectations-mobile.png'});
  await page.getByLabel('Analytics job type').selectOption('INTERNSHIP');await chart.getByText('No salary offers recorded yet. Add an actual offer in an application to start comparing.').waitFor();await expected.getByText('PHP 15,000.00',{exact:true}).waitFor();assert.match(await expected.innerText(),/No matching offers yet/);assert.equal(await expected.getByTestId('salary-gap-point').count(),0);
  assert.deepEqual(errors,[]);
 } finally {await browser.close();}
});
