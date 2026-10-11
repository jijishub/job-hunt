'use client';

import { useState } from 'react';
import { JobApplication, UserAccount, ApplicationStatus, Company } from '@/types/job';
import { GeneratedLead } from '@/lib/ai-types';
import StatusBadge from './StatusBadge';
import { Search, Plus, ExternalLink, Sparkles } from 'lucide-react';

interface JobLeadsViewProps {
  onAddToTracker: (data: Partial<JobApplication>) => Promise<void>;
  existingApplications: JobApplication[];
  currentUser: UserAccount | null;
  companies?: Company[];
  onUpdateStatus?: (id: string, status: ApplicationStatus, label?: string) => Promise<void>;
  onDeleteApplication?: (id: string) => Promise<void>;
  onSelectLead?: (app: JobApplication) => void;
  onNavigateToResume?: (id: string) => void;
  onOpenPreferences: () => void;
}
const button = 'rounded-xl border border-[#F1DDE9] bg-[#FFF0F6] px-3 py-2 text-xs font-semibold text-[#9D3C5E] disabled:opacity-50';
const input = 'w-full rounded-xl border border-[#F1DDE9] bg-white px-3 py-2 text-sm';
export default function JobLeadsView({ onAddToTracker, existingApplications, currentUser, onUpdateStatus, onDeleteApplication, onSelectLead, onNavigateToResume, onOpenPreferences }: JobLeadsViewProps) {
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
    <section className="flex flex-wrap justify-between gap-3 rounded-2xl border border-[#F1DDE9] bg-[#FFF0F6] p-5">
      <div><h2 className="font-bold">Your lead workspace</h2><p className="mt-1 text-xs text-[#736A6D]">Save real postings. AI search ideas use your master resume in My preferences.</p></div>
      <button type="button" onClick={onOpenPreferences} className={button}>My preferences</button>
    </section>
    <nav className="flex gap-2"><button className={button} aria-pressed={tab === 'saved'} onClick={() => { setTab('saved'); setMessage(''); }}>Saved leads ({leads.length})</button><button className={button} aria-pressed={tab === 'discover'} onClick={() => { setTab('discover'); setMessage(''); }}>Discover</button></nav>
    {message && <p role="status" className="rounded-xl bg-[#FFF0F6] p-3 text-sm text-[#9D3C5E]">{message}</p>}
    {tab === 'saved' ? <>
      <label className="flex items-center gap-2"><Search className="h-4 w-4 text-[#FF7AB3]" /><input aria-label="Search saved leads" value={query} onChange={e => setQuery(e.target.value)} className={input} placeholder="Search role or company" /></label>
      <div className="grid gap-4 md:grid-cols-2">{shown.map(app => <article key={app.id} className="rounded-2xl border border-[#F1DDE9] bg-white p-5 space-y-3">
        <button className="text-left" onClick={() => onSelectLead?.(app)}><h3 className="font-bold">{app.role_title}</h3><p className="text-sm text-[#736A6D]">{app.company_name}</p></button>
        <StatusBadge status={app.notion_status || app.status} />
        {app.notes && <p className="text-xs text-[#736A6D] line-clamp-3 whitespace-pre-line">{app.notes}</p>}
        <div className="flex flex-wrap gap-2">{app.job_url && /^https?:\/\//i.test(app.job_url) && <a href={app.job_url} target="_blank" rel="noreferrer" className={button}>Open posting <ExternalLink className="inline h-3 w-3" /></a>}
          {onUpdateStatus && <button disabled={Boolean(busy)} className={button} onClick={() => action(app.id, () => onUpdateStatus(app.id, 'APPLIED', 'Applied'))}>Mark applied</button>}
          {onNavigateToResume && <button className={button} onClick={() => onNavigateToResume(app.id)}>ATS match</button>}
          {onDeleteApplication && <button disabled={Boolean(busy)} className={button} onClick={() => { if (window.confirm('Delete this lead?')) action(app.id, () => onDeleteApplication(app.id)); }}>Delete</button>}
        </div>
      </article>)}</div>
      {!shown.length && <p className="text-sm text-[#736A6D]">{leads.length ? 'No leads match your search.' : 'No saved leads yet. Save a real posting below.'}</p>}
      <form onSubmit={saveLead} className="rounded-2xl border border-[#F1DDE9] bg-white p-5 space-y-3"><h3 className="font-bold flex gap-2"><Plus className="h-4 w-4 text-[#FF7AB3]" />Quick Add a real lead</h3>
        <div className="grid gap-3 sm:grid-cols-2"><label className="text-xs">Role title<input required value={title} onChange={e => setTitle(e.target.value)} className={input} /></label><label className="text-xs">Company<input required value={company} onChange={e => setCompany(e.target.value)} className={input} /></label></div>
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
