const {test}=require('node:test');
const assert=require('node:assert/strict');
const {chromium}=require('playwright-core');
const path=require('node:path');
const {applicationWorkflowUpdates}=require('./migrate_db.cjs').loadTypescript(path.resolve(__dirname,'../src/lib/application-workflow.ts'));
for(const role of ['admin','member']) test(`${role} archives, restores, and deletes leads without counting archived leads`,async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
 const page=await browser.newPage();
 const user={id:role==='admin'?'user_ji':'lead_member',name:'Lead Tester',email:`${role}@example.com`,role,notion_enabled:false};
 let leads=[{id:'archive_lead',owner:user.id,company_name:'Example',role_title:'Archive Lead Role',status:'LEAD',notion_status:'Not started',priority:'MEDIUM',job_type:'FULL_TIME',work_model:'REMOTE',salary_currency:'PHP',sync_status:'PENDING',created_at:'2026-10-10',updated_at:'2026-10-10'}];
 await page.route('**/api/**',async route=>{
 const req=route.request(),p=new URL(req.url()).pathname;let data={success:true,data:[]};
 if(p==='/api/auth/session')data={user,expires:'2099-01-01'};
 if(p==='/api/users')data={success:true,data:[user]};
 if(p==='/api/preferences')data={success:true,data:{}};
 if(p==='/api/notion/sync')data={configured:false};
 if(p==='/api/applications')data={success:true,data:leads};
 if(p==='/api/applications/archive_lead'){
 if(req.method()==='PUT'){const body=req.postDataJSON();leads[0]={...leads[0],...applicationWorkflowUpdates(leads[0],body)};assert.equal(leads[0].status,'LEAD');data={success:true,data:leads[0]};}
 if(req.method()==='DELETE'){leads=[];data={success:true};}
 }
 await route.fulfill({contentType:'application/json',body:JSON.stringify(data)});
 });
 await page.goto(process.env.PIPELINE_TEST_URL||'http://localhost:3100');
 await page.getByRole('button',{name:'Leads (1)',exact:true}).click();
 await page.getByRole('button',{name:'Archive',exact:true}).click();
 await page.getByRole('button',{name:'Leads (0)',exact:true}).waitFor();
 await page.getByRole('button',{name:'Archived leads (1)',exact:true}).click();
 await page.getByRole('button',{name:'Unarchive',exact:true}).waitFor();
 assert.equal(await page.getByRole('button',{name:'Mark applied',exact:true}).count(),0);
 await page.reload();
 await page.getByRole('button',{name:'Leads (0)',exact:true}).click();
 await page.getByRole('button',{name:'Archived leads (1)',exact:true}).click();
 await page.getByRole('button',{name:'Unarchive',exact:true}).click();
 await page.getByRole('button',{name:'Leads (1)',exact:true}).waitFor();
 await page.getByRole('button',{name:'Saved leads (1)',exact:true}).click();
 await page.getByRole('button',{name:'Archive',exact:true}).click();
 await page.getByRole('button',{name:'Archived leads (1)',exact:true}).click();
 page.on('dialog',dialog=>dialog.accept());
 await page.getByRole('button',{name:'Delete lead',exact:true}).click();
 await page.getByRole('button',{name:'Archived leads (0)',exact:true}).waitFor();
 assert.equal(leads.length,0);
 }finally{await browser.close();}
});
