'use client';
import { useEffect, useState } from 'react';
import { EMPTY_PREFERENCES, PersonalPreferences, DEFAULT_VIEWS, DefaultView } from '@/lib/preferences';
import CloseButton from './CloseButton';
import CurrencyInput from './CurrencyInput';
import { CURRENCIES } from '@/lib/currencies';
import { ANALYTICS_STAGES, STAGE_LABELS, stageForStatus, AnalyticsStage, DEFAULT_REJECTION_STATUSES } from '@/lib/analytics-stages';
import CandidateProfileEditor from './CandidateProfileEditor';
import { DEFAULT_AGE_BOUNDARIES } from '@/lib/analytics-timing';

const input = 'mt-1 w-full rounded-xl border border-[#F1DDE9] bg-white p-2 text-xs font-normal';
export default function PreferencesModal({ isOpen, onClose, onSaved, isAdmin = false }: { isOpen: boolean; onClose: () => void; onSaved: (preferences?: PersonalPreferences) => void; isAdmin?: boolean }) {
  const [preferences, setPreferences] = useState<PersonalPreferences>(EMPTY_PREFERENCES);
  const [statuses,setStatuses] = useState<{name:string;category:string}[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => {
    if (!isOpen) return;
    setBusy(true); setMessage('');
    fetch('/api/statuses').then(r=>r.json()).then(d=>{if(d.success)setStatuses(d.data);}).catch(()=>{});
    fetch('/api/preferences').then(response => response.json()).then(data => {
      if (!data.success) throw new Error(data.error); setPreferences({ ...EMPTY_PREFERENCES, ...data.data });
    }).catch(error => setMessage(error.message)).finally(() => setBusy(false));
  }, [isOpen]);
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-xs">
      <section role="dialog" aria-modal="true" aria-label="My preferences" className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-[#F1DDE9] bg-white p-6">
        <div className="flex items-center justify-between"><h2 className="font-bold text-[#4A3E44]">My preferences</h2><CloseButton onClick={onClose} label="Close preferences" /></div>
        <div className="mt-4"><CandidateProfileEditor onSaved={onSaved} /></div>
        <p className="mt-4 mb-4 text-xs text-[#736A6D]">Saved to your account. AI compares these with each role separately from your experience fit.</p>
        <form className="space-y-4 text-xs" onSubmit={async event => {
          event.preventDefault(); setBusy(true); setMessage('');
          try {
            const response = await fetch('/api/preferences', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(preferences) });
            const data = await response.json(); if (!response.ok || !data.success) throw new Error(data.error);
            setPreferences(data.data); setMessage('Preferences saved. Reassess existing AI ratings to compare them with your updated preferences.'); onSaved(data.data);
          } catch (error) { setMessage(error instanceof Error ? error.message : 'Save failed.'); }
          finally { setBusy(false); }
        }}>
          <label className="block font-semibold">Default view
            <select aria-label="Default view" className={input} value={preferences.default_view || 'ALL'} onChange={event => setPreferences({ ...preferences, default_view: event.target.value as DefaultView })}>
              {DEFAULT_VIEWS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <span className="mt-1 block font-normal text-[#736A6D]">Used when you sign in. You can change the view anytime.</span>
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            {([['target_companies', 'Target companies'], ['target_roles', 'Target positions'], ['preferred_locations', 'Preferred locations']] as const).map(([key, label]) => <label key={key} className="font-semibold">{label} <span className="font-normal text-[#736A6D]">(one per line)</span><textarea aria-label={label} rows={3} className={input} value={preferences[key].join('\n')} onChange={event => setPreferences({ ...preferences, [key]: event.target.value.split('\n') })} /></label>)}
          </div>
          <div className="grid gap-4 sm:grid-cols-2"><fieldset><legend className="font-semibold mb-2">Preferred work models</legend><div className="flex flex-wrap gap-4">{([['ON_SITE', 'On-site'], ['HYBRID', 'Hybrid'], ['REMOTE', 'Remote']] as const).map(([value, label]) => <label key={value} className="flex items-center gap-1"><input type="checkbox" checked={preferences.work_models.includes(value)} onChange={event => setPreferences({ ...preferences, work_models: event.target.checked ? [...preferences.work_models, value] : preferences.work_models.filter(item => item !== value) })} />{label}</label>)}</div></fieldset>
          <fieldset><legend className="font-semibold mb-2">Preferred job types</legend><div className="flex flex-wrap gap-4">{([['FULL_TIME', 'Full-time'], ['PART_TIME', 'Part-time'], ['CONTRACT', 'Contract'], ['INTERNSHIP', 'Internship']] as const).map(([value, label]) => <label key={value} className="flex items-center gap-1"><input type="checkbox" checked={preferences.job_types.includes(value)} onChange={event => setPreferences({ ...preferences, job_types: event.target.checked ? [...preferences.job_types, value] : preferences.job_types.filter(item => item !== value) })} />{label}</label>)}</div></fieldset>
          </div>
          <div className="flex items-end gap-3"><label className="font-semibold">Minimum monthly salary<CurrencyInput aria-label="Minimum monthly salary" className={input} value={preferences.salary_min} onValueChange={value => setPreferences({ ...preferences, salary_min: value ? Number(value) : undefined })} /></label><label className="font-semibold">Currency<select aria-label="Preference currency" className={input} value={preferences.salary_currency} onChange={event => setPreferences({ ...preferences, salary_currency: event.target.value })}>{CURRENCIES.map(currency=><option key={currency} value={currency}>{currency}</option>)}</select></label></div>
          <label className="block font-semibold">Dealbreakers and priorities<textarea aria-label="Dealbreakers and priorities" rows={3} className={input} value={preferences.dealbreakers} onChange={event => setPreferences({ ...preferences, dealbreakers: event.target.value })} placeholder="For example: daytime schedule, commute limit, hands-on AI projects…" /></label>
          <section className="rounded-xl border border-[#F1DDE9] p-3">
            <h3 className="flex flex-wrap items-baseline gap-x-2 font-semibold">Analytics status mappings{!isAdmin && <span className="font-normal text-[#736A6D]">(Recommended: Keep defaults)</span>}</h3>
            <p className="mt-2 mb-3 text-[#736A6D]">Match each status to a phase. Rejections default to Not Accepted.</p>
            <div className="max-h-80 overflow-auto"><table className="w-full text-left"><thead><tr><th className="p-2">Status</th><th>Phase</th><th>Screening</th><th>Acceptance / offer</th><th>Rejection</th></tr></thead><tbody>{statuses.map(status=>{
              const stage=stageForStatus(status.name,status.category,preferences.analytics_status_stages);
              const rank=ANALYTICS_STAGES.indexOf(stage);
              const setStage=(value:AnalyticsStage)=>setPreferences({...preferences,analytics_status_stages:{...preferences.analytics_status_stages,[status.name.toLowerCase().trim()]:value}});
              const rejectionKey=status.name.trim().toLowerCase();
              const rejectionStatuses=preferences.analytics_rejection_statuses ?? DEFAULT_REJECTION_STATUSES;
              const countRejection=rejectionStatuses.some(name=>name.trim().toLowerCase()===rejectionKey);
              return <tr key={status.name} className="border-t border-[#F1DDE9]"><td className="p-2">{status.name}</td><td><select aria-label={'Analytics phase for '+status.name} value={stage} onChange={e=>setStage(e.target.value as AnalyticsStage)} className="m-1 rounded-lg border p-1">{ANALYTICS_STAGES.map(value=><option key={value} value={value}>{STAGE_LABELS[value]}</option>)}</select></td><td><input aria-label={'Count '+status.name+' as screening'} type="checkbox" checked={rank>=2} onChange={e=>setStage(e.target.checked?(rank>=2?stage:'SCREENING'):'SUBMITTED')} /></td><td><input aria-label={'Count '+status.name+' as acceptance or offer'} type="checkbox" checked={rank>=5} onChange={e=>setStage(e.target.checked?'OFFER':'INTERVIEW')} /></td><td><input aria-label={'Count '+status.name+' as rejection'} type="checkbox" checked={countRejection} onChange={e=>setPreferences({...preferences,analytics_rejection_statuses:e.target.checked?[...new Set([...rejectionStatuses.map(name=>name.trim().toLowerCase()),rejectionKey])]:rejectionStatuses.filter(name=>name.trim().toLowerCase()!==rejectionKey)})} /></td></tr>;
            })}</tbody></table></div>
          </section>
          <section className="rounded-xl border border-[#F1DDE9] p-3"><h3 className="font-semibold">Application age ranges</h3>
            <p className="mt-1 text-[#736A6D]">Set three increasing upper limits in days. The final range starts one day after the last limit. These are grouping choices, not recruitment benchmarks.</p>
            <div className="mt-2 grid grid-cols-3 gap-2">{(preferences.analytics_age_boundaries || DEFAULT_AGE_BOUNDARIES).map((limit, index) => <label key={index} className="font-semibold">Range {index + 1} ends at<input aria-label={`Application age boundary ${index + 1}`} type="number" required min={1} max={3650} step={1} value={limit} className={input} onChange={event => { const limits = [...(preferences.analytics_age_boundaries || DEFAULT_AGE_BOUNDARIES)]; limits[index] = Number(event.target.value); setPreferences({ ...preferences, analytics_age_boundaries: limits }); }} /></label>)}</div>
          </section>
          {message && <p role="status" className="text-[#9D3C5E]">{message}</p>}
          <button type="submit" disabled={busy} className="rounded-xl bg-[#FF7AB3] px-4 py-2 font-semibold text-white disabled:opacity-50">{busy ? 'Saving…' : 'Save preferences'}</button>
        </form>
      </section>
    </div>
  );
}
