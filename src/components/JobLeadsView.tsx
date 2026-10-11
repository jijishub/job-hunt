'use client';

import { useState } from 'react';
import { JobApplication, UserAccount, ApplicationStatus, Company } from '@/types/job';
import { GeneratedLead } from '@/lib/ai-types';
import StatusBadge from './StatusBadge';
import PriorityBadge from './PriorityBadge';
import { Search, Plus, ExternalLink, Sparkles, Building2, MapPin, Trash2, ArrowRight } from 'lucide-react';

interface JobLeadsViewProps {
  onAddToTracker: (data: Partial<JobApplication>) => Promise<void>;
  existingApplications: JobApplication[];
  currentUser: UserAccount | null;
  companies?: Company[];
  onUpdateStatus?: (id: string, status: ApplicationStatus, label?: string) => Promise<void>;
  onDeleteApplication?: (id: string) => Promise<void>;
  onSelectLead?: (app: JobApplication) => void;
  onNavigateToResume?: (id: string) => void;
}
const button = 'rounded-xl border border-[#F1DDE9] bg-[#FFF0F6] px-3 py-2 text-xs font-semibold text-[#9D3C5E] disabled:opacity-50';
const input = 'w-full rounded-xl border border-[#F1DDE9] bg-white px-3 py-2 text-sm';
export default function JobLeadsView({ onAddToTracker, existingApplications, currentUser, companies = [], onUpdateStatus, onDeleteApplication, onSelectLead, onNavigateToResume }: JobLeadsViewProps) {
  const [tab, setTab] = useState('saved');
  const [query, setQuery] = useState('');
  const [target, setTarget] = useState(currentUser?.industry && currentUser.industry !== 'General' ? currentUser.industry : '');
  const [location, setLocation] = useState('Philippines');
  const [ideas, setIdeas] = useState<GeneratedLead[]>([]);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [title, setTitle] = useState('');
  const [company, setCompany] = useState('');
  const [url, setUrl] = useState('');
  const [notes, setNotes] = useState('');
  const leads = existingApplications.filter(app => app.status === 'LEAD');
  const shown = leads.filter(app => (app.role_title + ' ' + app.company_name).toLowerCase().includes(query.trim().toLowerCase()));
  async function action(key: string, run: () => Promise<void>) {
    setBusy(key); setMessage('');
    try { await run(); } catch (error) { setMessage(error instanceof Error ? error.message : 'Please try again.'); }
    finally { setBusy(''); }
  }
  async function saveLead(event: React.FormEvent) {
    event.preventDefault();
    await action('save', async () => {
      if (url && !/^https?:\/\//i.test(url)) throw new Error('Use a posting URL starting with https:// or http://.');
      await onAddToTracker({ role_title: title.trim(), company_name: company.trim(), job_url: url.trim() || undefined, notes: notes.trim() || undefined, status: 'LEAD', notion_status: 'Not started', priority: 'MEDIUM' });
      setTitle(''); setCompany(''); setUrl(''); setNotes(''); setMessage('Lead saved.');
    });
  }
  async function scout(event: React.FormEvent) {
    event.preventDefault();
    await action('scout', async () => {
      const response = await fetch('/api/leads/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ targetRole: target, industry: currentUser?.industry, locationPreference: location, count: 6 }) });
      const data = await response.json();
      if (!response.ok || !data.success || !Array.isArray(data.data)) throw new Error(data.error || 'Search ideas could not be generated.');
      setIdeas(data.data);
    });
  }
  return <div className="space-y-5">
    <nav className="flex gap-2"><button className={button} aria-pressed={tab === 'saved'} onClick={() => { setTab('saved'); setMessage(''); }}>Saved leads ({leads.length})</button><button className={button} aria-pressed={tab === 'discover'} onClick={() => { setTab('discover'); setMessage(''); }}>Discover</button></nav>
    {message && <p role="status" className="rounded-xl bg-[#FFF0F6] p-3 text-sm text-[#9D3C5E]">{message}</p>}
    {tab === 'saved' ? <>
      <label className="flex items-center gap-2"><Search className="h-4 w-4 text-[#FF7AB3]" /><input aria-label="Search saved leads" value={query} onChange={e => setQuery(e.target.value)} className={input} placeholder="Search role or company" /></label>
      <div className="grid gap-3.5 md:grid-cols-2 lg:grid-cols-3">{shown.map(app => <article key={app.id} className="flex flex-col justify-between space-y-3 rounded-2xl border border-[#F1DDE9] bg-white p-4.5 transition hover:border-[#FF7AB3] hover:shadow-xs">
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#F1DDE9] bg-[#FAF7F9]">
                {app.company_logo?.startsWith('emoji:') ? <span className="text-xs">{app.company_logo.slice(6)}</span> : app.company_logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={app.company_logo} alt="" className="h-4 w-4 object-contain" />
                ) : <Building2 className="h-4 w-4 text-stone-300" />}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-[#4A3E44]">{app.company_name}</p>
                {app.location && <p className="flex items-center gap-1 text-[11px] text-[#736A6D]"><MapPin className="h-3 w-3 shrink-0 text-stone-400" /><span className="truncate">{app.location}</span></p>}
              </div>
            </div>
            <PriorityBadge priority={app.priority} size="sm" />
          </div>
          <button type="button" className="text-left text-sm font-bold text-[#4A3E44] transition hover:text-[#9D3C5E]" onClick={() => onSelectLead?.(app)}><h3>{app.role_title}</h3></button>
          {app.notes && <p className="line-clamp-2 whitespace-pre-line rounded-xl border border-[#F1DDE9]/60 bg-[#FAF7F9] p-2 text-xs leading-relaxed text-[#736A6D]">{app.notes}</p>}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <StatusBadge status={app.notion_status || app.status} size="sm" />
            {app.work_model && <span className="rounded-md border border-stone-200 bg-stone-50 px-2 py-0.5 text-[10px] font-semibold text-stone-600">{app.work_model.replaceAll('_', ' ')}</span>}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#F1DDE9]/60 pt-3">
          <div className="flex items-center gap-1">
            {app.job_url && /^https?:\/\//i.test(app.job_url) && <a href={app.job_url} target="_blank" rel="noreferrer" title="Open posting" aria-label="Open posting" className="rounded-lg p-2 text-stone-400 transition hover:bg-[#FAF7F9] hover:text-[#9D3C5E]"><ExternalLink className="h-4 w-4" /></a>}
            {onNavigateToResume && <button type="button" title="ATS match" aria-label="ATS match" className="rounded-lg p-2 text-[#FF7AB3] transition hover:bg-[#FFF0F6]" onClick={() => onNavigateToResume(app.id)}><Sparkles className="h-4 w-4" /></button>}
            {onDeleteApplication && <button type="button" title="Delete lead" aria-label="Delete lead" disabled={Boolean(busy)} className="rounded-lg p-2 text-stone-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50" onClick={() => { if (window.confirm(`Delete the lead for ${app.role_title} at ${app.company_name}?`)) action(app.id, () => onDeleteApplication(app.id)); }}><Trash2 className="h-4 w-4" /></button>}
          </div>
          {onUpdateStatus && <button type="button" disabled={Boolean(busy)} className="inline-flex items-center gap-1 rounded-xl bg-gradient-to-r from-[#FF7AB3] to-[#9D3C5E] px-3 py-1.5 text-xs font-bold text-white shadow-2xs transition hover:from-[#ff6aa8] hover:to-[#8c3553] disabled:opacity-50" onClick={() => {
            if (window.confirm(`Have you submitted your application for ${app.role_title} at ${app.company_name}? Confirm to change this lead to Applied.`)) action(app.id, () => onUpdateStatus(app.id, 'APPLIED', 'Applied'));
          }}>{busy === app.id ? 'Updating...' : 'Mark applied'}<ArrowRight className="h-3.5 w-3.5" /></button>}
        </div>
      </article>)}</div>
      {!shown.length && <p className="text-sm text-[#736A6D]">{leads.length ? 'No leads match your search.' : 'No saved leads yet. Save a real posting below.'}</p>}
      <form onSubmit={saveLead} className="rounded-2xl border border-[#F1DDE9] bg-white p-5 space-y-3"><h3 className="font-bold flex gap-2"><Plus className="h-4 w-4 text-[#FF7AB3]" />Quick Add a real lead</h3>
        <datalist id="lead-company-options">{companies.map(company => <option key={company.id} value={company.name} />)}</datalist>
        <div className="grid gap-3 sm:grid-cols-2"><label className="text-xs">Role title<input required value={title} onChange={e => setTitle(e.target.value)} className={input} /></label><label className="text-xs">Company<input required list="lead-company-options" placeholder="Select or type company" value={company} onChange={e => setCompany(e.target.value)} className={input} /></label></div>
        <label className="block text-xs">Posting URL<input type="url" value={url} onChange={e => setUrl(e.target.value)} className={input} placeholder="https://?" /></label>
        <label className="block text-xs">Personal notes<textarea value={notes} onChange={e => setNotes(e.target.value)} className={input} rows={3} /></label><button disabled={Boolean(busy)} className={button}>{busy === 'save' ? 'Saving?' : 'Save lead'}</button>
      </form>
    </> : <>
      <form onSubmit={scout} className="rounded-2xl border border-[#F1DDE9] bg-white p-5 space-y-3"><h3 className="font-bold flex gap-2"><Sparkles className="h-4 w-4 text-[#FF7AB3]" />Search ideas</h3><p className="text-xs text-[#736A6D]">Suggestions are not verified vacancies. Open a search, confirm a real posting, then save its URL with Quick Add.</p>
        <div className="grid gap-3 sm:grid-cols-2"><label className="text-xs">Target role<input value={target} onChange={e => setTarget(e.target.value)} className={input} placeholder="Role or keywords" /></label><label className="text-xs">Location<input value={location} onChange={e => setLocation(e.target.value)} className={input} /></label></div>
        <div className="flex flex-wrap gap-2">{[['LinkedIn', 'https://www.linkedin.com/jobs/search/?keywords='], ['JobStreet', 'https://www.jobstreet.com.ph/jobs?keywords='], ['Indeed', 'https://ph.indeed.com/jobs?q='], ['Google Jobs', 'https://www.google.com/search?ibp=htl;jobs&q=']].map(([label, base]) => <a key={label} href={base + encodeURIComponent(target + ' ' + location)} target="_blank" rel="noreferrer" className={button}>{label}<ExternalLink className="ml-1 inline h-3 w-3" /></a>)}</div>
        <button disabled={Boolean(busy)} className={button}>{busy === 'scout' ? 'Generating?' : 'Generate search ideas'}</button>
      </form>
      <div className="grid gap-4 md:grid-cols-2">{ideas.map((idea, index) => <article key={idea.id || index} className="rounded-2xl border border-[#F1DDE9] bg-white p-5 space-y-2"><h3 className="font-bold">{idea.title}</h3><p className="text-sm text-[#736A6D]">Employer to research: {idea.company_name}</p><p className="text-xs text-[#736A6D]">{idea.description}</p><p className="text-xs text-[#9D3C5E]">{idea.ai_verdict}</p><a className={button + ' inline-block'} href={'https://www.google.com/search?ibp=htl;jobs&q=' + encodeURIComponent(idea.company_name + ' ' + idea.title + ' jobs')} target="_blank" rel="noreferrer">Search on Google Jobs <ExternalLink className="inline h-3 w-3" /></a></article>)}</div>
    </>}
  </div>;
}
