const { test } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright-core');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const cache = new Map();
function load(file) {
  const filename = path.resolve(root, file);
  if (cache.has(filename)) return cache.get(filename).exports;
  const m = new Module(filename, module); m.filename = filename; m.paths = Module._nodeModulePaths(path.dirname(filename)); cache.set(filename, m);
  const original = m.require.bind(m);
  m.require = id => {
    const target = id.startsWith('@/') ? path.join(root, 'src', id.slice(2)) : id.startsWith('.') ? path.resolve(path.dirname(filename), id) : null;
    return target && fs.existsSync(target + '.ts') ? load(target + '.ts') : original(id);
  };
  m._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, filename);
  return m.exports;
}
const { pipelineAnalytics, isInternship } = load('src/lib/analytics.ts');
const { analyticsFieldUpdates } = load('src/lib/application-analytics-fields.ts');
const { validatePreferences } = load('src/lib/preferences.ts');

test('AI is optional: filters and PDF work during requests and after failures; last interpretation survives', async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const user = { id: 'member', name: 'Analytics Member', email: 'member@example.com', role: 'member', notion_enabled: false };
    const apps = [
      { id: 'regular', owner: 'member', company_name: 'Example', role_title: 'Junior Software Developer', status: 'APPLIED', date_applied: '2026-10-01', job_type: 'FULL_TIME', work_model: 'REMOTE', priority: 'MEDIUM', salary_currency: 'PHP', created_at: '2026-10-01', updated_at: '2026-10-13' },
      { id: 'intern', owner: 'member', company_name: 'Historical', role_title: 'IT Intern', status: 'OFFER', job_type: 'INTERNSHIP', work_model: 'ON_SITE', priority: 'MEDIUM', salary_currency: 'PHP', created_at: '2026-10-01', updated_at: '2026-10-13' },
    ];
    let aiCalls = 0, assessmentCalls = 0, pending, savedReport = null;
    let preferences = validatePreferences({ default_view: 'ALL', analytics_age_boundaries: [7,14,30] });
    await page.route('**/api/**', async route => {
      const url = new URL(route.request().url()); let data = { success: true, data: [] };
      if (url.pathname === '/api/auth/session') data = { user, expires: '2099-01-01' };
      else if (url.pathname === '/api/users') data.data = [user];
      else if (url.pathname === '/api/profile') data = { success: true, resumeText: '' };
      else if (url.pathname === '/api/applications') data.data = apps;
      else if (url.pathname.startsWith('/api/applications/')) {
        const app = apps.find(item => item.id === url.pathname.split('/').pop());
        if (route.request().method() === 'PUT') {
          const updates = route.request().postDataJSON();
          Object.assign(app, updates, analyticsFieldUpdates(app, updates), { updated_at: new Date().toISOString() });
        }
        data.data = app;
      }
      else if (url.pathname === '/api/notion/sync') data = { configured: false };
      else if (url.pathname === '/api/preferences') {
        if (route.request().method() === 'PUT') preferences = validatePreferences(route.request().postDataJSON());
        data.data = preferences;
      }
      else if (url.pathname === '/api/analytics') {
        const scope = url.searchParams.get('scope');
        const records = apps.filter(app => scope === 'INTERNSHIP' ? isInternship(app) : scope === 'OTHER' ? !isInternship(app) : true);
        const stats = pipelineAnalytics(records, preferences.analytics_status_stages, preferences.analytics_rejection_statuses, new Date(), preferences.analytics_age_boundaries);
        data.data = url.searchParams.get('format') === 'export' ? {applications: records, stats, preferences} : stats;
      } else if (url.pathname === '/api/analytics/insights') { data.data = {report: url.searchParams.get('scope') === 'ALL' ? savedReport : null, currentVersion: 'test-current', outdated: Boolean(savedReport && savedReport.snapshotVersion !== 'test-current')}; }
      else if (url.pathname === '/api/analytics/analyze') { aiCalls++; pending = route; return; }
      else if (url.pathname.includes('role-fit') || url.pathname.startsWith('/api/ai/')) { assessmentCalls++; return route.abort(); }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
    });
    await page.goto(process.env.PIPELINE_TEST_URL || 'http://localhost:3100');
    await page.getByRole('button', { name: 'Analytics', exact: true }).click();
    await page.getByRole('heading', { name: 'Analytics Member’s job-search analytics' }).waitFor();
    await page.getByRole('heading', { name: 'Job title keywords', exact: true }).waitFor();
    assert.equal(await page.getByText('Application effectiveness comparisons', { exact: true }).count(),0);
    assert.equal(aiCalls, 0); assert.equal(assessmentCalls, 0);
    const aging = page.getByRole('region', { name: 'Application aging', exact: true });
    assert.ok(await aging.isVisible());
    assert.match(await aging.innerText(), /1 active submitted applications/);
    await page.getByRole('button', { name: 'My preferences', exact: true }).click();
    await page.getByLabel('Application age boundary 1', { exact: true }).fill('3');
    await page.getByLabel('Application age boundary 2', { exact: true }).fill('10');
    await page.getByLabel('Application age boundary 3', { exact: true }).fill('20');
    await page.getByRole('button', { name: 'Save preferences', exact: true }).click();
    await page.getByText(/Preferences saved/).waitFor();
    await page.getByRole('button', { name: 'Close preferences', exact: true }).click();
    await aging.getByText('21+ days', { exact: true }).first().waitFor();
    const selected = pipelineAnalytics(apps, {}, undefined, new Date(), [3,10,20]).timing.buckets.find(bucket => bucket.pending);
    assert.ok(selected);
    await aging.getByRole('button', { name: `Review unanswered applications aged ${selected.label}`, exact: true }).click();
    const review = page.locator('#analytics-role-review');
    assert.match(await review.innerText(), /Junior Software Developer/);assert.doesNotMatch(await review.innerText(), /IT Intern/);assert.match(await review.innerText(), /Age since submission:/);
    await review.getByRole('button', { name: 'Show all', exact: true }).click();
    assert.equal(aiCalls, 0); assert.equal(assessmentCalls, 0);
    const analyze = page.getByRole('button', { name: /Analyze (my pipeline|again) with AI/ });
    assert.ok((await page.getByRole('heading', {name:'Pipeline insights',exact:true}).boundingBox()).y < (await page.getByRole('heading',{name:'Application pipeline',exact:true}).boundingBox()).y);
    const firstRequest = page.waitForRequest('**/api/analytics/analyze');
    await analyze.click(); await firstRequest;
    assert.equal(aiCalls, 1);
    await page.getByLabel('Analytics job type').selectOption('INTERNSHIP');
    await page.getByLabel('Analytics job type').selectOption('ALL');
    apps.push({...apps[0],id:'saved-in-another-session',role_title:'Customer Service Associate'});
    const downloadEvent = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export PDF', exact: true }).click();
    const download = await downloadEvent; assert.match(download.suggestedFilename(), /^Job-Hunt-Analytics-All-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}\.pdf$/);
    const { extractText } = require('unpdf');
    const text = (await extractText(new Uint8Array(fs.readFileSync(await download.path())), { mergePages: true })).text;
    assert.match(text,/Tracked\s+3/); assert.doesNotMatch(text,/AI interpretation|No AI interpretation|Recorded observations/); apps.pop();
    assert.match(text, /Unanswered application aging/);assert.match(text, /Response within 7 days/);assert.match(text, /21\+ days/);
    assert.equal(aiCalls, 1); assert.equal(assessmentCalls, 0);
    await pending.fulfill({ status: 502, contentType: 'application/json', body: JSON.stringify({ success: false, error: 'AI unavailable' }) });
    await page.getByText('AI unavailable', { exact: true }).waitFor();
    const secondRequest = page.waitForRequest('**/api/analytics/analyze');
    await analyze.click(); await secondRequest;
    savedReport = {summary:'Recorded observations.',observations:[{text:'Submitted applications describe saved history.',evidence:[{id:'pipeline.submitted',label:'Submitted applications',display:'2 applications',value:2}]}],implications:[],recommendations:[{text:'Suggested review.',evidence:[]}],limitations:['Missing callback dates limit response comparisons.'],scope:'ALL',generatedAt:new Date().toISOString(),snapshotVersion:'test-current',reportingDate:'2026-10-14'};
    await pending.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { report:savedReport,currentVersion:'test-current',outdated:false } }) });
    await page.getByText('Recorded observations.', { exact: true }).waitFor();
    const insightCard = page.getByRole('region',{name:'Pipeline insights',exact:true});
    for(const heading of ['What stands out?','What does this mean?','What can I do next?']) assert.ok(await insightCard.getByRole('heading',{name:heading,exact:true}).isVisible());
    await insightCard.screenshot({path:'.data/pipeline-insights-desktop.png'});
    await page.setViewportSize({width:375,height:900});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    await insightCard.screenshot({path:'.data/pipeline-insights-mobile.png'});
    await page.setViewportSize({width:1440,height:1000});
    for (const error of ['API key missing', 'AI did not respond in time. Your analytics remain available.']) {
      const nextRequest = page.waitForRequest('**/api/analytics/analyze'); await analyze.click(); await nextRequest;
      await pending.fulfill({ status: 502, contentType: 'application/json', body: JSON.stringify({ success: false, error }) });
      await page.getByText(error, { exact: true }).waitFor();
      assert.ok(await page.getByText('Recorded observations.', { exact: true }).isVisible());
      assert.ok(await page.getByRole('button', { name: 'Export PDF', exact: true }).isEnabled());
    }
    assert.equal(assessmentCalls, 0);
    const beforeReload = aiCalls; savedReport.snapshotVersion = 'older';
    await page.reload(); await page.getByRole('button',{name:'Analytics',exact:true}).click();
    await page.getByText('Recorded observations.',{exact:true}).waitFor();
    await page.getByText(/Outdated: saved data/).waitFor();
    assert.equal(aiCalls, beforeReload);
    await page.getByLabel('Analytics job type').selectOption('INTERNSHIP');
    await page.getByText('Recorded observations.',{exact:true}).waitFor({state:'hidden'});
    await page.getByLabel('Analytics job type').selectOption('ALL');
    await page.getByText('Recorded observations.',{exact:true}).waitFor();
    assert.equal(aiCalls,beforeReload);
    await page.getByRole('button', { name: 'Table View', exact: true }).click();
    await page.getByText('Junior Software Developer', { exact: true }).last().click();
    await page.getByRole('button', { name: 'Edit', exact: true }).click();
    assert.equal(await page.getByLabel('Seniority level', { exact: true }).inputValue(), '');
    await page.getByLabel('Job title', { exact: true }).fill('AI Engineer');
    assert.ok(await page.getByRole('option', { name: 'Automatic: Unspecified', exact: true }).count());
    await page.getByLabel('Seniority level', { exact: true }).selectOption('JUNIOR');
    assert.equal(await page.getByLabel('Role family', { exact: true }).count(),0);
    await page.getByRole('button', { name: 'Import job JSON', exact: true }).click();
    await page.getByLabel('Job posting JSON').fill(JSON.stringify({role_title:'AI Engineer',job_platform:'Referral',first_response_at:'2026-10-05T12:30:00+08:00',seniority_level:'MID_LEVEL',role_family:'AI-invented category'}));
    await page.getByRole('button', { name: 'Fill draft from JSON', exact: true }).click();
    assert.equal(await page.getByLabel('Seniority level', { exact: true }).inputValue(), 'JUNIOR');
    assert.equal(await page.getByLabel('Role family', { exact: true }).count(),0);
    assert.equal(await page.getByLabel('Job platform', { exact: true }).inputValue(), 'REFERRAL');
    await page.getByRole('button', { name: 'Save Changes', exact: true }).click();
    await page.getByRole('heading', { name: 'Edit Application', exact: true }).waitFor({ state: 'hidden' });
    assert.equal(apps[0].seniority_level, 'JUNIOR'); assert.equal(apps[0].seniority_level_source, 'manual');
    assert.equal(apps[0].job_platform, 'REFERRAL'); assert.equal(apps[0].first_response_at, '2026-10-05T04:30:00.000Z');
    await page.getByText('AI Engineer', { exact: true }).last().click(); await page.getByRole('button', { name: 'Edit', exact: true }).click();
    await page.getByLabel('Job title', { exact: true }).fill('Senior AI Engineer');
    assert.equal(await page.getByLabel('Seniority level', { exact: true }).inputValue(), 'JUNIOR');
    assert.equal(await page.getByLabel('Role family', { exact: true }).count(),0);
    const recordedResponse = await page.getByLabel('First employer response', { exact: true }).inputValue();
    await page.getByRole('button', { name: 'Import job JSON', exact: true }).click();
    await page.getByLabel('Job posting JSON').fill(JSON.stringify({role_title:'Senior AI Engineer',job_platform:'WALK_IN',first_response_at:null,seniority_level:'SENIOR',role_family:'AI-invented category'}));
    await page.getByRole('button', { name: 'Fill draft from JSON', exact: true }).click();
    assert.equal(await page.getByLabel('Seniority level', { exact: true }).inputValue(), 'JUNIOR');
    assert.equal(await page.getByLabel('Role family', { exact: true }).count(),0);
    assert.equal(await page.getByLabel('First employer response', { exact: true }).inputValue(), recordedResponse);
    assert.equal(await page.getByLabel('Job platform', { exact: true }).inputValue(), 'Walk-in');
    await page.getByLabel('Seniority level', { exact: true }).selectOption('');
    assert.equal(await page.getByRole('button', { name: 'Use automatic role family', exact: true }).count(),0);
    assert.equal(await page.getByLabel('Role family', { exact: true }).count(),0);
    await page.getByRole('button', { name: 'Save Changes', exact: true }).click();
    await page.getByRole('heading', { name: 'Edit Application', exact: true }).waitFor({ state: 'hidden' });
    assert.equal(apps[0].seniority_level, 'SENIOR'); assert.equal(apps[0].seniority_level_source, 'derived'); assert.equal(apps[0].role_family,undefined);
    assert.equal(assessmentCalls, 0);
  } finally { await browser.close(); }
});

test('visual dashboard matches the four-page report and drills into submitted chart samples', async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const user = { id: 'visual-member', name: 'Visual Member', email: 'visual@example.com', role: 'member' };
    const base = { owner: user.id, company_name: 'Test Employer', priority: 'MEDIUM', job_type: 'FULL_TIME', work_model: 'REMOTE', salary_currency: 'PHP', created_at: '2026-10-01', updated_at: '2026-10-01' };
    const apps = Array.from({ length: 6 }, (_, i) => ({ ...base, id: String(i), role_title: 'Junior Software Developer', status: i % 2 ? 'SCREENING' : 'OFFER', role_fit: 'STRONG', job_platform: 'LINKEDIN', date_applied: i < 3 ? '2026-08-01' : '2026-09-01', first_response_at: i < 3 ? '2026-08-06T00:00:00Z' : '2026-09-21T00:00:00Z', role_fit_analysis: { preference_alignment: i % 2 ? 'ALIGNED' : 'MIXED' } }));
    apps.push({ ...base, id: 'lead', role_title: 'Junior Software Developer', company_name: 'Unsubmitted Employer', status: 'LEAD', role_fit: 'STRONG', job_platform: 'LINKEDIN' });
    apps.push({ ...base, id: 'other', role_title: 'AI Engineer', company_name: 'Other Employer', status: 'APPLIED', job_type: 'INTERNSHIP', date_applied: '2026-10-12' });
    const preferences = { target_roles: [], target_companies: [], preferred_locations: [], work_models: [], job_types: [], salary_currency: 'PHP', dealbreakers: '', analytics_age_boundaries: [7,14,30] };
    let aiCalls = 0;
    await page.route('**/api/**', async route => {
      const url = new URL(route.request().url()); let data = { success: true, data: [] };
      if (url.pathname === '/api/auth/session') data = { user, expires: '2099-01-01' };
      else if (url.pathname === '/api/users') data.data = [user];
      else if (url.pathname === '/api/applications') data.data = apps;
      else if (url.pathname === '/api/preferences') data.data = preferences;
      else if (url.pathname === '/api/analytics') { const scope = url.searchParams.get('scope'); const records=apps.filter(app => scope === 'INTERNSHIP' ? isInternship(app) : scope === 'OTHER' ? !isInternship(app) : true); const stats=pipelineAnalytics(records); data.data=url.searchParams.get('format')==='export'?{applications:records,stats,preferences}:stats; }
      else if (url.pathname === '/api/analytics/insights') data.data={report:null,currentVersion:'test-current',outdated:false};
      else if (url.pathname === '/api/analytics/analyze' || url.pathname.startsWith('/api/ai') || url.pathname === '/api/role-fit') { aiCalls++; return route.abort(); }
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(data) });
    });
    await page.goto(process.env.PIPELINE_TEST_URL || 'http://localhost:3100');
    await page.getByRole('button', { name: 'Analytics', exact: true }).click();
    for (const title of ['Application pipeline','Application effectiveness','Application timing','Career insights']) await page.getByRole('heading', { name: title, exact: true }).waitFor();
    assert.equal(await page.getByText('Application effectiveness comparisons',{exact:true}).count(),0);
    assert.doesNotMatch(await page.locator('main').innerText(), /\bn\s*[=<]\s*\d+/);
    await page.getByRole('region', { name: 'Response cohort heatmap', exact: true }).waitFor();
    assert.equal(await page.getByRole('img', { name: 'Callback distribution for 6 recorded responses', exact: true }).count(), 1);
    const review = page.locator('#analytics-role-review');
    for (const name of ['Review Software applications','Review LINKEDIN applications','Review Junior applications','Review Strong fit submitted outcomes']) {
      await page.getByRole('button', { name, exact: true }).click();
      assert.match(await review.innerText(), /6 roles in this review/);
      assert.doesNotMatch(await review.innerText(), /Unsubmitted Employer|Other Employer/);
      await review.getByRole('button', { name: 'Show all', exact: true }).click();
    }
    const downloadEvent = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export PDF', exact: true }).click();
    const { getDocumentProxy } = require('unpdf'), download = await downloadEvent;
    const doc = await getDocumentProxy(new Uint8Array(fs.readFileSync(await download.path()))); assert.equal(doc.numPages, 4);
    const { extractImages, extractText } = require('unpdf');
    assert.equal((await extractImages(doc, 1))[0].width, 1774);
    assert.doesNotMatch((await extractText(doc, { mergePages: true })).text, /\bn\s*[=<]\s*\d+/);
    fs.mkdirSync('.data', { recursive: true });
    await page.locator('#analytics-effectiveness').screenshot({ path: '.data/analytics-effectiveness-desktop.png' });
    await page.setViewportSize({ width: 375, height: 900 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await page.getByRole('link', { name: 'Timing', exact: true }).click();
    const timingHeading = await page.getByRole('heading', { name: 'Application timing', exact: true }).boundingBox();
    const header = await page.locator('header').boundingBox();
    assert.ok(timingHeading.y >= header.y + header.height - 1, 'Section navigation keeps the heading below the mobile header');
    await page.locator('#analytics-effectiveness').screenshot({ path: '.data/analytics-effectiveness-mobile.png' });
    await page.locator('#analytics-timing').screenshot({ path: '.data/analytics-timing-mobile.png' });
    await page.getByLabel('Analytics job type').selectOption('INTERNSHIP');
    await page.getByRole('region', { name: 'Response window coverage', exact: true }).waitFor();
    assert.equal(await page.getByRole('region', { name: 'Response cohort heatmap', exact: true }).count(), 0);
    assert.equal(aiCalls, 0);
  } finally { await browser.close(); }
});

test('a completed AI request cannot hide a saved report loading for a different scope',async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),user={id:'scope-member',name:'Scope Member',email:'scope@example.com',role:'member'};
  const apps=['FULL_TIME','INTERNSHIP'].map((job_type,index)=>({id:String(index),owner:user.id,role_title:job_type==='INTERNSHIP'?'Retail Intern':'Retail Associate',company_name:'Example',priority:'MEDIUM',work_model:'ON_SITE',salary_currency:'PHP',status:'APPLIED',job_type,created_at:'2026-10-01',updated_at:'2026-10-01'}));
  const preferences=validatePreferences({default_view:'ALL'});
  const report=(summary,scope)=>({summary,scope,observations:[],implications:[],recommendations:[],limitations:[],generatedAt:new Date().toISOString(),snapshotVersion:'test',reportingDate:'2026-10-14'});
  let aiCalls=0,pendingAI,pendingRead,savedAll=null;
  await page.route('**/api/**',async route=>{
   const url=new URL(route.request().url());let data={success:true,data:[]};
   if(url.pathname==='/api/auth/session')data={user,expires:'2099-01-01'};
   else if(url.pathname==='/api/users')data.data=[user];
   else if(url.pathname==='/api/applications')data.data=apps;
   else if(url.pathname==='/api/preferences')data.data=preferences;
   else if(url.pathname==='/api/analytics')data.data=pipelineAnalytics(apps.filter(app=>url.searchParams.get('scope')==='INTERNSHIP'?isInternship(app):true));
   else if(url.pathname==='/api/analytics/analyze'){aiCalls++;pendingAI=route;return;}
   else if(url.pathname==='/api/analytics/insights'){
    if(url.searchParams.get('scope')==='INTERNSHIP'){pendingRead=route;return;}
    data.data={report:savedAll,currentVersion:'test',outdated:false};
   }
   await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
  });
  await page.goto(process.env.PIPELINE_TEST_URL||'http://localhost:3100');await page.getByRole('button',{name:'Analytics',exact:true}).click();
  const requested=page.waitForRequest('**/api/analytics/analyze');await page.getByRole('button',{name:'Analyze my pipeline with AI',exact:true}).click();await requested;
  const reading=page.waitForRequest(request=>request.url().includes('/api/analytics/insights?scope=INTERNSHIP'));await page.getByLabel('Analytics job type').selectOption('INTERNSHIP');await reading;
  savedAll=report('Combined guidance belongs to the combined scope.','ALL');await pendingAI.fulfill({status:200,contentType:'application/json',body:JSON.stringify({success:true,data:{report:savedAll,currentVersion:'test',outdated:false}})});
  await page.getByText('Analysis is running for another scope. You can keep reviewing charts and exporting.',{exact:true}).waitFor({state:'hidden'});
  await pendingRead.fulfill({status:200,contentType:'application/json',body:JSON.stringify({success:true,data:{report:report('Saved historical internship guidance.','INTERNSHIP'),currentVersion:'test',outdated:false}})});
  await page.getByText('Saved historical internship guidance.',{exact:true}).waitFor();assert.equal(await page.getByText(savedAll.summary,{exact:true}).count(),0);
  await page.getByLabel('Analytics job type').selectOption('ALL');await page.getByText(savedAll.summary,{exact:true}).waitFor();assert.equal(aiCalls,1);
 }finally{await browser.close();}
});
