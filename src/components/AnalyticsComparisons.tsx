import type { PipelineStats } from '@/lib/analytics';

export default function AnalyticsComparisons({ stats }: { stats: PipelineStats }) {
  const percent = (value: number | null) => value === null ? '—' : `${value}%`;
  const sections = [
    ['Role family conversion', stats.dimensions.roles], ['Seniority progression', stats.dimensions.seniority],
    ['Job platform performance', stats.dimensions.platforms], ['Monthly response cohorts', stats.dimensions.cohorts],
    ['Saved qualifications fit', stats.dimensions.qualifications],
  ] as const;
  return <details className="min-w-0 rounded-2xl border border-[#F1DDE9] bg-white p-5 text-xs shadow-xs">
    <summary className="cursor-pointer font-semibold">Application effectiveness comparisons</summary>
    <p className="mt-3 text-[#736A6D]">Rates use submitted applications in each group. Callback days require a saved first employer response timestamp; status update dates are excluded. {stats.dimensions.missingResponseDates} submitted records lack usable timing. Cohorts group by submission month and include recorded responses through {stats.asOf}; newer cohorts have had less time to respond.</p>
    <p className="mt-2 text-[#736A6D]">Qualifications fit reuses saved role-fit results as a proxy for experience alignment. Seniority and role family use saved overrides or title rules; titles without explicit seniority stay Unspecified. These comparisons describe outcomes, not causes or predicted chances.</p>
    {sections.map(([title, rows]) => <section key={title} className="mt-4"><h3 className="font-bold">{title}</h3><div className="max-h-80 overflow-auto"><table className="mt-2 w-full text-left"><thead><tr>{['Group', 'Tracked', 'Submitted', 'Progression', 'Offers', 'Recorded response', 'Median callback days'].map(label => <th className="p-2 whitespace-nowrap" key={label}>{label}</th>)}</tr></thead><tbody>{rows.map(row => <tr key={row.label} className="border-t border-[#F1DDE9]"><td className="p-2">{row.label.replaceAll('_', ' ')}</td><td className="p-2">{row.total}</td><td className="p-2">{row.submitted}</td><td className="p-2">{row.progressed} ({percent(row.progressionRate)})</td><td className="p-2">{row.offers} ({percent(row.offerRate)})</td><td className="p-2">{row.responses} ({percent(row.responseRate)})</td><td className="p-2">{row.medianCallbackDays ?? 'Unknown'}</td></tr>)}</tbody></table>{!rows.length && <p className="py-2 text-[#736A6D]">No records in this scope.</p>}</div></section>)}
  </details>;
}
