import type { PipelineStats } from '@/lib/analytics';
import type { ChartSelection } from './AnalyticsCharts';

export default function AnalyticsAging({ stats, onReview }: { stats: PipelineStats; onReview: (value: ChartSelection) => void }) {
  const timing = stats.timing;
  const percent = (value: number | null) => value === null ? 'Unknown' : `${value}%`;
  const card = 'min-w-0 rounded-2xl border border-[#F1DDE9] bg-white p-5 shadow-xs';
  return <div className="grid gap-4 lg:grid-cols-2">
    <section className={card} aria-label="Application aging">
      <h3 className="text-sm font-bold">Unanswered application aging</h3>
      <p className="mt-1 text-xs text-[#736A6D]">{timing.pending} active submitted applications without a recorded response or later hiring phase. Waiting time is not employer response time.</p>
      <div className="mt-4 space-y-3">{timing.buckets.map(bucket => <div key={bucket.min}>
        <div className="mb-1 flex justify-between gap-2 text-xs"><span>{bucket.label}</span><strong>{bucket.pending}</strong></div>
        <button type="button" aria-label={`Review unanswered applications aged ${bucket.label}`} onClick={() => onReview({ kind: 'age', value: String(bucket.min), min: bucket.min, max: bucket.max, pending: true, label: `Unanswered · ${bucket.label}` })} className="block h-5 w-full overflow-hidden rounded-lg bg-[#FAF7F9] focus-visible:outline-2 focus-visible:outline-[#9D3C5E]">
          <span className="block h-full rounded-lg bg-[#A8CCF0]" style={{ width: `${timing.pending ? bucket.pending / timing.pending * 100 : 0}%` }} />
        </button>
      </div>)}</div>
      <button type="button" onClick={() => onReview({ kind: 'age', value: 'unknown', min: null, max: null, pending: true, label: 'Unanswered · unknown age' })} className="mt-3 text-xs font-semibold text-[#9D3C5E]">Unknown age: {timing.pendingUnknownAges}</button>
      <p className="mt-2 text-[11px] text-[#736A6D]">Age ranges are configurable in My preferences and are not hiring benchmarks. The last range starts at {timing.boundaries[2] + 1} days to avoid overlap.</p>
      <details className="mt-4 text-xs"><summary className="cursor-pointer font-semibold">Age of all submitted applications</summary>
        <div className="mt-2 space-y-2">{timing.buckets.map(bucket => <button type="button" key={bucket.min} onClick={() => onReview({ kind: 'age', value: String(bucket.min), min: bucket.min, max: bucket.max, pending: false, label: `Submitted · ${bucket.label}` })} className="flex w-full justify-between gap-2 rounded-lg bg-[#FAF7F9] p-2"><span>{bucket.label}</span><strong>{bucket.all}</strong></button>)}</div>
        <p className="mt-2 text-[#736A6D]">Includes closed and responded applications; it measures maturity, not waiting. {timing.unknownAges} unknown ages: {timing.missingSubmissionDates} missing, {timing.invalidSubmissionDates} invalid, {timing.futureSubmissionDates} future submission dates.</p>
      </details>
    </section>
    <section className={card} aria-label="Employer response timing">
      <h3 className="text-sm font-bold">Employer response timing</h3>
      <p className="mt-1 text-xs text-[#736A6D]">{timing.callbacks.count} applications have usable submission and first employer response dates. Median: {timing.callbacks.medianDays ?? 'Unknown'} days · Average: {timing.callbacks.averageDays ?? 'Unknown'} days.</p>
      <div className="mt-4 overflow-x-auto"><table className="w-full text-left text-xs"><thead><tr>{['Within', 'Responses / eligible', 'Recorded rate', 'Too recent', 'Timing unknown'].map(label => <th key={label} className="p-2">{label}</th>)}</tr></thead><tbody>{timing.windows.map(window => <tr key={window.days} className="border-t border-[#F1DDE9]"><td className="p-2">{window.days} days</td><td className="p-2">{window.responded} / {window.eligible}</td><td className="p-2">{percent(window.responseRate)}</td><td className="p-2">{window.immature}</td><td className="p-2">{window.unknownTiming}</td></tr>)}</tbody></table></div>
      <p className="mt-3 text-[11px] text-[#736A6D]">Each window includes only applications old enough to complete it. Records with unknown response timing are excluded from the rate, not treated as no response. Missing submission dates are excluded. Rates depend on completeness of recorded responses.</p>
      <p className="mt-2 text-[11px] text-[#736A6D]">{timing.unknownResponseTiming} records have unknown response timing. Status-history timestamps mark saves and updates, so they are not callback dates. Time to interview is unknown until an actual first interview event date is recorded.</p>
    </section>
  </div>;
}
