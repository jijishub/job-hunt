'use client';

import { useState } from 'react';
import { PipelineStats } from '@/lib/analytics';
import { AnalyticsStage } from '@/lib/analytics-stages';

export type ChartSelection = { kind: 'fit' | 'outcome' | 'month'; value: string; label: string }
  | { kind: 'phase'; value: AnalyticsStage; label: string; evidence?: 'recorded' | 'inferred' };
const card = 'min-w-0 rounded-2xl border border-[#F1DDE9] bg-white p-5 shadow-xs';
const fitColors = ['#A6DCC7', '#F4D6A4', '#F6B4C4', '#C8BCE8'];
export default function AnalyticsCharts({ stats, onReview }: { stats: PipelineStats; onReview: (selection: ChartSelection) => void }) {
  const [metric, setMetric] = useState<'progressionRate' | 'offerRate' | 'rejectionRate'>('offerRate');
  const metricLabel = metric === 'offerRate' ? 'Offers' : metric === 'rejectionRate' ? 'Rejections' : 'Past submission';
  if (!stats.total) return <section className={card}><h3 className="font-semibold">Your charts start here</h3><p className="mt-2 text-sm text-[#736A6D]">Add an application to see your progress. Unassessed roles can stay unassessed.</p></section>;
  return <div className="grid gap-4 lg:grid-cols-2">
    <section className={card} aria-label="Pipeline progression chart">
      <h3 className="text-sm font-bold">Reached or passed</h3>
      <p className="mt-1 mb-4 text-xs text-[#736A6D]">Earlier phases may be inferred. Click a segment to review its roles.</p>
      <div className="mb-4 flex gap-4 text-[11px] text-[#736A6D]"><span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-[#FF7AB3]" />Recorded phase</span><span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-[#C8BCE8]" />Inferred from a later phase</span></div>
      <div className="space-y-4">{stats.funnel.map(phase => <div key={phase.phase}>
        <div className="mb-1 flex justify-between gap-2 text-xs"><span>{phase.label}</span><span className="font-semibold">{phase.count} / {stats.submitted}</span></div>
        <div className="flex h-5 overflow-hidden rounded-lg bg-[#FAF7F9]">
          {(['recorded', 'inferred'] as const).map(evidence => phase[evidence] > 0 && <button key={evidence} type="button"
            style={{ width: `${phase[evidence] / Math.max(1, stats.submitted) * 100}%`, backgroundColor: evidence === 'recorded' ? '#FF7AB3' : '#C8BCE8' }}
            aria-label={`Review ${phase[evidence]} ${evidence} ${phase.label} roles`}
            title={`${phase[evidence]} ${evidence}; ${phase.count} reached or passed out of ${stats.submitted} submitted`}
            onClick={() => onReview({ kind: 'phase', value: phase.phase, evidence, label: `${phase.label} · ${evidence}` })}
            className="min-w-1 transition hover:brightness-95 focus-visible:outline-2 focus-visible:outline-[#9D3C5E]" />)}
        </div>
      </div>)}</div>
    </section>
    <section className={card} aria-label="Fit conversion chart">
      <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-sm font-bold">Fit and conversion</h3>
        <select aria-label="Fit conversion metric" value={metric} onChange={event => setMetric(event.target.value as typeof metric)} className="rounded-lg border border-[#F1DDE9] bg-white px-2 py-1 text-xs">
          <option value="offerRate">Offers</option><option value="progressionRate">Past submission</option><option value="rejectionRate">Rejections</option>
        </select>
      </div>
      <p className="mt-1 mb-4 text-xs text-[#736A6D]">{metricLabel} ÷ submitted in each group. Small samples vary widely.</p>
      <div className="flex justify-between pl-32 text-[10px] text-[#736A6D]"><span>0%</span><span>50%</span><span>100%</span></div>
      <div className="mt-2 space-y-4">{stats.fits.map((fit, index) => {
        const value = fit[metric];
        const count = metric === 'offerRate' ? fit.offers : metric === 'rejectionRate' ? fit.rejections : fit.progressed;
        return <button type="button" key={fit.value} onClick={() => onReview({ kind: 'fit', value: fit.value, label: fit.label })}
          aria-label={`Review ${fit.label} applications`} title={value === null ? 'No submitted applications in this group' : `${count} of ${fit.submitted} submitted (${value}%); ${fit.total} tracked`}
          className="grid w-full grid-cols-[8rem_1fr] items-center gap-2 rounded-lg text-left focus-visible:outline-2 focus-visible:outline-[#9D3C5E]">
          <span className="text-xs font-semibold">{fit.label}<span className="block text-[10px] font-normal text-[#736A6D]">n = {fit.submitted} submitted{fit.submitted > 0 && fit.submitted < 5 ? ' · small sample' : ''}</span></span>
          <span><span className="mb-1 flex justify-between text-[11px]"><span>{count} / {fit.submitted}</span><strong>{value === null ? '—' : `${value}%`}</strong></span><span className="block h-5 overflow-hidden rounded-lg bg-[#FAF7F9]"><span className="block h-full rounded-lg transition-all" style={{ width: `${value || 0}%`, backgroundColor: fitColors[index] }} /></span></span>
        </button>;
      })}</div>
      <p className="mt-5 text-[11px] text-[#736A6D]">Unassessed roles stay visible. Rates describe recorded results, not offer probabilities.</p>
    </section>
    <section className={card} aria-label="Current outcomes chart">
      <h3 className="text-sm font-bold">Where roles stand now</h3><p className="mt-1 text-xs text-[#736A6D]">Current outcomes · each role appears once.</p>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-6">
        <svg viewBox="0 0 160 160" className="h-40 w-40 shrink-0" role="img" aria-label={`Current outcomes for ${stats.total} tracked roles`}>
          {stats.outcomes.map((outcome, index) => {
            const circumference = 2 * Math.PI * 60;
            const offset = stats.outcomes.slice(0, index).reduce((sum, item) => sum + item.count, 0) / stats.total * circumference;
            return <circle key={outcome.key} cx="80" cy="80" r="60" fill="none" stroke={outcome.color} strokeWidth="22"
              strokeDasharray={`${outcome.count / stats.total * circumference} ${circumference}`} strokeDashoffset={-offset} transform="rotate(-90 80 80)"><title>{outcome.label}: {outcome.count}</title></circle>;
          })}
          <text x="80" y="78" textAnchor="middle" fontSize="27" fontWeight="700" fill="#4A3E44">{stats.total}</text><text x="80" y="97" textAnchor="middle" fontSize="11" fill="#736A6D">tracked roles</text>
        </svg>
        <div className="min-w-40 flex-1 space-y-2">{stats.outcomes.map(outcome => <button key={outcome.key} type="button" onClick={() => onReview({ kind: 'outcome', value: outcome.key, label: outcome.label })} className="flex w-full items-center justify-between gap-4 rounded-lg px-2 py-1 text-xs hover:bg-[#FAF7F9]">
          <span><i className="mr-2 inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: outcome.color }} />{outcome.label}</span><strong>{outcome.count}</strong>
        </button>)}</div>
      </div>
      <p className="mt-3 text-[11px] text-[#736A6D]">Declined offers appear in Not proceeding here and still count as offers reached above.</p>
    </section>
    <section className={card} aria-label="Application activity chart">
      <h3 className="text-sm font-bold">Application activity</h3><p className="mt-1 text-xs text-[#736A6D]">Last 12 months · saved application dates.</p>
      <div className="mt-4 overflow-x-auto">
        <svg viewBox="0 0 720 200" className="w-full min-w-[560px]" role="group" aria-label="Monthly submitted applications">
          {[0, 0.5, 1].map(fraction => <g key={fraction}><line x1="32" x2="710" y1={155 - fraction * 120} y2={155 - fraction * 120} stroke="#F1DDE9" strokeDasharray="3 4" /><text x="24" y={159 - fraction * 120} textAnchor="end" fontSize="10" fill="#736A6D">{Math.round(Math.max(2, Math.ceil(Math.max(0, ...stats.activity.map(month => month.count)) / 2) * 2) * fraction)}</text></g>)}
          {stats.activity.map((month, index) => {
            const height = month.count / Math.max(2, Math.ceil(Math.max(0, ...stats.activity.map(item => item.count)) / 2) * 2) * 120;
            const select = () => onReview({ kind: 'month', value: month.month, label: month.label });
            return <g key={month.month} role="button" tabIndex={0} aria-label={`Review ${month.count} applications in ${month.label}`} onClick={select} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); select(); } }} className="cursor-pointer">
              <title>{month.label}: {month.count} submitted applications</title><rect x={44 + index * 55} y={155 - height} width="30" height={height} rx="4" fill="#A8CCF0" />
              <text x={59 + index * 55} y={147 - height} textAnchor="middle" fontSize="11" fill="#4A3E44">{month.count}</text><text x={59 + index * 55} y="177" textAnchor="middle" fontSize="10" fill="#736A6D">{month.label}</text>
            </g>;
          })}
        </svg>
      </div>
      <p className="mt-2 text-[11px] text-[#736A6D]">{stats.quality.datedApplications} dated submissions · {stats.quality.missingDates + stats.quality.invalidDates + stats.quality.futureDates} excluded for missing, invalid or future dates.</p>
    </section>
  </div>;
}
