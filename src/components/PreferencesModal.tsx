'use client';
import { useEffect, useState } from 'react';
import { EMPTY_PREFERENCES, PersonalPreferences } from '@/lib/preferences';
import CandidateProfileEditor from './CandidateProfileEditor';

const input = 'mt-1 w-full rounded-xl border border-[#F1DDE9] bg-white p-2 text-xs font-normal';
export default function PreferencesModal({ isOpen, onClose, onSaved }: { isOpen: boolean; onClose: () => void; onSaved: () => void }) {
  const [preferences, setPreferences] = useState<PersonalPreferences>(EMPTY_PREFERENCES);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => {
    if (!isOpen) return;
    setBusy(true); setMessage('');
    fetch('/api/preferences').then(response => response.json()).then(data => {
      if (!data.success) throw new Error(data.error); setPreferences({ ...EMPTY_PREFERENCES, ...data.data });
    }).catch(error => setMessage(error.message)).finally(() => setBusy(false));
  }, [isOpen]);
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-xs">
      <section role="dialog" aria-modal="true" aria-label="My preferences" className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-[#F1DDE9] bg-white p-6">
        <div className="flex items-center justify-between"><h2 className="font-bold text-[#4A3E44]">My preferences</h2><button type="button" onClick={onClose} aria-label="Close preferences" className="rounded-lg px-3 py-1 text-[#9D3C5E]">Close</button></div>
        <p className="mt-1 mb-4 text-xs text-[#736A6D]">Saved to your account. AI compares these with each role separately from your experience fit.</p>
        <form className="space-y-4 text-xs" onSubmit={async event => {
          event.preventDefault(); setBusy(true); setMessage('');
          try {
            const response = await fetch('/api/preferences', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(preferences) });
            const data = await response.json(); if (!response.ok || !data.success) throw new Error(data.error);
            setPreferences(data.data); setMessage('Preferences saved. Reassess existing AI ratings to compare them with your updated preferences.'); onSaved();
          } catch (error) { setMessage(error instanceof Error ? error.message : 'Save failed.'); }
          finally { setBusy(false); }
        }}>
          <div className="grid gap-3 sm:grid-cols-2">
            {([['target_companies', 'Target companies'], ['target_roles', 'Target positions'], ['preferred_locations', 'Preferred locations']] as const).map(([key, label]) => <label key={key} className="font-semibold">{label} <span className="font-normal text-[#736A6D]">(one per line)</span><textarea aria-label={label} rows={3} className={input} value={preferences[key].join('\n')} onChange={event => setPreferences({ ...preferences, [key]: event.target.value.split('\n') })} /></label>)}
          </div>
          <fieldset><legend className="font-semibold mb-2">Preferred work models</legend><div className="flex flex-wrap gap-4">{([['ON_SITE', 'On-site'], ['HYBRID', 'Hybrid'], ['REMOTE', 'Remote']] as const).map(([value, label]) => <label key={value} className="flex items-center gap-1"><input type="checkbox" checked={preferences.work_models.includes(value)} onChange={event => setPreferences({ ...preferences, work_models: event.target.checked ? [...preferences.work_models, value] : preferences.work_models.filter(item => item !== value) })} />{label}</label>)}</div></fieldset>
          <fieldset><legend className="font-semibold mb-2">Preferred job types</legend><div className="flex flex-wrap gap-4">{([['FULL_TIME', 'Full-time'], ['PART_TIME', 'Part-time'], ['CONTRACT', 'Contract'], ['INTERNSHIP', 'Internship']] as const).map(([value, label]) => <label key={value} className="flex items-center gap-1"><input type="checkbox" checked={preferences.job_types.includes(value)} onChange={event => setPreferences({ ...preferences, job_types: event.target.checked ? [...preferences.job_types, value] : preferences.job_types.filter(item => item !== value) })} />{label}</label>)}</div></fieldset>
          <div className="grid grid-cols-2 gap-3"><label className="font-semibold">Minimum monthly salary<input aria-label="Minimum monthly salary" type="number" min={0} className={input} value={preferences.salary_min ?? ''} onChange={event => setPreferences({ ...preferences, salary_min: event.target.value ? Number(event.target.value) : undefined })} /></label><label className="font-semibold">Currency<input aria-label="Preference currency" maxLength={3} className={input} value={preferences.salary_currency} onChange={event => setPreferences({ ...preferences, salary_currency: event.target.value.toUpperCase() })} /></label></div>
          <label className="block font-semibold">Dealbreakers and priorities<textarea aria-label="Dealbreakers and priorities" rows={3} className={input} value={preferences.dealbreakers} onChange={event => setPreferences({ ...preferences, dealbreakers: event.target.value })} placeholder="For example: daytime schedule, commute limit, hands-on AI projects…" /></label>
          <label className="block font-semibold">Portfolio projects and skills<textarea aria-label="Portfolio projects and skills" rows={4} className={input} value={preferences.portfolio_summary} onChange={event => setPreferences({ ...preferences, portfolio_summary: event.target.value })} placeholder="Paste relevant project descriptions from your portfolio. AI uses this as evidence alongside your resume." /></label>
          <CandidateProfileEditor />
          {message && <p role="status" className="text-[#9D3C5E]">{message}</p>}
          <button type="submit" disabled={busy} className="rounded-xl bg-[#FF7AB3] px-4 py-2 font-semibold text-white disabled:opacity-50">{busy ? 'Saving…' : 'Save preferences'}</button>
        </form>
      </section>
    </div>
  );
}
