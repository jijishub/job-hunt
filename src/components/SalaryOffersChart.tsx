'use client';

import { useState } from 'react';
import { PipelineStats } from '@/lib/analytics';
import { offerPeriodLabel, salaryOfferScale } from '@/lib/salary-offers';
import { formatSalaryRange } from '@/lib/currencies';
import { PersonalPreferences } from '@/lib/preferences';
import { ChartSelection } from './AnalyticsCharts';

export default function SalaryOffersChart({ stats, preferences, onReview }: { stats: PipelineStats; preferences?: PersonalPreferences; onReview: (selection: ChartSelection) => void }) {
  const [selected, setSelected] = useState('PHP:MONTHLY');
  const groups = stats.salaryOffers.groups;
  const group = groups.find(item => item.key === selected) || groups[0];
  const scale = group ? salaryOfferScale(group) : { min: 0, max: 1 };
  const position = (amount: number) => `${(amount - scale.min) / (scale.max - scale.min) * 100}%`;
  return <section className="min-w-0 rounded-2xl border border-[#F1DDE9] bg-white p-5 shadow-xs" aria-label="Recorded salary offers">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h3 className="text-sm font-bold">Recorded salary offers</h3>
      {groups.length > 1 && <select aria-label="Offer comparison group" value={group.key} onChange={event => setSelected(event.target.value)} className="rounded-lg border border-[#F1DDE9] bg-white px-2 py-1 text-xs">{groups.map(item => <option key={item.key} value={item.key}>{item.currency} · {offerPeriodLabel(item.period)}</option>)}</select>}
    </div>
    {!group ? <p className="mt-3 text-sm text-[#736A6D]">No salary offers recorded yet. Add an actual offer in an application to start comparing.</p> : <>
      <p className="mt-1 text-xs text-[#736A6D]">{group.currency} · {offerPeriodLabel(group.period)} base pay · {group.count} recorded {group.count === 1 ? 'offer' : 'offers'}</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">{[
        ['Median offer', formatSalaryRange(group.median, undefined, group.currency)],
        ['Offer range', formatSalaryRange(group.min, group.max, group.currency)],
      ].map(([title, value]) => <div key={title} className="rounded-xl bg-[#FFF5F8] p-3"><p className="text-[11px] text-[#736A6D]">{title}</p><strong className="mt-1 block text-sm text-[#9D3C5E]">{value}</strong></div>)}</div>
      <div className="mt-5" role="img" aria-label={`${group.currency} ${offerPeriodLabel(group.period)} offer distribution; median ${group.median}; ${group.count} offers`}>
        <div className="relative mx-8 h-32 border-b border-[#EAE4E9]">
          <span className="absolute top-0 -translate-x-1/2 text-[11px] text-[#9D3C5E]" style={{ left: position(group.median) }}>Median</span>
          <span className="absolute top-6 bottom-0 border-l border-dashed border-[#9D3C5E]" style={{ left: position(group.median) }} />
          {group.points.map((point, index) => <span key={point.id} data-testid="salary-offer-point" className="absolute h-3 w-3 -translate-x-1/2 rounded-full border border-[#9D3C5E] bg-[#E99ABA]/75" style={{ left: position(point.amount), top: 40 + index % 5 * 12 }} title={`${point.company} · ${point.role}: ${formatSalaryRange(point.amount, undefined, group.currency)}`} />)}
        </div>
        <div className="relative mx-8 h-8">{[0, 0.25, 0.5, 0.75, 1].map(fraction => <span key={fraction} style={{ left: `${fraction * 100}%` }} className={`absolute top-2 -translate-x-1/2 whitespace-nowrap text-[10px] text-[#736A6D] ${fraction === 0.25 || fraction === 0.75 ? 'hidden sm:block' : ''}`}>{(scale.min + fraction * (scale.max - scale.min)).toLocaleString('en-US', { maximumFractionDigits: 2 })}</span>)}</div>
        <p className="text-center text-xs text-[#736A6D]">{group.currency} / {offerPeriodLabel(group.period).toLowerCase()}</p>
      </div>
      {group.period === 'MONTHLY' && group.currency === preferences?.salary_currency && preferences.salary_min != null && <p className="text-xs text-[#736A6D]">Your monthly minimum: {formatSalaryRange(preferences.salary_min, undefined, group.currency)} · {group.points.filter(point => point.amount >= preferences.salary_min!).length} of {group.count} offers meet it.</p>}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3"><p className="text-[11px] text-[#736A6D]">Each dot is an offer. These are your recorded offers, not an estimate of market pay.</p><button type="button" onClick={() => onReview({ kind: 'offer', value: group.key, label: `${group.currency} ${offerPeriodLabel(group.period)} offers` })} className="rounded-xl border border-[#F1DDE9] bg-[#FFF0F6] px-3 py-2 text-xs font-semibold text-[#9D3C5E]">Review recorded offers</button></div>
    </>}
  </section>;
}
