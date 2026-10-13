import type { PipelineStats } from '@/lib/analytics';
import type { ChartSelection } from './AnalyticsCharts';
import type { AnalyticsReportData } from '@/lib/analytics-report';

export default function AnalyticsAging({ stats, report, onReview }: { stats: PipelineStats; report: AnalyticsReportData; onReview: (value: ChartSelection) => void }) {
  const timing = stats.timing;
  const percent = (value: number | null) => value === null ? 'N/A' : `${value}%`;
  const card = 'min-w-0 rounded-2xl border border-[#F1DDE9] bg-white p-5 shadow-xs';
  return <div className="space-y-4"><div className="grid gap-4 lg:grid-cols-2">
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
      {report.responseCount ? <>
        <p className="mt-1 text-xs text-[#736A6D]">{report.responseCount} applications have usable submission and first employer response dates.</p>
        <div className="mt-4 grid grid-cols-2 gap-3">{[['Median callback', timing.callbacks.medianDays], ['Average callback', timing.callbacks.averageDays]].map(([label, value]) => <div key={label} className="rounded-xl bg-[#FFF0F6] p-3"><p className="text-[11px] text-[#736A6D]">{label}</p><strong className="mt-1 block text-lg text-[#9D3C5E]">{value} days</strong></div>)}</div>
        {report.responseCount > 1 && <div className="mt-5" role="img" aria-label={`Callback distribution for ${report.responseCount} recorded responses`}><div className="grid h-36 grid-cols-4 items-end gap-3 border-b border-[#EAE4E9]">{report.callbackBins.map(bin => <div key={bin.label} className="flex h-full flex-col justify-end text-center"><span className="mb-1 text-xs font-semibold">{bin.count}</span><span className="mx-auto block w-3/4 rounded-t-md bg-[#E99ABA]" style={{ height: `${bin.count / Math.max(1, ...report.callbackBins.map(item => item.count)) * 100}px` }} /></div>)}</div><div className="mt-2 grid grid-cols-4 gap-3 text-center text-[10px] text-[#736A6D]">{report.callbackBins.map(bin => <span key={bin.label}>{bin.label}</span>)}</div></div>}
      </> : <p className="mt-3 rounded-xl bg-[#FAF7F9] p-4 text-sm text-[#736A6D]">No usable response dates yet. Record actual first employer responses to unlock callback and cohort charts. Waiting ages never count as callback times.</p>}
      <div className="mt-5 grid grid-cols-3 gap-2">{timing.windows.map(window => <div key={window.days} className="rounded-xl bg-[#FFF0F6] p-3"><p className="text-[10px] text-[#736A6D]">Within {window.days} days</p><strong className="mt-1 block text-lg text-[#9D3C5E]">{percent(window.responseRate)}</strong><p className="mt-1 text-[10px] text-[#736A6D]">{window.responded}/{window.eligible} eligible</p></div>)}</div>
      <details className="mt-4 text-xs"><summary className="cursor-pointer font-semibold">Response window exclusions</summary><div className="mt-2 overflow-x-auto"><table className="w-full text-left text-xs"><thead><tr>{['Within', 'Responses / eligible', 'Recorded rate', 'Too recent', 'Timing unknown'].map(label => <th key={label} className="p-2">{label}</th>)}</tr></thead><tbody>{timing.windows.map(window => <tr key={window.days} className="border-t border-[#F1DDE9]"><td className="p-2">{window.days} days</td><td className="p-2">{window.responded} / {window.eligible}</td><td className="p-2">{percent(window.responseRate)}</td><td className="p-2">{window.immature}</td><td className="p-2">{window.unknownTiming}</td></tr>)}</tbody></table></div></details>
      <p className="mt-3 text-[11px] text-[#736A6D]">Each window includes only applications old enough to complete it. Records with unknown response timing are excluded from the rate, not treated as no response. Missing submission dates are excluded. Rates depend on completeness of recorded responses.</p>
      <p className="mt-2 text-[11px] text-[#736A6D]">{timing.unknownResponseTiming} records have unknown response timing. Status-history timestamps mark saves and updates, so they are not callback dates. Time to interview is unknown until an actual first interview event date is recorded.</p>
    </section>
  </div><section className={card} aria-label={report.heatmapReady ? 'Response cohort heatmap' : 'Response window coverage'}>
    <h3 className="text-sm font-bold">{report.heatmapReady ? 'Response cohorts' : 'Response window coverage'}</h3>
    {report.heatmapReady ? <><p className="mt-1 text-xs text-[#736A6D]">Latest 5 responding submission months. Each cell counts recorded responses, not a conversion rate.</p><div className="mt-4 overflow-x-auto"><table className="w-full text-center text-xs"><thead><tr><th className="p-2 text-left">Submission month</th>{report.callbackBins.map(bin => <th key={bin.label} className="p-2 whitespace-nowrap">{bin.label}</th>)}</tr></thead><tbody>{report.responseCohorts.filter(row => row.responses).slice(-5).map(row => <tr key={row.month}><th className="p-2 text-left font-medium">{row.month}<span className="block text-[10px] text-[#736A6D]">{row.responses} recorded responses</span></th>{row.counts.map((value, i) => <td key={i} className="border-2 border-white p-3" style={{ backgroundColor: `rgba(233,154,186,${.08 + .75 * value / Math.max(1, ...report.responseCohorts.flatMap(cohort => cohort.counts))})` }}>{value}</td>)}</tr>)}</tbody></table></div></> : <>
      <p className="mt-1 text-xs text-[#736A6D]">Why some records cannot contribute to a response rate. Counts exclude missing, invalid and future submission dates.</p>
      <div className="mt-4 flex flex-wrap gap-4 text-[11px] text-[#736A6D]">{[['Eligible','#A8CCF0'],['Too recent','#E99ABA'],['Timing unknown','#C8BCE8']].map(([label,color]) => <span key={label}><i className="mr-1 inline-block h-2 w-2 rounded-full" style={{ backgroundColor: color }} />{label}</span>)}</div>
      <div className="mt-4 space-y-3">{timing.windows.map(window => {
        const total = window.eligible + window.immature + window.unknownTiming;
        return <div key={window.days}><div className="mb-1 flex justify-between text-xs"><span>{window.days} days</span><span>{total} dated applications</span></div><div className="flex h-6 overflow-hidden rounded-lg bg-[#FAF7F9]">{[{count:window.eligible,color:'#A8CCF0',label:'Eligible'},{count:window.immature,color:'#E99ABA',label:'Too recent'},{count:window.unknownTiming,color:'#C8BCE8',label:'Timing unknown'}].filter(item => item.count > 0).map(item => <span key={item.label} className="flex items-center justify-center text-[10px]" title={`${item.label}: ${item.count}`} style={{ width: `${total ? item.count / total * 100 : 0}%`, backgroundColor: item.color }}>{item.count / total >= .1 ? item.count : ''}</span>)}</div></div>;
      })}</div>
      <p className="mt-3 text-[11px] text-[#736A6D]">A cohort heatmap becomes available with 5 usable responses across 2 submission months. Newer applications have had less time to respond.</p>
    </>}
  </section></div>;
}
