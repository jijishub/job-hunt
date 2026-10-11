'use client';

import { useEffect, useMemo, useState } from 'react';
import { JobApplication, Company } from '@/types/job';
import { pipelineAnalytics, isInternship, uniqueApplications, currentOutcome, applicationDay } from '@/lib/analytics';
import { analyticsPdf } from '@/lib/analytics-export';
import { reachedStage, recordedStages, ANALYTICS_STAGES, AnalyticsStage, DEFAULT_REJECTION_STATUSES } from '@/lib/analytics-stages';
import { validRoleFit } from '@/lib/role-fit';
import RoleFitBadge from './RoleFitBadge';
import AnalyticsCharts, { ChartSelection } from './AnalyticsCharts';
import { PersonalPreferences, DefaultView } from '@/lib/preferences';
import SalaryOffersChart from './SalaryOffersChart';
import SalaryExpectationsChart from './SalaryExpectationsChart';
import { recordedSalaryOffer, recordedExpectedSalary, offerPeriodLabel } from '@/lib/salary-offers';
import { formatSalaryRange } from '@/lib/currencies';

interface AnalyticsViewProps {
  applications: JobApplication[];
  companies: Company[];
  accountName: string;
  preferenceVersion: number;
  defaultScope?: DefaultView;
  onEditApp?: (app: JobApplication) => void;
}
const percent = (value: number | null) => value === null ? '—' : `${value}%`;
const card = 'min-w-0 rounded-2xl border border-[#F1DDE9] bg-white p-5 shadow-xs';
const button = 'rounded-xl border border-[#F1DDE9] bg-[#FFF0F6] px-3 py-2 text-xs font-semibold text-[#9D3C5E] disabled:opacity-50';

export default function AnalyticsView({ applications, accountName, onEditApp, preferenceVersion, defaultScope = 'ALL' }: AnalyticsViewProps) {
  const [mapping, setMapping] = useState<Record<string, AnalyticsStage>>({});
  const [rejectionStatuses, setRejectionStatuses] = useState<readonly string[]>(DEFAULT_REJECTION_STATUSES);
  const [preferencesReady, setPreferencesReady] = useState(false);
  const [preferences, setPreferences] = useState<PersonalPreferences | undefined>();
  const [preferenceError, setPreferenceError] = useState('');
  useEffect(() => {
    const controller = new AbortController(); setPreferencesReady(false); setPreferenceError('');
    fetch('/api/preferences', { signal: controller.signal }).then(r => r.json()).then(d => {
      if (!d.success) throw new Error(d.error || 'Preferences could not be loaded.');
      setPreferences(d.data);
      setMapping(d.data.analytics_status_stages || {});
      setRejectionStatuses(d.data.analytics_rejection_statuses ?? DEFAULT_REJECTION_STATUSES); setPreferencesReady(true);
    }).catch(error => { if (error.name !== 'AbortError') setPreferenceError(error.message); });
    return () => controller.abort();
  }, [preferenceVersion]);
  const [scope, setScope] = useState<DefaultView>(defaultScope);
  const scoped = useMemo(() => uniqueApplications(applications).filter(app => scope === 'INTERNSHIP' ? isInternship(app) : scope === 'OTHER' ? !isInternship(app) : true), [applications, scope]);
  const stats = useMemo(() => pipelineAnalytics(applications.filter(app => scope === 'INTERNSHIP' ? isInternship(app) : scope === 'OTHER' ? !isInternship(app) : true), mapping, rejectionStatuses), [applications, scope, mapping, rejectionStatuses]);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [selection, setSelection] = useState<ChartSelection | null>(null);
  const [reviewQuery, setReviewQuery] = useState('');
  const [reviewPage, setReviewPage] = useState(0);
  useEffect(() => { setScope(defaultScope); setSelection(null); setReviewPage(0); }, [defaultScope]);
  const [insight, setInsight] = useState<{ summary: string; nextSteps: string[]; signature: string } | null>(null);
  const signature = JSON.stringify([preferenceVersion, scope, mapping, rejectionStatuses, scoped.map(app => [app.id, app.updated_at])]);
  const currentInsight = insight?.signature === signature ? insight : null;
  const scopeLabel = scope === 'INTERNSHIP' ? 'Internships' : scope === 'OTHER' ? 'Regular Employment' : 'All (combined)';
  const reviewApps = scoped.filter(app => {
    if (selection?.kind === 'offer' && recordedSalaryOffer(app)?.key !== selection.value) return false;
    if (selection?.kind === 'expected' && recordedExpectedSalary(app)?.key !== selection.value) return false;
    if (selection?.kind === 'fit' && (validRoleFit(app.role_fit) ? app.role_fit : 'UNASSESSED') !== selection.value) return false;
    if (selection?.kind === 'outcome' && currentOutcome(app, mapping, rejectionStatuses) !== selection.value) return false;
    if (selection?.kind === 'month' && (reachedStage(app, mapping) < 1 || !applicationDay(app.date_applied)?.startsWith(selection.value) || applicationDay(app.date_applied)! > stats.asOf)) return false;
    if (selection?.kind === 'phase') {
      if (reachedStage(app, mapping) < ANALYTICS_STAGES.indexOf(selection.value)) return false;
      const recorded = selection.value === 'SUBMITTED' || recordedStages(app, mapping).includes(selection.value);
      if (selection.evidence === 'recorded' && !recorded || selection.evidence === 'inferred' && recorded) return false;
    }
    return `${app.role_title} ${app.company_name}`.toLowerCase().includes(reviewQuery.trim().toLowerCase());
  });
  const pageCount = Math.max(1, Math.ceil(reviewApps.length / 10));
  const safePage = Math.min(reviewPage, pageCount - 1);
  function review(value: ChartSelection) {
    setSelection(value); setReviewPage(0); setReviewQuery('');
    document.getElementById('analytics-role-review')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  async function analyzePipeline() {
    setBusy('insights'); setMessage('');
    try {
      const response = await fetch('/api/analytics/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scope }) });
      const data = await response.json(); if (!response.ok || !data.success) throw new Error(data.error || 'Analysis failed.');
      setInsight({ ...data.data, signature });
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Analysis failed.'); }
    finally { setBusy(''); }
  }
  async function exportPdf() {
    setBusy('pdf'); setMessage('');
    try { const pdf = await analyticsPdf(scoped, accountName, scopeLabel, currentInsight || undefined, mapping, rejectionStatuses, preferences); pdf.save('my-job-search-analytics.pdf'); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'PDF export failed.'); }
    finally { setBusy(''); }
  }
  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-lg font-bold text-[#4A3E44]">{accountName}’s job-search analytics</h2><p className="text-xs text-[#736A6D]">Your saved applications · click charts to review the records.</p></div>
      <div className="flex flex-wrap gap-2">
        <select aria-label="Analytics job type" value={scope} disabled={Boolean(busy)} onChange={event => { setScope(event.target.value as DefaultView); setSelection(null); setReviewPage(0); }} className={button}><option value="ALL">All (combined)</option><option value="INTERNSHIP">Internships</option><option value="OTHER">Regular Employment</option></select>
        <button disabled={Boolean(busy) || !preferencesReady} className={button} onClick={exportPdf}>{busy === 'pdf' ? 'Exporting…' : 'Export PDF'}</button>
      </div>
    </div>
    {preferenceError && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{preferenceError} Reload to retry.</p>}
    {!preferencesReady ? <p role="status" className="text-sm text-[#736A6D]">{preferenceError ? 'Analytics paused until your saved settings load.' : 'Loading your analytics settings…'}</p> : <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-5">{[
        ['Tracked roles', stats.total, `${stats.leads} not submitted`],
        ['Submitted', stats.submitted, `${stats.recent} in the last 30 days`],
        ['Progression', percent(stats.progressionRate), `${stats.funnel[1].count} past submission`],
        ['Offers', stats.funnel[4].count, `${percent(stats.offerRate)} of submitted applications`],
        ['Rejections', stats.rejections, `${percent(stats.rejectionRate)} of submitted applications`],
      ].map(([label, value, detail]) => <div key={label} className={card}><p className="text-xs font-semibold text-[#736A6D]">{label}</p><p className="my-2 text-3xl font-bold text-[#9D3C5E]">{value}</p><p className="text-[11px] text-[#736A6D]">{detail}</p></div>)}</div>
      <AnalyticsCharts stats={stats} onReview={review} />
      <SalaryOffersChart stats={stats} preferences={preferences} onReview={review} />
      <SalaryExpectationsChart stats={stats} onReview={review} />
      <div className="grid gap-4 lg:grid-cols-2">
        <section className={card}><h3 className="text-sm font-bold">Fit coverage</h3><p className="mt-1 text-xs text-[#736A6D]">{stats.assessed} assessed · {stats.unassessed} unassessed · {percent(stats.coverage)} coverage</p>
          <div className="mt-4 flex h-5 overflow-hidden rounded-lg bg-[#FAF7F9]">{stats.fits.map((fit, index) => fit.total > 0 && <button type="button" key={fit.value} style={{ width: `${fit.total / stats.total * 100}%`, backgroundColor: ['#A6DCC7', '#F4D6A4', '#F6B4C4', '#C8BCE8'][index] }} title={`${fit.label}: ${fit.total}`} aria-label={`Review ${fit.total} ${fit.label} roles`} onClick={() => review({ kind: 'fit', value: fit.value, label: fit.label })} />)}</div>
          <details className="mt-3 text-xs"><summary className="cursor-pointer text-[#9D3C5E]">Role fit and conversion details</summary><div className="mt-3 overflow-x-auto"><table className="w-full text-left"><thead><tr>{['Role fit', 'Tracked', 'Submitted', 'Progressed', 'Offers', 'Rejections'].map(label => <th key={label} className="p-2">{label}</th>)}</tr></thead><tbody>{stats.fits.map(fit => <tr key={fit.value} className="border-t border-[#F1DDE9]"><td className="p-2 whitespace-nowrap">{fit.label}</td><td className="p-2">{fit.total}</td><td className="p-2">{fit.submitted}</td><td className="p-2">{fit.progressed} ({percent(fit.progressionRate)})</td><td className="p-2">{fit.offers} ({percent(fit.offerRate)})</td><td className="p-2">{fit.rejections} ({percent(fit.rejectionRate)})</td></tr>)}</tbody></table></div></details>
        </section>
        <section className={card}><h3 className="text-sm font-bold">Preference alignment</h3><p className="mt-1 text-xs text-[#736A6D]">Saved AI comparisons · separate from experience fit.</p><div className="mt-4 space-y-2">{stats.preferenceAlignment.map((item, index) => <div key={item.label} className="grid grid-cols-[6rem_1fr_2rem] items-center gap-2 text-xs"><span className="capitalize">{item.label.toLowerCase()}</span><span className="h-3 overflow-hidden rounded-lg bg-[#FAF7F9]"><span className="block h-full rounded-lg" style={{ width: `${stats.total ? item.count / stats.total * 100 : 0}%`, backgroundColor: ['#A6DCC7', '#F4D6A4', '#F6B4C4', '#C8BCE8'][index] }} /></span><strong className="text-right">{item.count}</strong></div>)}</div></section>
      </div>
      <details className={`${card} text-xs`}><summary className="cursor-pointer font-semibold">Data checks & counting rules <span className="ml-2 font-normal text-[#736A6D]">{stats.quality.uncertainPhases} phases to review · {stats.quality.missingDates} missing dates</span></summary>
        <div className="mt-3 space-y-2 text-[#736A6D]"><p>Rates use submitted applications in the selected scope. Offers include declined offers. Rejections use the current statuses selected in My preferences.</p><p>Earlier phases inferred from a later outcome are lavender, not recorded interview evidence. Each application ID counts once; the newest duplicate is used.</p><p>{stats.quality.duplicateRecords} duplicate records removed · {stats.quality.invalidDates} invalid dates · {stats.quality.futureDates} future dates excluded from activity. Missing dates stay in total counts.</p><p>Fit groups can overlap with recorded outcomes and are not randomized. Small samples and unassessed roles limit comparisons; these rates cannot prove which resume or fit category caused an outcome.</p><p>Assess relevant roles inside their application using Reanalyze role fit. Review past jobs before rating them against your current resume.</p></div>
      </details>
      <section className={card}><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-sm font-bold">Pipeline insights</h3><p className="mt-1 text-xs text-[#736A6D]">Uses this scope, your master resume and preferences. Saved fit ratings stay intact.</p></div><button className={button} disabled={Boolean(busy) || !stats.total} onClick={analyzePipeline}>{busy === 'insights' ? 'Analyzing…' : 'Analyze my pipeline with AI'}</button></div>
        {currentInsight && <div className="mt-4 text-xs text-[#736A6D]"><p>{currentInsight.summary}</p><ul className="mt-3 list-disc space-y-1 pl-4">{currentInsight.nextSteps.map(step => <li key={step}>{step}</li>)}</ul></div>}
        {message && <p role="status" className="mt-3 rounded-xl bg-[#FFF0F6] p-3 text-xs text-[#9D3C5E]">{message}</p>}
      </section>
      <section id="analytics-role-review" className={`${card} scroll-mt-24`}><div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-sm font-bold">Review your role fits {selection && <span className="ml-2 text-xs font-normal text-[#9D3C5E]">{selection.label}</span>}</h3><div className="flex items-center gap-2"><input aria-label="Search analytics roles" placeholder="Search role or company" value={reviewQuery} onChange={event => { setReviewQuery(event.target.value); setReviewPage(0); }} className="rounded-lg border border-[#F1DDE9] px-2 py-1.5 text-xs" />{selection && <button className={button} onClick={() => { setSelection(null); setReviewPage(0); }}>Show all</button>}</div></div>
        <p className="mt-2 text-[11px] text-[#736A6D]">{reviewApps.length} roles in this review</p>
        <div className="mt-3 space-y-2">{reviewApps.slice(safePage * 10, (safePage + 1) * 10).map(app => {
          const offer = recordedSalaryOffer(app);
          const expected = recordedExpectedSalary(app);
          return <div key={app.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#FAF7F9] p-3 text-xs"><div><strong>{app.role_title}</strong><p className="text-[#736A6D]">{app.company_name} · {app.notion_status || app.status}</p>{offer && <p className="mt-1 font-medium text-[#9D3C5E]">{formatSalaryRange(offer.amount, undefined, offer.currency)} / {offerPeriodLabel(offer.period).toLowerCase()}</p>}{expected && <p className="mt-1 text-[#736A6D]">Expected: {formatSalaryRange(expected.amount, undefined, expected.currency)} / {offerPeriodLabel(expected.period).toLowerCase()}</p>}</div><div className="flex items-center gap-2"><RoleFitBadge app={app} />{onEditApp && <button onClick={() => onEditApp(app)} className={button}>{selection?.kind === 'offer' ? 'Review offer' : selection?.kind === 'expected' ? 'Review salary' : 'Review fit'}</button>}</div></div>;
        })}{!reviewApps.length && <p className="text-xs text-[#736A6D]">No roles match this review.</p>}</div>
        {pageCount > 1 && <div className="mt-3 flex items-center justify-end gap-3 text-xs"><button disabled={!safePage} className={button} onClick={() => setReviewPage(safePage - 1)}>Previous</button><span>{safePage + 1} / {pageCount}</span><button disabled={safePage === pageCount - 1} className={button} onClick={() => setReviewPage(safePage + 1)}>Next</button></div>}
      </section>
    </>}
  </div>;
}
