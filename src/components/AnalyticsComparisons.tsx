import type { PipelineStats } from '@/lib/analytics';
import type { AnalyticsReportData } from '@/lib/analytics-report';
import AnalyticsRateBars, { analyticsCard, RateLegend } from './AnalyticsRateBars';
import type { ChartSelection } from './AnalyticsCharts';

export default function AnalyticsComparisons({ stats, report, onReview }: { stats: PipelineStats; report: AnalyticsReportData; onReview: (value: ChartSelection) => void }) {
  const percent = (value: number | null) => value === null ? '—' : `${value}%`;
  const sections = [
    ['Role family conversion', stats.dimensions.roles], ['Seniority progression', stats.dimensions.seniority],
    ['Job platform performance', stats.dimensions.platforms], ['Monthly response cohorts', stats.dimensions.cohorts],
    ['Saved qualifications fit', stats.dimensions.qualifications],
  ] as const;
  const topRoles = report.roles.slice(0, 6), maximum = Math.max(1, ...topRoles.map(row => row.submitted));
  return <div className="space-y-4">
    <section className={analyticsCard} aria-label="Role family effectiveness">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h3 className="text-sm font-bold">Role families: volume and conversion</h3><RateLegend /></div>
      <p className="mb-4 text-xs text-[#736A6D]">Top {topRoles.length} of {report.roles.length} families by submissions. Related automatic titles are grouped; your manual families stay intact.</p>
      <div className="grid gap-6 lg:grid-cols-2"><div className="space-y-4"><h4 className="text-xs font-semibold text-[#736A6D]">Submitted applications</h4>{topRoles.map(row => <button type="button" key={row.label} onClick={() => onReview({ kind: 'role', value: row.label, label: row.label })} className="block w-full text-left"><span className="mb-2 flex justify-between gap-3 text-xs"><strong className="break-words">{row.label}</strong><span>{row.submitted}</span></span><span className="block h-4 overflow-hidden rounded-lg bg-[#FAF7F9]"><span className="block h-full rounded-lg bg-[#E99ABA]" style={{ width: `${row.submitted / maximum * 100}%` }} /></span></button>)}{!topRoles.length && <p className="text-sm text-[#736A6D]">Submit an application to start comparing roles.</p>}</div><div><h4 className="mb-4 text-xs font-semibold text-[#736A6D]">Share of each family’s submitted applications</h4><AnalyticsRateBars rows={topRoles} kind="role" onReview={onReview} /></div></div>
    </section>
    <div className="grid gap-4 lg:grid-cols-2">
      <section className={analyticsCard} aria-label="Role fit outcomes"><h3 className="text-sm font-bold">Role fit and outcomes</h3><p className="mt-1 text-xs text-[#736A6D]">Current outcomes within each submitted fit group; every application appears once.</p>
        <div className="mt-5 space-y-4">{report.fits.map(fit => <button type="button" key={fit.value} onClick={() => onReview({ kind: 'fit', value: fit.value, label: fit.label, submittedOnly: true })} className="block w-full text-left" aria-label={`Review ${fit.label} submitted outcomes`}><span className="mb-2 flex justify-between gap-2 text-xs"><strong>{fit.label}</strong><span className="text-[#736A6D]">{fit.submitted} {fit.submitted === 1 ? 'application' : 'applications'}{fit.submitted < 5 ? ' · Based on limited application data' : ''}</span></span><span className="flex h-6 overflow-hidden rounded-lg bg-[#FAF7F9]">{fit.outcomes.filter(outcome => outcome.count > 0).map(outcome => <span key={outcome.key} className="flex items-center justify-center text-[10px]" style={{ width: `${outcome.count / fit.submitted * 100}%`, backgroundColor: outcome.color }} title={`${outcome.label}: ${outcome.count} / ${fit.submitted}`}>{outcome.count / fit.submitted >= .12 ? outcome.count : ''}</span>)}</span></button>)}</div>
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-[11px] text-[#736A6D]">{report.fits[0]?.outcomes.map(outcome => <span key={outcome.key}><i className="mr-1 inline-block h-2 w-2 rounded-full" style={{ backgroundColor: outcome.color }} />{outcome.label}</span>)}</div>
        {!report.fits.length && <p className="mt-4 text-sm text-[#736A6D]">No submitted fit samples yet. Unassessed applications remain included.</p>}
      </section>
      <section className={analyticsCard} aria-label="Platform effectiveness"><h3 className="text-sm font-bold">Platform effectiveness</h3><p className="mt-1 text-xs text-[#736A6D]">Top {Math.min(6, report.platforms.length)} of {report.platforms.length} platforms by submissions. This describes saved outcomes, not which platform caused them.</p><div className="my-4"><RateLegend /></div><AnalyticsRateBars rows={report.platforms.slice(0, 6)} kind="platform" onReview={onReview} /></section>
    </div>
    <details className={`${analyticsCard} text-xs`}>
    <summary className="cursor-pointer font-semibold">Application effectiveness comparisons</summary>
    <p className="mt-3 text-[#736A6D]">Rates use submitted applications in each group. Callback days require a saved first employer response timestamp; status update dates are excluded. {stats.dimensions.missingResponseDates} submitted records lack usable timing. Cohorts group by submission month and include recorded responses through {stats.asOf}; newer cohorts have had less time to respond.</p>
    <p className="mt-2 text-[#736A6D]">Qualifications fit reuses saved role-fit results as a proxy for experience alignment. Seniority and role family use saved overrides or title rules; titles without explicit seniority stay Unspecified. These comparisons describe outcomes, not causes or predicted chances.</p>
    {sections.map(([title, rows]) => <section key={title} className="mt-4"><h3 className="font-bold">{title}</h3><div className="max-h-80 overflow-auto"><table className="mt-2 w-full text-left"><thead><tr>{['Group', 'Tracked', 'Submitted', 'Progression', 'Offers', 'Recorded response', 'Median callback days'].map(label => <th className="p-2 whitespace-nowrap" key={label}>{label}</th>)}</tr></thead><tbody>{rows.map(row => <tr key={row.label} className="border-t border-[#F1DDE9]"><td className="p-2">{row.label.replaceAll('_', ' ')}</td><td className="p-2">{row.total}</td><td className="p-2">{row.submitted}</td><td className="p-2">{row.progressed} ({percent(row.progressionRate)})</td><td className="p-2">{row.offers} ({percent(row.offerRate)})</td><td className="p-2">{row.responses} ({percent(row.responseRate)})</td><td className="p-2">{row.medianCallbackDays ?? 'Unknown'}</td></tr>)}</tbody></table>{!rows.length && <p className="py-2 text-[#736A6D]">No records in this scope.</p>}</div></section>)}
  </details></div>;
}
