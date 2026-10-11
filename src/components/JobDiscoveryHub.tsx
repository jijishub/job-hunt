'use client';

import { useEffect, useState } from 'react';
import { Building2, Check, ExternalLink, FileText, Globe, Search, Sparkles, Upload } from 'lucide-react';
import { GeneratedLead } from '@/lib/ai-types';
import { JOB_SEARCH_PLATFORMS, jobSearchUrl } from '@/lib/job-search-links';
import { UserAccount } from '@/types/job';

const input = 'w-full rounded-xl border border-[#F1DDE9] bg-white px-3 py-2 text-xs text-[#4A3E44] focus:outline-none focus:border-[#FF7AB3]';
const secondary = 'inline-flex items-center gap-1.5 rounded-xl border border-[#F1DDE9] bg-white px-3 py-2 text-xs font-semibold text-[#9D3C5E] transition hover:bg-[#FFF0F6] disabled:opacity-50';
const primary = 'inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-[#FF7AB3] to-[#9D3C5E] px-4 py-2 text-xs font-bold text-white shadow-xs transition hover:from-[#ff6aa8] hover:to-[#8c3553] disabled:opacity-50';

export default function JobDiscoveryHub({ currentUser }: { currentUser: UserAccount | null }) {
  const industry = currentUser?.industry && currentUser.industry !== 'General' ? currentUser.industry : '';
  const [target, setTarget] = useState(industry);
  const [location, setLocation] = useState('Philippines');
  const [useResume, setUseResume] = useState(true);
  const [resumeReady, setResumeReady] = useState(false);
  const [filename, setFilename] = useState('');
  const [busy, setBusy] = useState<'upload' | 'scout' | ''>('');
  const [message, setMessage] = useState('');
  const [ideas, setIdeas] = useState<GeneratedLead[]>([]);
  const presets = [...new Set([industry, ...(currentUser?.role === 'admin' ? ['Forward-Deployed Engineer', 'AI & Automation Engineer'] : []), 'Tourism Management', 'Hotel Front Office & Reservations', 'Guest Relations Officer', 'Software Engineer', 'Marketing & Growth'].filter(Boolean))];

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/profile', { signal: controller.signal }).then(response => response.json()).then(data => {
      if (data.success) setResumeReady(Boolean(data.resumeText?.trim()));
    }).catch(() => {});
    return () => controller.abort();
  }, []);

  async function upload(file: File) {
    setBusy('upload'); setMessage('');
    try {
      const body = new FormData(); body.append('file', file);
      const response = await fetch('/api/resume/parse-pdf', { method: 'POST', body });
      const parsed = await response.json();
      if (!response.ok || !parsed.success || !parsed.text?.trim()) throw new Error(parsed.error || 'Could not extract resume text.');
      const saved = await fetch('/api/profile', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ resumeText: parsed.text }) });
      const result = await saved.json();
      if (!saved.ok || !result.success) throw new Error(result.error || 'Could not save your resume.');
      setResumeReady(true); setFilename(file.name); setIdeas([]);
      setMessage('Master resume updated. New keywords will use this version.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Resume upload failed.'); }
    finally { setBusy(''); }
  }

  async function scout(event: React.FormEvent) {
    event.preventDefault(); setBusy('scout'); setMessage('');
    try {
      const response = await fetch('/api/leads/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ targetRole: target.trim(), industry, locationPreference: location.trim(), useResumeContext: useResume, count: 6 }) });
      const data = await response.json();
      if (!response.ok || !data.success || !Array.isArray(data.data)) throw new Error(data.error || 'Keywords could not be generated.');
      setIdeas(data.data);
      if (!data.data.length) setMessage('No keywords returned. Try another role or update your resume.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Keyword generation failed.'); }
    finally { setBusy(''); }
  }

  return <div className="space-y-6">
    <section aria-label="Direct Sourcing Launchpads" className="space-y-3.5 rounded-2xl border border-[#F1DDE9] bg-white p-5 shadow-2xs">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div><h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#736A6D]"><Globe className="h-3.5 w-3.5 text-[#FF7AB3]" />Direct Sourcing Launchpads</h3><p className="mt-1 text-[11px] text-[#736A6D]">Choose a platform to search your keywords.</p></div>
        <label className="flex min-w-0 items-center gap-2 text-[11px] font-semibold text-[#736A6D]">Query<input aria-label="Launchpad keywords" value={target} onChange={event => setTarget(event.target.value)} placeholder="Target role / industry" className={`${input} sm:w-60`} /></label>
      </div>
      <div className="flex flex-wrap items-center gap-1.5"><span className="text-[11px] text-stone-400">Quick Presets:</span>{presets.map(preset => <button key={preset} type="button" onClick={() => setTarget(preset)} aria-pressed={target === preset} className={`rounded-lg border px-2 py-1 text-[10px] font-medium transition ${target === preset ? 'border-[#FF7AB3] bg-[#FFF0F6] text-[#9D3C5E]' : 'border-[#F1DDE9] bg-white text-stone-600 hover:bg-[#FAF7F9]'}`}>{preset}</button>)}</div>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">{JOB_SEARCH_PLATFORMS.map(platform => <a key={platform.id} aria-label={`Search ${platform.name}`} href={jobSearchUrl(platform.id, target, location)} target="_blank" rel="noreferrer" className="group flex min-w-0 items-center justify-between gap-2 rounded-xl border border-[#F1DDE9] bg-[#FAF7F9]/60 p-3 transition hover:border-[#FF7AB3] hover:bg-[#FFF0F6]"><div><span className="block text-xs font-bold text-[#4A3E44] group-hover:text-[#9D3C5E]">{platform.name}</span><span className="text-[10px] text-stone-500">{platform.description}</span></div><ExternalLink className="h-3.5 w-3.5 shrink-0 text-[#FF7AB3]" /></a>)}</div>
    </section>

    <section aria-label="AI Job Scout" className="space-y-4 rounded-2xl border border-[#F1DDE9] bg-gradient-to-br from-white via-[#FFF0F6]/40 to-white p-5 shadow-2xs">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h3 className="flex items-center gap-2 text-sm font-bold text-[#4A3E44]"><Sparkles className="h-4 w-4 text-[#FF7AB3]" />AI Job Scout<span className="rounded-full border border-[#F1DDE9] bg-[#FFF0F6] px-2 py-0.5 text-[10px] text-[#9D3C5E]">AI Powered</span></h3><p className="mt-1 text-xs text-[#736A6D]">Generate keywords for your background, then choose where to search.</p></div>
        <div className="flex flex-wrap items-center gap-2">
          {resumeReady && <span className="flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700"><FileText className="h-3 w-3" /><span className="max-w-40 truncate">{filename || 'Master resume ready'}</span></span>}
          <label className={`${secondary} cursor-pointer ${busy ? 'pointer-events-none opacity-50' : ''}`}><Upload className="h-3.5 w-3.5 text-[#FF7AB3]" />{busy === 'upload' ? 'Saving resume...' : resumeReady ? 'Change Resume' : 'Import Resume PDF'}<input aria-label="Scout resume PDF" type="file" accept=".pdf,application/pdf" className="sr-only" disabled={Boolean(busy)} onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void upload(file); }} /></label>
        </div>
      </div>
      <form onSubmit={scout} className="grid gap-3 sm:grid-cols-12">
        <label className="text-[11px] font-bold text-[#4A3E44] sm:col-span-5">Target Role / Keywords<input aria-label="Target role" required value={target} onChange={event => setTarget(event.target.value)} className={`${input} mt-1`} placeholder="Role or skills to search" /></label>
        <label className="text-[11px] font-bold text-[#4A3E44] sm:col-span-4">Location Preference<input aria-label="Scout location" value={location} onChange={event => setLocation(event.target.value)} className={`${input} mt-1`} placeholder="Metro Manila or Remote" /></label>
        <div className="flex items-end sm:col-span-3"><button type="submit" disabled={Boolean(busy)} className={`${primary} w-full`}><Sparkles className={`h-3.5 w-3.5 ${busy === 'scout' ? 'animate-spin' : ''}`} />{busy === 'scout' ? 'Generating...' : 'Generate keywords'}</button></div>
      </form>
      <label className="flex items-center gap-2 text-[11px] text-[#736A6D]"><input type="checkbox" checked={useResume} onChange={event => setUseResume(event.target.checked)} />Use my master resume</label>
      {message && <p role="status" className="rounded-xl bg-[#FFF0F6] p-3 text-xs text-[#9D3C5E]">{message}</p>}
    </section>

    {ideas.length > 0 && <section aria-label="Generated keywords" className="space-y-3.5">
      <h3 className="flex items-center gap-1.5 text-sm font-bold text-[#4A3E44]"><Sparkles className="h-4 w-4 text-[#FF7AB3]" />Generated keywords ({ideas.length})</h3>
      <div className="grid gap-3.5 md:grid-cols-2">{ideas.map((idea, index) => <article key={idea.id || index} className="flex flex-col justify-between gap-3 rounded-2xl border border-[#F1DDE9] bg-white p-4.5 transition hover:border-[#FF7AB3] hover:shadow-xs">
        <div className="space-y-2"><div className="flex items-center gap-2.5"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#F1DDE9] bg-[#FAF7F9]"><Building2 className="h-4 w-4 text-[#FF7AB3]" /></div><h4 className="text-sm font-bold text-[#4A3E44]">{idea.title}</h4></div>{idea.description && <p className="text-xs leading-relaxed text-[#736A6D]">{idea.description}</p>}{idea.ai_verdict && <p className="rounded-xl border border-[#F1DDE9]/60 bg-[#FFF0F6]/70 p-2 text-[11px] text-[#9D3C5E]">{idea.ai_verdict}</p>}</div>
        <div className="space-y-2 border-t border-[#F1DDE9]/60 pt-3"><button type="button" className="flex items-center gap-1 text-xs font-semibold text-[#9D3C5E] hover:underline" onClick={() => { setTarget(idea.title); }}><Check className="h-3.5 w-3.5" />Use these keywords</button><div className="flex flex-wrap gap-1.5">{JOB_SEARCH_PLATFORMS.map(platform => <a key={platform.id} aria-label={`Search ${idea.title} on ${platform.name}`} href={jobSearchUrl(platform.id, idea.title, location)} target="_blank" rel="noreferrer" className={secondary}><Search className="h-3 w-3 text-[#FF7AB3]" />{platform.name}<ExternalLink className="h-3 w-3" /></a>)}</div></div>
      </article>)}</div>
    </section>}
  </div>;
}
