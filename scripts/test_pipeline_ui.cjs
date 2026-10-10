const {test}=require('node:test');const assert=require('node:assert/strict');const {chromium}=require('playwright-core');const fs=require('node:fs');const path=require('node:path');
const URL_BASE=process.env.PIPELINE_TEST_URL||'http://localhost:3100';
test('dashboard isolates account data, defaults new roles, saves manual/AI fits, filters internships, and exports PDF',async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  const user={id:'user_ji',name:'Jizelle Casia',email:'ji@example.com',role:'admin',notion_enabled:true};
  let apps=[{id:'intern',owner:'user_ji',company_name:'Intern Company',role_title:'IT Intern',status:'LEAD',notion_status:'Not started',job_type:'INTERNSHIP',work_model:'ON_SITE',salary_currency:'PHP',priority:'MEDIUM',created_at:'2026-10-10',updated_at:'2026-10-10'},{id:'engineer',owner:'user_ji',company_name:'My Company',role_title:'Software Engineer',status:'APPLIED',role_fit:'STRONG',role_fit_source:'manual',job_type:'FULL_TIME',work_model:'REMOTE',salary_currency:'PHP',priority:'HIGH',created_at:'2026-10-10',updated_at:'2026-10-10'},{id:'friend',owner:'user_friend',company_name:'Friend Secret Company',role_title:'Friend Private Lead',status:'LEAD',priority:'MEDIUM',created_at:'2026-10-10',updated_at:'2026-10-10'}];
  let creations=[];let fitCalls=0;let preferences={target_companies:[],target_roles:[],preferred_locations:[],work_models:[],job_types:[],salary_currency:'PHP',dealbreakers:'',portfolio_summary:''};
  await page.route('**/api/**',async route=>{
   const request=route.request();const url=new URL(request.url());const method=request.method();let data={success:true,data:[]};
   if(url.pathname==='/api/auth/session')data={user,expires:'2099-01-01'};
   else if(url.pathname==='/api/users')data={success:true,data:[user,{id:'user_friend',name:'Friend',email:'friend@example.com',role:'member'}]};
   else if(url.pathname==='/api/notion/sync')data={configured:false};
   else if(url.pathname==='/api/preferences'){if(method==='PUT')preferences=request.postDataJSON();data={success:true,data:preferences};}
   else if(url.pathname==='/api/profile')data={success:true,resumeText:'Experience building TypeScript, SQL and Python applications.'};
   else if(url.pathname==='/api/statuses')data={success:true,data:[{id:'not_started',name:'Not started',color:'gray',category:'LEAD'},{id:'applied',name:'Applied',color:'blue',category:'APPLIED'}]};
   else if(url.pathname==='/api/applications'&&method==='POST'){const payload=request.postDataJSON();const app={...payload,id:'new'+creations.length,created_at:'2026-10-11',updated_at:'2026-10-11'};creations.push(app);apps.push(app);data={success:true,data:app};}
   else if(url.pathname==='/api/applications')data={success:true,data:apps};
   else if(url.pathname==='/api/role-fit'){fitCalls++;data={success:true,data:{fit:'STRONG',explanation:'The supplied requirements match TypeScript and SQL experience.',strengths:['TypeScript','SQL'],gaps:[],analyzed_at:'2026-10-11'}};}
   else if(url.pathname==='/api/analytics/analyze')data={success:true,data:{summary:'Your strong-fit roles show recorded progress.',nextSteps:['Prepare specific project examples.']}};
   await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
  });
  await page.goto(URL_BASE);await page.getByRole('button',{name:'New App',exact:true}).waitFor();
  await page.getByText('Software Engineer',{exact:true}).last().waitFor();assert.equal(await page.getByText('Friend Private Lead',{exact:true}).count(),0);assert.equal(await page.getByText(/All Pipelines/).count(),0);
  await page.getByLabel('Application type').selectOption('INTERNSHIP');assert.equal(await page.locator('tbody tr').count(),1);await page.getByLabel('Application type').selectOption('ALL');
  await page.getByRole('button',{name:'My preferences',exact:true}).click();await page.getByLabel('Target positions',{exact:true}).fill('AI Developer');await page.getByLabel('Portfolio projects and skills',{exact:true}).fill('Built Python automation tools.');await page.getByRole('button',{name:'Save preferences',exact:true}).click();await page.getByText(/Preferences saved/).waitFor();assert.deepEqual(preferences.target_roles,['AI Developer']);await page.getByRole('button',{name:'Close preferences'}).click();
  await page.getByRole('button',{name:'New App',exact:true}).click();
  assert.equal(await page.getByLabel('Work model',{exact:true}).inputValue(),'ON_SITE');assert.ok(await page.getByText('Max Salary (PHP)', {exact:true}).isVisible());assert.equal(await page.getByLabel('Application stage',{exact:true}).inputValue(),'Not started');
  await page.getByRole('button',{name:'Import job JSON',exact:true}).click();await page.getByLabel('Job posting JSON').fill(JSON.stringify({role_title:'Manual-fit Developer',company_name:'Manual Company',description:'Build TypeScript and SQL applications.',qualifications:['Python'],location:'Makati',work_model:'ON_SITE',job_type:'FULL_TIME',salary_currency:'PHP'}));await page.getByRole('button',{name:'Fill draft from JSON',exact:true}).click();assert.equal(creations.length,0);assert.match(await page.getByLabel('Job requirements',{exact:true}).inputValue(),/Python/);await page.getByLabel('Role fit',{exact:true}).selectOption('POSSIBLE');await page.getByRole('button',{name:'Create Application',exact:true}).click();await page.getByText('Manual-fit Developer',{exact:true}).last().waitFor();assert.equal(creations[0].role_fit,'POSSIBLE');assert.equal(creations[0].role_fit_source,'manual');assert.equal(fitCalls,0);
  await page.getByRole('button',{name:'New App',exact:true}).click();await page.getByPlaceholder('e.g. Senior Frontend Engineer').fill('AI-fit Developer');await page.getByPlaceholder('Select or type new company...').fill('AI Company');await page.getByLabel('Job requirements',{exact:true}).fill('Build TypeScript applications with SQL databases and Python automation.');await page.getByRole('button',{name:'Create Application',exact:true}).click();await page.getByText('AI-fit Developer',{exact:true}).last().waitFor();assert.equal(creations[1].role_fit,'STRONG');assert.equal(creations[1].role_fit_source,'ai');assert.equal(fitCalls,1);
  await page.getByRole('button',{name:/Analytics/}).click();await page.getByRole('heading',{name:'Jizelle Casia’s job-search analytics'}).waitFor();assert.equal(await page.getByText('Friend Private Lead',{exact:true}).count(),0);
  await page.getByRole('button',{name:'Analyze my pipeline with AI',exact:true}).click();await page.getByText('Your strong-fit roles show recorded progress.').waitFor();
  await page.getByLabel('Analytics job type').selectOption('INTERNSHIP');assert.equal(await page.getByText('Your strong-fit roles show recorded progress.').count(),0);await page.getByLabel('Analytics job type').selectOption('ALL');
  const downloadEvent=page.waitForEvent('download');await page.getByRole('button',{name:'Export PDF',exact:true}).click();const download=await downloadEvent;fs.mkdirSync('.data',{recursive:true});await download.saveAs(path.resolve('.data/pipeline-analytics-test.pdf'));assert.equal(download.suggestedFilename(),'my-job-search-analytics.pdf');
  await page.screenshot({path:'.data/pipeline-analytics-review.png',fullPage:true});
 }finally{await browser.close();}
});
