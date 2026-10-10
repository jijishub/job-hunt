'use client';

import { useMemo, useState } from 'react';
import { JobApplication, Company } from '@/types/job';
import { pipelineAnalytics, isInternship } from '@/lib/analytics';
import { analyticsPdf } from '@/lib/analytics-export';
import CandidateProfileEditor from './CandidateProfileEditor';
import RoleFitBadge from './RoleFitBadge';

interface AnalyticsViewProps {
 applications: JobApplication[];
 companies: Company[];
 accountName: string;
 preferenceVersion: number;
 onRefresh: () => Promise<void>;
 onEditApp?: (app: JobApplication) => void;
}
const percent = (value: number | null) => value === null ? '—' : `${value}%`;
const card = 'rounded-2xl border border-[#F1DDE9] bg-white p-5 shadow-xs';
const button = 'rounded-xl border border-[#F1DDE9] bg-[#FFF0F6] px-3 py-2 text-xs font-semibold text-[#9D3C5E] disabled:opacity-50';
export default function AnalyticsView({ applications, accountName, onRefresh, onEditApp, preferenceVersion }: AnalyticsViewProps) {
 const [scope, setScope] = useState('ALL');
 const scoped = useMemo(() => applications.filter(app => scope === 'INTERNSHIP' ? isInternship(app) : scope === 'OTHER' ? !isInternship(app) : true), [applications, scope]);
 const stats = useMemo(() => pipelineAnalytics(scoped), [scoped]);
 const [busy, setBusy] = useState('');
 const [message, setMessage] = useState('');
 const [insight, setInsight] = useState<{summary: string; nextSteps: string[]; scope: string; signature: string} | null>(null);
 const signature = String(preferenceVersion) + ':' + scoped.map(app => `${app.id}:${app.updated_at}`).join('|');
 const currentInsight = insight?.scope === scope && insight.signature === signature ? insight : null;
 const scopeLabel = scope === 'INTERNSHIP' ? 'Internships' : scope === 'OTHER' ? 'Other roles' : 'All my roles';
 async function analyzeUnassessed() {
  setBusy('fits'); setMessage('');
  const targets = scoped.filter(app => !app.role_fit && (app.job_description || '').trim().length >= 30);
  let assessed = 0; let failed = 0; let lastError = '';
  try {
   for (const [index, app] of targets.entries()) {
    setMessage(`Assessing ${index + 1} of ${targets.length}: ${app.role_title}`);
    const response = await fetch('/api/role-fit', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({id: app.id}) });
    const data = await response.json();
    if (response.ok && data.success) assessed++; else { failed++; lastError = data.error || 'Assessment failed.'; }
   }
   await onRefresh();
   const missing = scoped.filter(app => !app.role_fit && (app.job_description || '').trim().length < 30).length;
   setMessage(`${assessed} assessed. ${missing} need job requirements.${failed ? ` ${failed} failed: ${lastError}` : ''}`);
  } catch (error) { setMessage(error instanceof Error ? error.message : 'Fit assessment failed. Saved assessments are retained.'); }
  finally { setBusy(''); }
 }
 async function analyzePipeline() {
  setBusy('insights'); setMessage('');
  try {
   const response = await fetch('/api/analytics/analyze', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({scope})});
   const data = await response.json(); if (!response.ok || !data.success) throw new Error(data.error);
   setInsight({...data.data,scope,signature});
  } catch (error) { setMessage(error instanceof Error ? error.message : 'Analysis failed.'); }
  finally { setBusy(''); }
 }
 async function exportPdf() {
  setBusy('pdf'); setMessage('');
  try { const pdf = await analyticsPdf(scoped, accountName, scopeLabel, currentInsight ? currentInsight.summary+'\n'+currentInsight.nextSteps.join('\n') : undefined); pdf.save('my-job-search-analytics.pdf'); }
  catch (error) { setMessage(error instanceof Error ? error.message : 'PDF export failed.'); }
  finally { setBusy(''); }
 }
 return (
  <div className="space-y-5">
   <div className="flex flex-wrap items-center justify-between gap-3">
    <div><h2 className="text-lg font-bold text-[#4A3E44]">{accountName}’s job-search analytics</h2><p className="text-xs text-[#736A6D]">Target relevant roles and follow your recorded progress.</p></div>
    <div className="flex flex-wrap gap-2">
     <select aria-label="Analytics job type" value={scope} disabled={Boolean(busy)} onChange={event => setScope(event.target.value)} className={button}><option value="ALL">All my roles</option><option value="INTERNSHIP">Internships</option><option value="OTHER">Other roles</option></select>
     <button disabled={Boolean(busy)} className={button} onClick={exportPdf}>{busy === 'pdf' ? 'Exporting…' : 'Export PDF'}</button>
    </div>
   </div>
   <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
    {[
     ['Tracked roles', stats.total, `${stats.leads} not submitted / leads`],
     ['Submitted', stats.submitted, `${stats.recent} submitted in the last 30 days`],
     ['Screening progression', percent(stats.progressionRate), `${stats.funnel[1].count} reached screening or later`],
     ['Offers', stats.funnel[4].count, `${percent(stats.offerRate)} of submitted applications`],
    ].map(([label, value, detail]) => <div key={label} className={card}><p className="text-xs font-semibold text-[#736A6D]">{label}</p><p className="my-2 text-3xl font-bold text-[#9D3C5E]">{value}</p><p className="text-[11px] text-[#736A6D]">{detail}</p></div>)}
   </div>
   <section className={card}>
    <div className="flex flex-wrap justify-between gap-2"><div><h3 className="font-bold text-sm">Role fit and conversion</h3><p className="text-xs text-[#736A6D] mt-1">{stats.assessed} assessed · {stats.unassessed} unassessed · {percent(stats.coverage)} coverage</p></div><button disabled={Boolean(busy) || !stats.unassessed} className={button} onClick={analyzeUnassessed}>{busy === 'fits' ? 'Assessing…' : 'Analyze unassessed roles'}</button></div>
    <div className="overflow-x-auto mt-4"><table className="w-full text-xs text-left"><thead><tr className="border-b border-[#F1DDE9] text-[#736A6D]">{['Role fit','Tracked','Submitted','Screening or later','Offers'].map(label=><th key={label} className="p-2">{label}</th>)}</tr></thead><tbody>{stats.fits.map(fit=><tr key={fit.value} className="border-b border-[#F1DDE9]/50"><td className="p-2 min-w-[200px]"><strong>{fit.label}</strong><p className="text-[11px] text-[#736A6D] mt-1">{fit.description}</p></td><td className="p-2">{fit.total}</td><td className="p-2">{fit.submitted}</td><td className="p-2">{fit.progressed} ({percent(fit.progressionRate)})</td><td className="p-2">{fit.offers} ({percent(fit.offerRate)})</td></tr>)}</tbody></table></div>
    <p className="mt-3 text-[11px] text-[#736A6D]">Rates use submitted roles in each fit group; entries marked Repeated or Not Accepting Interns are excluded unless submission history exists. Unassessed roles are kept separate. Small samples describe your recorded results and do not predict future outcomes.</p>
    <div className="mt-3"><CandidateProfileEditor /></div>
   </section>
   <div className="grid gap-4 lg:grid-cols-2">
    <section className={card}><h3 className="font-bold text-sm mb-4">Recorded progression</h3><div className="space-y-3">{stats.funnel.map(stage=><div key={stage.label}><div className="flex justify-between text-xs mb-1"><span>{stage.label}</span><strong>{stage.count}</strong></div><div className="h-2 rounded-full bg-[#FAF7F9]"><div className="h-2 rounded-full bg-[#FF7AB3]" style={{width:`${stats.submitted ? stage.count / stats.submitted * 100 : 0}%`}} /></div></div>)}</div><p className="mt-4 text-[11px] text-[#736A6D]">Based on current stages and transitions recorded from now onward. Older history may be missing; rejected roles alone do not establish which rounds they reached.</p></section>
    <section className={card}><h3 className="font-bold text-sm mb-3">Where to focus</h3><ul className="list-disc pl-4 space-y-3 text-xs text-[#736A6D]">{stats.recommendations.map(item=><li key={item}>{item}</li>)}</ul><p className="mt-4 text-[11px] text-[#736A6D]">These prompts follow the targeting and funnel framework in your reference notes. They are possible areas to investigate, rather than measured causes.</p><button className={`${button} mt-4`} disabled={Boolean(busy) || !stats.total} onClick={analyzePipeline}>{busy === 'insights' ? 'Analyzing…' : 'Analyze my pipeline with AI'}</button></section>
   </div>
   <section className={card}><h3 className="font-bold text-sm mb-3">Opportunity mix</h3><div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">{[['Internships',scoped.filter(isInternship).length],['Other roles',scoped.filter(app=>!isInternship(app)).length],['On-site',scoped.filter(app=>app.work_model==='ON_SITE').length],['Hybrid',scoped.filter(app=>app.work_model==='HYBRID').length],['Remote',scoped.filter(app=>app.work_model==='REMOTE').length]].map(([label,count])=><p key={label}>{label}: <strong>{count}</strong></p>)}</div></section>
   <section className={card}><h3 className="font-bold text-sm mb-3">Preference alignment</h3><div className="flex flex-wrap gap-5 text-xs">{stats.preferenceAlignment.map(item => <span key={item.label} className="capitalize">{item.label.toLowerCase()}: <strong>{item.count}</strong></span>)}</div><p className="mt-3 text-[11px] text-[#736A6D]">Experience fit and preference alignment are separate. Alignment uses each role?s saved AI assessment; reassess after changing your preferences.</p></section>
   {currentInsight && <section className={card}><h3 className="font-bold text-sm mb-2">AI interpretation</h3><p className="text-xs text-[#736A6D]">{currentInsight.summary}</p><ul className="mt-3 list-disc pl-4 space-y-2 text-xs">{currentInsight.nextSteps.map(step=><li key={step}>{step}</li>)}</ul></section>}
   {message && <p role="status" className="rounded-xl bg-[#FFF0F6] p-3 text-xs text-[#9D3C5E]">{message}</p>}
   <section className={card}><h3 className="font-bold text-sm mb-3">Review your role fits</h3><div className="space-y-2 max-h-96 overflow-y-auto">{scoped.length ? scoped.map(app=><div key={app.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#FAF7F9] p-3 text-xs"><div><strong>{app.role_title}</strong><p className="text-[#736A6D]">{app.company_name} · {app.notion_status || app.status}</p></div><div className="flex items-center gap-2"><RoleFitBadge app={app}/>{onEditApp&&<button onClick={()=>onEditApp(app)} className={button}>Review fit</button>}</div></div>):<p className="text-xs text-[#736A6D]">No roles in this view yet.</p>}</div></section>
  </div>
 );
}
