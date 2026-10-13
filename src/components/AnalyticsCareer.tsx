import type { PipelineStats } from '@/lib/analytics';
import type { AnalyticsReportData } from '@/lib/analytics-report';
import type { ChartSelection } from './AnalyticsCharts';
import AnalyticsRateBars, { analyticsCard, RateLegend } from './AnalyticsRateBars';

export default function AnalyticsCareer({ stats, report, onReview }: { stats: PipelineStats; report: AnalyticsReportData; onReview: (value: ChartSelection) => void }) {
  const known = stats.preferenceAlignment.filter(row => row.label !== 'UNKNOWN').reduce((sum, row) => sum + row.count, 0);
  const colors = ['#A6DCC7', '#F4D6A4', '#F6B4C4', '#C8BCE8'];
  return <div className="space-y-4"><div className="grid gap-4 lg:grid-cols-2">
    <section className={analyticsCard} aria-label="Preference alignment"><h3 className="text-sm font-bold">Preference alignment</h3><p className="mt-1 text-xs text-[#736A6D]">Saved preference comparisons, separate from experience fit.</p>
      {known > 0 ? <div className="mt-5 flex flex-wrap items-center justify-center gap-5"><svg viewBox="0 0 160 160" className="h-40 w-40 shrink-0" role="img" aria-label={`Preference alignment for ${stats.total} tracked applications`}>
        {stats.preferenceAlignment.map((row, index) => { const circumference = Math.PI * 120, offset = stats.preferenceAlignment.slice(0, index).reduce((sum, item) => sum + item.count, 0) / stats.total * circumference; return <circle key={row.label} cx="80" cy="80" r="60" fill="none" stroke={colors[index]} strokeWidth="22" strokeDasharray={`${row.count / stats.total * circumference} ${circumference}`} strokeDashoffset={-offset} transform="rotate(-90 80 80)"><title>{row.label}: {row.count}</title></circle>; })}
        <text x="80" y="78" textAnchor="middle" fontSize="27" fontWeight="700" fill="#9D3C5E">{stats.total}</text><text x="80" y="97" textAnchor="middle" fontSize="11" fill="#736A6D">tracked roles</text>
      </svg><div className="min-w-36 flex-1 space-y-3">{stats.preferenceAlignment.map((row, index) => <div key={row.label} className="flex justify-between gap-3 text-xs"><span className="capitalize"><i className="mr-2 inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: colors[index] }} />{row.label.toLowerCase()}</span><strong>{row.count}</strong></div>)}</div></div> : <p className="mt-4 rounded-xl bg-[#FAF7F9] p-4 text-sm text-[#736A6D]">No saved preference comparisons yet. {stats.total} tracked roles remain Unknown; analytics stays available without an assessment.</p>}
    </section>
    <section className={analyticsCard} aria-label="Seniority effectiveness"><h3 className="text-sm font-bold">Seniority progression</h3><p className="mt-1 text-xs text-[#736A6D]">Explicit title levels and saved overrides; unlabeled roles stay Unspecified.</p><div className="my-4"><RateLegend /></div><AnalyticsRateBars rows={report.seniority} kind="seniority" onReview={onReview} /></section>
  </div>
  {report.types.length > 1 && <details className={`${analyticsCard} text-xs`}><summary className="cursor-pointer font-semibold">Compare application types</summary><p className="my-3 text-[#736A6D]">Historical internships and recent non-internship applications have different hiring contexts and observation time. These totals describe each group; use the scope filter to examine them separately.</p><RateLegend /><div className="mt-4"><AnalyticsRateBars rows={report.types} kind="type" onReview={onReview} /></div></details>}
  <div className="grid gap-3 md:grid-cols-3">{report.findings.map(finding => <section key={finding.title} className="min-w-0 rounded-2xl border border-[#F1DDE9] bg-[#FFF0F6] p-5"><h3 className="text-sm font-bold text-[#9D3C5E]">{finding.title}</h3><p className="mt-2 text-xs leading-relaxed text-[#736A6D]">{finding.text}</p></section>)}</div>
  </div>;
}
