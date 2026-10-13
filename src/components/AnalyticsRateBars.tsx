import type { ChartSelection } from './AnalyticsCharts';

type Row = { label: string; submitted: number; progressed: number; offers: number; progressionRate: number | null; offerRate: number | null };
export const analyticsCard = 'min-w-0 rounded-2xl border border-[#F1DDE9] bg-white p-5 shadow-xs';
export function RateLegend() {
  return <div className="flex flex-wrap gap-4 text-[11px] text-[#736A6D]"><span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-[#A8CCF0]" />Screening or later</span><span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-[#A6DCC7]" />Offer stage</span></div>;
}
export default function AnalyticsRateBars({ rows, kind, onReview }: { rows: Row[]; kind: 'role' | 'platform' | 'seniority' | 'type'; onReview: (value: ChartSelection) => void }) {
  return <div className="space-y-4">{rows.map(row => <button type="button" key={row.label} aria-label={`Review ${row.label} applications`} onClick={() => onReview({ kind, value: row.label, label: row.label })} className="block w-full rounded-lg text-left focus-visible:outline-2 focus-visible:outline-[#9D3C5E]">
    <span className="mb-2 flex flex-wrap items-baseline justify-between gap-2 text-xs"><strong className="break-words">{row.label.replaceAll('_', ' ')}</strong><span className="text-[#736A6D]">n = {row.submitted}{row.submitted < 5 ? ' · Small sample' : ''}</span></span>
    {([{ count: row.progressed, rate: row.progressionRate, color: '#A8CCF0', title: 'Screening or later' }, { count: row.offers, rate: row.offerRate, color: '#A6DCC7', title: 'Offer stage' }]).map(metric => <span key={metric.title} className="mt-1 grid grid-cols-[1fr_5.5rem] items-center gap-2 text-[11px]" title={`${metric.title}: ${metric.count} / ${row.submitted}`}>
      <span className="block h-2.5 overflow-hidden rounded-full bg-[#FAF7F9]"><span className="block h-full rounded-full" style={{ width: `${metric.rate ?? 0}%`, backgroundColor: metric.color }} /></span><span className="text-right">{metric.count}/{row.submitted} · {metric.rate === null ? 'N/A' : `${metric.rate}%`}</span>
    </span>)}
  </button>)}{!rows.length && <p className="text-sm text-[#736A6D]">No submitted applications in this scope yet.</p>}</div>;
}
