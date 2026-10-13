const {test}=require('node:test'),assert=require('node:assert/strict'),{chromium}=require('playwright-core'),fs=require('node:fs');
const base=process.env.PIPELINE_TEST_URL||'http://localhost:3100';

test('resume-first guide, analytics landing card and persistent deployment notice preserve drafts until explicit reload',async()=>{
 const version=(await(await fetch(base+'/api/version')).json()).version;assert.equal(typeof version,'string');
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  const user={id:'guide-member',name:'Guide Member',email:'guide@example.com',role:'member'};
  let latestVersion=version,versionFailure=false,writes=0;
  await page.route('**/api/**',async route=>{
   const request=route.request(),pathname=new URL(request.url()).pathname;let data={success:true,data:[]};
   if(pathname==='/api/version')return route.fulfill({status:versionFailure?503:200,contentType:'application/json',body:JSON.stringify({version:latestVersion})});
   if(pathname==='/api/auth/session')data={user,expires:'2099-01-01'};
   else if(pathname==='/api/users')data.data=[user];
   else if(pathname==='/api/preferences')data.data={default_view:'ALL',target_roles:[],target_companies:[],preferred_locations:[],work_models:[],job_types:[],salary_currency:'PHP',dealbreakers:''};
   else if(pathname==='/api/notion/sync')data={configured:false};
   else if(pathname==='/api/profile')data={success:true,resumeText:''};
   if(request.method()==='POST'||request.method()==='PUT')writes++;
   await route.fulfill({contentType:'application/json',body:JSON.stringify(data)});
  });
  await page.goto(base);await page.getByRole('button',{name:'Guide',exact:true}).click();
  const headings=await page.locator('main h3').allTextContents();assert.equal(headings[0],'Save your master resume');assert.ok(headings.indexOf('Easy-add a job with Ask Gemini')>headings.indexOf('Prepare a tailored application'));
  const walkthrough=page.locator('details').filter({has:page.getByText('Show the Gemini import steps',{exact:true})});assert.equal(await walkthrough.getAttribute('open'),null);
  const resumeCard=page.locator('section').filter({has:page.getByRole('heading',{name:'Save your master resume',exact:true})});
  await resumeCard.getByRole('button',{name:'My preferences',exact:true}).click();await page.getByLabel('Account resume text').waitFor();await page.getByRole('button',{name:'Close preferences',exact:true}).click();
  assert.equal(await page.getByText('Job Hunt has been updated.',{exact:true}).count(),0);
  versionFailure=true;const failed=page.waitForResponse('**/api/version');await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await failed;assert.equal(await page.getByText('Job Hunt has been updated.',{exact:true}).count(),0);
  await page.getByRole('button',{name:'Import job JSON',exact:true}).click();const json=page.getByLabel('Job posting JSON');await json.fill('{"role_title":"Retail Associate","company_name":"Example Shop"}');
  versionFailure=false;latestVersion='new-deployment';await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
  const notice=page.getByRole('alert').filter({hasText:'Job Hunt has been updated.'});await notice.waitFor();assert.equal(await notice.getByRole('button').count(),1);assert.equal(writes,0);assert.match(await json.inputValue(),/Retail Associate/);
  await page.getByRole('button',{name:'Cancel',exact:true}).click();await page.setViewportSize({width:375,height:900});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  fs.mkdirSync('.data',{recursive:true});await page.screenshot({path:'.data/deployment-notice-mobile.png',fullPage:true});
  latestVersion=version;await page.evaluate(()=>window.dispatchEvent(new Event('focus')));assert.ok(await notice.isVisible());
  const reloaded=page.waitForEvent('domcontentloaded');await notice.getByRole('button',{name:'Reload now',exact:true}).click();await reloaded;await page.getByRole('button',{name:'Guide',exact:true}).waitFor();assert.equal(await page.getByText('Job Hunt has been updated.',{exact:true}).count(),0);
  await page.getByRole('button',{name:'Guide',exact:true}).click();await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:'.data/resume-first-guide.png',fullPage:true});
  await page.close();
  const landing=await browser.newPage();await landing.route('**/api/auth/session',route=>route.fulfill({contentType:'application/json',body:'{}'}));await landing.goto(base);
  await landing.getByRole('heading',{name:'Smart Analytics',exact:true}).waitFor();assert.equal(await landing.getByRole('heading',{name:'Strict Google SSO',exact:true}).count(),0);assert.ok(await landing.getByRole('button',{name:'Continue with Google',exact:true}).isVisible());
  await landing.waitForFunction(()=>[...document.images].every(image=>image.complete&&image.naturalWidth>0),undefined,{timeout:10000});
  await landing.screenshot({path:'.data/analytics-landing-card.png',fullPage:true});
 }finally{await browser.close();}
});
