const {test}=require('node:test');
const assert=require('node:assert/strict');
const {chromium}=require('playwright-core');
const fs=require('node:fs');

test('quick JSON import opens directly, assesses the imported posting, and saves only after review for admins and members',async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  for(const role of ['admin','member']){
   const page=await browser.newPage({viewport:role==='admin'?{width:1440,height:1000}:{width:375,height:900}});
   const user={id:'import-'+role,name:'Import Tester',email:'import@example.com',role};const apps=[];let fitCalls=0,pending,fitInput;
   await page.route('**/api/**',async route=>{
    const request=route.request(),url=new URL(request.url());let data={success:true,data:[]};
    if(url.pathname==='/api/auth/session')data={user,expires:'2099-01-01'};
    else if(url.pathname==='/api/users')data.data=[user];
    else if(url.pathname==='/api/notion/sync')data={configured:false};
    else if(url.pathname==='/api/preferences')data.data={default_view:'ALL',target_roles:[],target_companies:[],preferred_locations:[],work_models:[],job_types:[],dealbreakers:'',salary_currency:'PHP'};
    else if(url.pathname==='/api/profile')data={success:true,resumeText:'Retail sales and customer service experience.'};
    else if(url.pathname==='/api/applications'){
     if(request.method()==='POST'){apps.push({...request.postDataJSON(),id:'created-'+apps.length,created_at:new Date().toISOString(),updated_at:new Date().toISOString()});data.data=apps.at(-1);}else data.data=apps;
    }else if(url.pathname==='/api/role-fit'){fitCalls++;fitInput=request.postDataJSON();pending=route;return;}
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
   });
   await page.goto(process.env.PIPELINE_TEST_URL||'http://localhost:3100');
   await page.getByRole('button',{name:'Import job JSON',exact:true}).click();
   const dialog=page.getByRole('dialog',{name:'New Application / Lead',exact:true}),json=dialog.getByLabel('Job posting JSON');
   await json.waitFor();assert.ok(await json.evaluate(node=>document.activeElement===node));
   const bounds=await json.boundingBox();assert.ok(bounds.y>=0&&bounds.y+bounds.height<=page.viewportSize().height,'Paste box is visible without scrolling');assert.equal(fitCalls,0);
   await json.fill('{invalid');await dialog.getByRole('button',{name:'Fill draft & assess fit',exact:true}).click();assert.equal(apps.length,0);assert.equal(fitCalls,0);assert.ok(await json.isVisible());
   await json.fill(JSON.stringify({role_title:'Retail Associate',company_name:'Example Shop',description:'Serve customers, manage stock, and maintain accurate point-of-sale records.',qualifications:['Customer service experience'],job_platform:'Walk-in',job_type:'FULL_TIME',salary_min:20000,salary_currency:'PHP'}));
   const requested=page.waitForRequest('**/api/role-fit');await dialog.getByRole('button',{name:'Fill draft & assess fit',exact:true}).click();await requested;
   assert.equal(fitCalls,1);assert.equal(apps.length,0);assert.equal(fitInput.roleTitle,'Retail Associate');assert.match(fitInput.jobDescription,/Customer service experience/);assert.equal(fitInput.jobFacts.company,'Example Shop');assert.equal(fitInput.jobFacts.salary_min,20000);
   assert.ok(await dialog.getByRole('button',{name:'Assessing role fit…',exact:true}).isDisabled());assert.equal(await dialog.getByLabel('Job title').inputValue(),'Retail Associate');
   await pending.fulfill({status:200,contentType:'application/json',body:JSON.stringify({success:true,data:{fit:'STRONG',explanation:'Saved retail experience matches customer service requirements.',strengths:['Retail sales'],gaps:[],analyzed_at:'2026-10-14'}})});
   await dialog.getByRole('button',{name:'Create Application',exact:true}).waitFor();assert.equal(await dialog.getByLabel('Role fit',{exact:true}).inputValue(),'STRONG');assert.equal(apps.length,0);
   const saveBox=await dialog.getByRole('button',{name:'Create Application',exact:true}).boundingBox();assert.ok(saveBox.y>=0&&saveBox.y+saveBox.height<=page.viewportSize().height,'Create action stays visible');
   fs.mkdirSync('.data',{recursive:true});await dialog.screenshot({path:'.data/quick-json-import-'+role+'.png'});
   await dialog.getByRole('button',{name:'Create Application',exact:true}).click();await dialog.waitFor({state:'hidden'});assert.equal(apps.length,1);assert.equal(apps[0].owner,user.id);assert.equal(apps[0].role_fit_source,'ai');assert.equal(apps[0].role_fit,'STRONG');assert.equal(apps[0].status,'LEAD');assert.equal(apps[0].job_platform,'Walk-in');
   await page.getByRole('button',{name:'Import job JSON',exact:true}).click();await json.fill(JSON.stringify({role_title:'Junior Sales Assistant',company_name:'Second Shop',description:'Assist customers, organize retail stock, and handle sales transactions.'}));const failed=page.waitForRequest('**/api/role-fit');await dialog.getByRole('button',{name:'Fill draft & assess fit',exact:true}).click();await failed;
   await pending.fulfill({status:502,contentType:'application/json',body:JSON.stringify({success:false,error:'AI unavailable'})});await dialog.getByRole('alert').waitFor();assert.equal(await dialog.getByLabel('Role fit',{exact:true}).inputValue(),'UNASSESSED');assert.equal(apps.length,1);
   await dialog.getByRole('button',{name:'Create Application',exact:true}).click();await dialog.waitFor({state:'hidden'});assert.equal(apps.length,2);assert.equal(apps[1].role_fit,null);assert.equal(fitCalls,2);
   await page.getByRole('button',{name:'New App',exact:true}).click();assert.equal(await json.count(),0);assert.equal(fitCalls,2);await dialog.getByRole('button',{name:'Cancel',exact:true}).click();await page.close();
  }
 }finally{await browser.close();}
});
