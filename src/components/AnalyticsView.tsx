'use client';

import { useEffect, useMemo, useState } from 'react';
import { JobApplication, Company } from '@/types/job';
import { pipelineAnalytics, isInternship, uniqueApplications, currentOutcome, applicationDay, type PipelineStats } from '@/lib/analytics';
import AnalyticsComparisons from './AnalyticsComparisons';
import AnalyticsAging from './AnalyticsAging';
import AnalyticsCareer from './AnalyticsCareer';
import PipelineInsights from './PipelineInsights';
import { analyticsReportData, reportRoleFamily } from '@/lib/analytics-report';
import { effectiveSeniority, SENIORITY_LEVELS } from '@/lib/application-analytics-fields';
import { applicationAgeDays, awaitingEmployerResponse } from '@/lib/analytics-timing';
import { analyticsPdf } from '@/lib/analytics-export';
import { reachedStage, recordedStages, ANALYTICS_STAGES, AnalyticsStage, DEFAULT_REJECTION_STATUSES } from '@/lib/analytics-stages';
import { savedRoleFit } from '@/lib/role-fit';
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
const percent = (value: number | null) => value === null ? 'N/A' : `${value}%`;
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
  const [reportDay, setReportDay] = useState(() => applicationDay(new Date().toISOString())!);
  useEffect(() => {
    const timer = setInterval(() => setReportDay(applicationDay(new Date().toISOString())!), 60000);
    return () => clearInterval(timer);
  }, []);
  const scopeRecords = useMemo(() => applications.filter(app => scope === 'INTERNSHIP' ? isInternship(app) : scope === 'OTHER' ? !isInternship(app) : true), [applications, scope]);
  const scoped = useMemo(() => uniqueApplications(scopeRecords), [scopeRecords]);
  const [snapshot, setSnapshot] = useState<{ key: string; stats: PipelineStats } | null>(null);
  const snapshotKey = JSON.stringify([scope, preferenceVersion, reportDay, applications.map(app => [app.id, app.updated_at])]);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/analytics?scope=${scope}`, { signal: controller.signal, cache: 'no-store' }).then(r => r.json()).then(data => {
      if (data.success && data.data && typeof data.data.total === 'number' && data.data.dimensions && data.data.timing) setSnapshot({ key: snapshotKey, stats: data.data });
    }).catch(() => { /* Saved records remain usable if the aggregate endpoint is unavailable. */ });
    return () => controller.abort();
  }, [scope, snapshotKey]);
  const stats = useMemo(() => snapshot?.key === snapshotKey ? snapshot.stats : pipelineAnalytics(scopeRecords, mapping, rejectionStatuses, new Date(), preferences?.analytics_age_boundaries), [snapshot, snapshotKey, scopeRecords, mapping, rejectionStatuses, preferences?.analytics_age_boundaries]);
  const report = useMemo(() => analyticsReportData(scoped, stats, mapping, rejectionStatuses), [scoped, stats, mapping, rejectionStatuses]);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [selection, setSelection] = useState<ChartSelection | null>(null);
  const [reviewQuery, setReviewQuery] = useState('');
  const [reviewPage, setReviewPage] = useState(0);
  useEffect(() => { setScope(defaultScope); setSelection(null); setReviewPage(0); }, [defaultScope]);
  const signature = JSON.stringify([preferenceVersion, scope, reportDay, preferences?.analytics_age_boundaries, mapping, rejectionStatuses, scoped.map(app => [app.id, app.updated_at])]);
  const scopeLabel = scope === 'INTERNSHIP' ? 'Internships' : scope === 'OTHER' ? 'Regular Employment' : 'All (combined)';
  const reviewApps = scoped.filter(app => {
    if (selection?.kind === 'fit' && selection.submittedOnly && reachedStage(app, mapping) < 1) return false;
    if (selection?.kind === 'role' && (reachedStage(app, mapping) < 1 || reportRoleFamily(app) !== selection.value)) return false;
    if (selection?.kind === 'platform' && (reachedStage(app, mapping) < 1 || (app.job_platform?.trim().toUpperCase() || app.source?.trim().toUpperCase() || 'UNKNOWN') !== selection.value)) return false;
    if (selection?.kind === 'seniority' && (reachedStage(app, mapping) < 1 || SENIORITY_LEVELS.find(level => level.value === effectiveSeniority(app))!.label !== selection.value)) return false;
    if (selection?.kind === 'type' && (reachedStage(app, mapping) < 1 || isInternship(app) !== (selection.value === 'Internships'))) return false;
    if (selection?.kind === 'age') {
      if (reachedStage(app, mapping) < 1) return false;
      if (selection.pending && !awaitingEmployerResponse(app, mapping, currentOutcome(app, mapping, rejectionStatuses) === 'ACTIVE')) return false;
      const age = applicationAgeDays(app, applicationDay, stats.asOf);
      if (selection.min === null ? age !== null : age === null || age < selection.min || selection.max !== null && age > selection.max) return false;
    }
    if (selection?.kind === 'offer' && recordedSalaryOffer(app)?.key !== selection.value) return false;
    if (selection?.kind === 'expected' && recordedExpectedSalary(app)?.key !== selection.value) return false;
    if (selection?.kind === 'fit' && (savedRoleFit(app) || 'UNASSESSED') !== selection.value) return false;
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
  async function exportPdf() {
    setBusy('pdf'); setMessage('');
    try {
      const response = await fetch(`/api/analytics?scope=${scope}&format=export`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok || !data.success || !Array.isArray(data.data?.applications) || !data.data?.stats) throw new Error(data.error || 'Latest saved analytics could not be loaded. Please retry the export.');
      const { applications: latest, stats: latestStats, preferences: latestPreferences } = data.data;
      const pdf = await analyticsPdf(latest, accountName, scopeLabel, latestPreferences?.analytics_status_stages || {}, latestPreferences?.analytics_rejection_statuses ?? DEFAULT_REJECTION_STATUSES, latestPreferences, latestStats);
      const filenameScope = scope === 'INTERNSHIP' ? 'Internships' : scope === 'OTHER' ? 'Regular-Employment' : 'All';
      const exportedAt = new Date();
      const time = [exportedAt.getHours(), exportedAt.getMinutes(), exportedAt.getSeconds()].map(value => String(value).padStart(2, '0')).join('-');
      pdf.save(`Job-Hunt-Analytics-${filenameScope}-${latestStats.asOf}-${time}.pdf`);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'PDF export failed.'); }
    finally { setBusy(''); }
  }
  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-lg font-bold text-[#4A3E44]">{accountName}’s job-search analytics</h2><p className="text-xs text-[#736A6D]">Your saved applications · click charts to review the records.</p></div>
      <div className="flex flex-wrap gap-2">
        <select aria-label="Analytics job type" value={scope} disabled={busy === 'pdf'} onChange={event => { setScope(event.target.value as DefaultView); setSelection(null); setReviewPage(0); }} className={button}><option value="ALL">All (combined)</option><option value="INTERNSHIP">Internships</option><option value="OTHER">Regular Employment</option></select>
        <button disabled={busy === 'pdf' || !preferencesReady} className={button} onClick={exportPdf}>{busy === 'pdf' ? 'Exporting…' : 'Export PDF'}</button>
      </div>
    </div>
    {message && <p role="status" className="rounded-xl bg-[#FFF0F6] p-3 text-xs text-[#9D3C5E]">{message}</p>}
    <PipelineInsights scope={scope} dataVersion={signature} total={stats.total} />
    {preferenceError && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{preferenceError} Reload to retry.</p>}
    {!preferencesReady ? <p role="status" className="text-sm text-[#736A6D]">{preferenceError ? 'Analytics paused until your saved settings load.' : 'Loading your analytics settings…'}</p> : <>
      {scope === 'ALL' && report.types.length > 1 && <p className="rounded-xl bg-[#FFF0F6] p-3 text-xs text-[#736A6D]">All combines internships and non-internship applications. Use the filter to compare them separately; historical and recent records have different observation time.</p>}
      <nav aria-label="Analytics sections" className="flex flex-wrap gap-2 text-xs text-[#9D3C5E]">{[['analytics-pipeline','Pipeline'],['analytics-effectiveness','Effectiveness'],['analytics-timing','Timing'],['analytics-career','Career insights']].map(([id, name]) => <a key={id} href={`#${id}`} className={button}>{name}</a>)}</nav>
      <section id="analytics-pipeline" aria-labelledby="analytics-pipeline-title" className="scroll-mt-72 sm:scroll-mt-32 space-y-4"><div><h3 id="analytics-pipeline-title" className="text-base font-bold text-[#4A3E44]">Application pipeline</h3><p className="mt-1 text-xs text-[#736A6D]">What happened? Submitted applications and the phases they reached.</p></div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-5">{[
        ['Tracked roles', stats.total, `${stats.leads} not submitted`],
        ['Submitted', stats.submitted, `${stats.recent} in the last 30 days`],
        ['Progression', percent(stats.progressionRate), `${stats.funnel[1].count} past submission`],
        ['Offers', stats.funnel[4].count, `${percent(stats.offerRate)} of submitted applications`],
        ['Rejections', stats.rejections, `${percent(stats.rejectionRate)} of submitted applications`],
      ].map(([label, value, detail]) => <div key={label} className={card}><p className="text-xs font-semibold text-[#736A6D]">{label}</p><p className="my-2 text-3xl font-bold text-[#9D3C5E]">{value}</p><p className="text-[11px] text-[#736A6D]">{detail}</p></div>)}</div>
      <p className="text-[11px] text-[#736A6D]">Rates use {stats.submitted} submitted applications. Offer-stage progress includes declined offers and is separate from {stats.salaryOffers.count} recorded salary offers.</p>
      <AnalyticsCharts stats={stats} onReview={review} section="pipeline" /></section>
      <section id="analytics-effectiveness" aria-labelledby="analytics-effectiveness-title" className="scroll-mt-72 sm:scroll-mt-32 space-y-4"><div><h3 id="analytics-effectiveness-title" className="text-base font-bold text-[#4A3E44]">Application effectiveness</h3><p className="mt-1 text-xs text-[#736A6D]">What works? Compare submitted samples without treating limited data as predictions.</p></div>
      <AnalyticsComparisons stats={stats} report={report} onReview={review} />
      <details className={`${card} text-xs`}><summary className="cursor-pointer font-semibold">More fit conversion charts</summary><div className="mt-4"><AnalyticsCharts stats={stats} onReview={review} section="fit" /></div></details>
      <div>
        <section className={card}><h3 className="text-sm font-bold">Fit coverage</h3><p className="mt-1 text-xs text-[#736A6D]">{stats.assessed} assessed · {stats.unassessed} unassessed · {percent(stats.coverage)} coverage</p>
          <div className="mt-4 flex h-5 overflow-hidden rounded-lg bg-[#FAF7F9]">{stats.fits.map((fit, index) => fit.total > 0 && <button type="button" key={fit.value} style={{ width: `${fit.total / stats.total * 100}%`, backgroundColor: ['#A6DCC7', '#F4D6A4', '#F6B4C4', '#C8BCE8'][index] }} title={`${fit.label}: ${fit.total}`} aria-label={`Review ${fit.total} ${fit.label} roles`} onClick={() => review({ kind: 'fit', value: fit.value, label: fit.label })} />)}</div>
          <details className="mt-3 text-xs"><summary className="cursor-pointer text-[#9D3C5E]">Role fit and conversion details</summary><div className="mt-3 overflow-x-auto"><table className="w-full text-left"><thead><tr>{['Role fit', 'Tracked', 'Submitted', 'Progressed', 'Offers', 'Rejections'].map(label => <th key={label} className="p-2">{label}</th>)}</tr></thead><tbody>{stats.fits.map(fit => <tr key={fit.value} className="border-t border-[#F1DDE9]"><td className="p-2 whitespace-nowrap">{fit.label}</td><td className="p-2">{fit.total}</td><td className="p-2">{fit.submitted}</td><td className="p-2">{fit.progressed} ({percent(fit.progressionRate)})</td><td className="p-2">{fit.offers} ({percent(fit.offerRate)})</td><td className="p-2">{fit.rejections} ({percent(fit.rejectionRate)})</td></tr>)}</tbody></table></div></details>
        </section>
      </div>
      </section>
      <section id="analytics-timing" aria-labelledby="analytics-timing-title" className="scroll-mt-72 sm:scroll-mt-32 space-y-4"><div><h3 id="analytics-timing-title" className="text-base font-bold text-[#4A3E44]">Application timing</h3><p className="mt-1 text-xs text-[#736A6D]">How long does it take? Unanswered waiting time and recorded callback latency stay separate.</p></div><AnalyticsAging stats={stats} report={report} onReview={review} /></section>
      <section id="analytics-career" aria-labelledby="analytics-career-title" className="scroll-mt-72 sm:scroll-mt-32 space-y-4"><div><h3 id="analytics-career-title" className="text-base font-bold text-[#4A3E44]">Career insights</h3><p className="mt-1 text-xs text-[#736A6D]">What should I do next? Saved preference alignment, comparable salaries and evidence-based suggestions.</p></div><AnalyticsCareer stats={stats} report={report} onReview={review} /><SalaryOffersChart stats={stats} preferences={preferences} onReview={review} /><SalaryExpectationsChart stats={stats} onReview={review} /><details className={`${card} text-xs`}><summary className="cursor-pointer font-semibold">Current application outcomes</summary><div className="mt-4"><AnalyticsCharts stats={stats} onReview={review} section="outcomes" /></div></details></section>
      <details className={`${card} text-xs`}><summary className="cursor-pointer font-semibold">Data checks & counting rules <span className="ml-2 font-normal text-[#736A6D]">{stats.quality.uncertainPhases} phases to review · {stats.quality.missingDates} missing dates</span></summary>
        <div className="mt-3 space-y-2 text-[#736A6D]"><p>Rates use submitted applications in the selected scope. Offers include declined offers. Rejections use the current statuses selected in My preferences.</p><p>Earlier phases inferred from a later outcome are lavender, not recorded interview evidence. Each application ID counts once; the newest duplicate is used.</p><p>{stats.quality.duplicateRecords} duplicate records removed · {stats.quality.invalidDates} invalid dates · {stats.quality.futureDates} future dates excluded from activity. Missing dates stay in total counts.</p><p>Fit groups can overlap with recorded outcomes and are not randomized. Limited application data and unassessed roles limit comparisons; these rates cannot prove which resume or fit category caused an outcome.</p><p>Assess relevant roles inside their application using Reanalyze role fit. Review past jobs before rating them against your current resume.</p></div>
      </details>
      <section id="analytics-role-review" className={`${card} scroll-mt-24`}><div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-sm font-bold">Review your role fits {selection && <span className="ml-2 text-xs font-normal text-[#9D3C5E]">{selection.label}</span>}</h3><div className="flex items-center gap-2"><input aria-label="Search analytics roles" placeholder="Search role or company" value={reviewQuery} onChange={event => { setReviewQuery(event.target.value); setReviewPage(0); }} className="rounded-lg border border-[#F1DDE9] px-2 py-1.5 text-xs" />{selection && <button className={button} onClick={() => { setSelection(null); setReviewPage(0); }}>Show all</button>}</div></div>
        <p className="mt-2 text-[11px] text-[#736A6D]">{reviewApps.length} roles in this review</p>
        <div className="mt-3 space-y-2">{reviewApps.slice(safePage * 10, (safePage + 1) * 10).map(app => {
          const offer = recordedSalaryOffer(app);
          const expected = recordedExpectedSalary(app);
          const age = selection?.kind === 'age' ? applicationAgeDays(app, applicationDay, stats.asOf) : null;
          return <div key={app.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#FAF7F9] p-3 text-xs"><div><strong>{app.role_title}</strong><p className="text-[#736A6D]">{app.company_name} · {app.notion_status || app.status}</p>{selection?.kind === 'age' && <p className="mt-1 text-[#736A6D]">Age since submission: {age === null ? 'Unknown' : `${age} days`}</p>}{offer && <p className="mt-1 font-medium text-[#9D3C5E]">{formatSalaryRange(offer.amount, undefined, offer.currency)} / {offerPeriodLabel(offer.period).toLowerCase()}</p>}{expected && <p className="mt-1 text-[#736A6D]">Expected: {formatSalaryRange(expected.amount, undefined, expected.currency)} / {offerPeriodLabel(expected.period).toLowerCase()}</p>}</div><div className="flex items-center gap-2"><RoleFitBadge app={app} />{onEditApp && <button onClick={() => onEditApp(app)} className={button}>{selection?.kind === 'offer' ? 'Review offer' : selection?.kind === 'expected' ? 'Review salary' : selection?.kind === 'age' ? 'Review dates' : 'Review fit'}</button>}</div></div>;
        })}{!reviewApps.length && <p className="text-xs text-[#736A6D]">No roles match this review.</p>}</div>
        {pageCount > 1 && <div className="mt-3 flex items-center justify-end gap-3 text-xs"><button disabled={!safePage} className={button} onClick={() => setReviewPage(safePage - 1)}>Previous</button><span>{safePage + 1} / {pageCount}</span><button disabled={safePage === pageCount - 1} className={button} onClick={() => setReviewPage(safePage + 1)}>Next</button></div>}
      </section>
    </>}
  </div>;
}
