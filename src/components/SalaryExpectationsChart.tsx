'use client';

import { useState } from 'react';
import { PipelineStats } from '@/lib/analytics';
import { offerPeriodLabel } from '@/lib/salary-offers';
import { formatSalaryRange } from '@/lib/currencies';
import { ChartSelection } from './AnalyticsCharts';

export default function SalaryExpectationsChart({ stats, onReview }: { stats: PipelineStats; onReview: (selection: ChartSelection) => void }) {
  const [selected, setSelected] = useState('PHP:MONTHLY');
  const groups = stats.salaryOffers.expectations;
  const group = groups.find(item => item.key === selected) || groups[0];
  const extent = Math.max(1, ...(group?.pairs.map(pair => Math.abs(pair.gap)) || [])) * 1.15;
  const position = (gap: number) => `${50 + gap / extent * 50}%`;
  const money = (amount: number) => formatSalaryRange(Math.abs(amount), undefined, group?.currency);
  return <section aria-label="Salary expectations" className="min-w-0 rounded-2xl border border-[#F1DDE9] bg-white p-5 shadow-xs">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h3 className="text-sm font-bold">Expected salary vs. offers</h3>
      {groups.length > 1 && <select aria-label="Expected salary comparison group" value={group.key} onChange={event => setSelected(event.target.value)} className="rounded-lg border border-[#F1DDE9] bg-white px-2 py-1 text-xs">{groups.map(item => <option key={item.key} value={item.key}>{item.currency} · {offerPeriodLabel(item.period)}</option>)}</select>}
    </div>
    {!group ? <p className="mt-3 text-sm text-[#736A6D]">Add an expected salary in Job offer to start tracking your expectations.</p> : <>
      <p className="mt-1 text-xs text-[#736A6D]">{group.currency} · {offerPeriodLabel(group.period)} base pay · {group.count} recorded expectations</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">{[
        ['Median expected salary', money(group.median)],
        ['Offers meeting expectations', group.matched ? `${group.met} of ${group.matched}` : 'No matching offers yet'],
        ['Median offer gap', group.medianGap == null ? 'Awaiting offers' : `${group.medianGap > 0 ? '+' : group.medianGap < 0 ? '−' : ''}${money(group.medianGap)}`],
      ].map(([label, value]) => <div key={label} className="rounded-xl bg-[#FFF5F8] p-3"><p className="text-[11px] text-[#736A6D]">{label}</p><strong className="mt-1 block text-sm text-[#9D3C5E]">{value}</strong></div>)}</div>
      {group.matched > 0 && <div className="mt-5" role="img" aria-label={`Offer minus expected salary in ${group.currency} per ${offerPeriodLabel(group.period).toLowerCase()}; ${group.matched} matching offers`}>
        <div className="relative mx-6 h-28 border-b border-[#EAE4E9]">
          <span className="absolute top-0 left-1/2 -translate-x-1/2 whitespace-nowrap text-[11px] text-[#9D3C5E]">Matches expectation</span>
          <span className="absolute top-6 bottom-0 left-1/2 border-l border-dashed border-[#9D3C5E]" />
          {group.pairs.map((pair, index) => <span key={pair.id} data-testid="salary-gap-point" className={`absolute h-3 w-3 -translate-x-1/2 rounded-full border border-[#9D3C5E] ${pair.gap < 0 ? 'bg-[#F6B4C4]' : 'bg-[#A6DCC7]'}`} style={{ left: position(pair.gap), top: 36 + index % 5 * 12 }} title={`${pair.company}: expected ${money(pair.expected)}, offered ${money(pair.offered)}`} />)}
        </div>
        <div className="mx-6 mt-2 flex justify-between text-[10px] text-[#736A6D]"><span>Below expectation</span><span>Above expectation</span></div>
        <div className="mx-6 mt-1 flex justify-between text-[10px] text-[#736A6D]"><span>−{money(extent)}</span><span>0</span><span>+{money(extent)}</span></div>
      </div>}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-[11px] text-[#736A6D]">Gap = offer − expected salary for the same application. Only matching currency and pay period count.</p>
        <button type="button" onClick={() => onReview({ kind: 'expected', value: group.key, label: `${group.currency} ${offerPeriodLabel(group.period)} expectations` })} className="rounded-xl border border-[#F1DDE9] bg-[#FFF0F6] px-3 py-2 text-xs font-semibold text-[#9D3C5E]">Review expected salaries</button>
      </div>
    </>}
  </section>;
}
