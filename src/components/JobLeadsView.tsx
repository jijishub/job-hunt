'use client';

import { useRef, useState } from 'react';
import { JobApplication, UserAccount, ApplicationStatus, Company } from '@/types/job';
import JobDiscoveryHub from './JobDiscoveryHub';
import StatusBadge from './StatusBadge';
import PriorityBadge from './PriorityBadge';
import RoleFitBadge from './RoleFitBadge';
import CloseButton from './CloseButton';
import { Search, Plus, ExternalLink, Sparkles, Building2, MapPin, Trash2, ArrowRight, Compass, BookmarkCheck } from 'lucide-react';

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
const fitOrder = { STRONG: 0, POSSIBLE: 1, WEAK: 2 };
export default function JobLeadsView({ onAddToTracker, existingApplications, currentUser, companies = [], onUpdateStatus, onDeleteApplication, onSelectLead, onNavigateToResume }: JobLeadsViewProps) {
  const [tab, setTab] = useState('saved');
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [title, setTitle] = useState('');
  const [company, setCompany] = useState('');
  const [url, setUrl] = useState('');
  const [notes, setNotes] = useState('');
  const quickAddDialog = useRef<HTMLDialogElement>(null);
  const leads = existingApplications.filter(app => app.status === 'LEAD');
  const shown = leads
    .filter(app => (app.role_title + ' ' + app.company_name).toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => (a.role_fit ? fitOrder[a.role_fit] : 3) - (b.role_fit ? fitOrder[b.role_fit] : 3));
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
      quickAddDialog.current?.close();
    });
  }
  const quickAdd = <form onSubmit={saveLead} className="bg-white p-5 space-y-4"><div className="flex items-center justify-between gap-3"><h3 id="quick-add-lead-title" className="font-bold flex items-center gap-2"><Plus className="h-4 w-4 shrink-0 text-[#FF7AB3]" />Quick Add a real lead</h3><CloseButton onClick={() => quickAddDialog.current?.close()} label="Close Quick Add" /></div>
    {message && message !== 'Lead saved.' && <p role="alert" className="rounded-xl bg-[#FFF0F6] p-3 text-sm text-[#9D3C5E]">{message}</p>}
    <datalist id="lead-company-options">{companies.map(company => <option key={company.id} value={company.name} />)}</datalist>
    <div className="grid gap-3 sm:grid-cols-2"><label className="text-xs">Role title<input required value={title} onChange={e => setTitle(e.target.value)} className={input} /></label><label className="text-xs">Company<input required list="lead-company-options" placeholder="Select or type company" value={company} onChange={e => setCompany(e.target.value)} className={input} /></label></div>
    <label className="block text-xs">Posting URL<input type="url" value={url} onChange={e => setUrl(e.target.value)} className={input} placeholder="https://" /></label>
    <label className="block text-xs">Personal notes<textarea value={notes} onChange={e => setNotes(e.target.value)} className={input} rows={3} /></label><button disabled={Boolean(busy)} className={button}>{busy === 'save' ? 'Saving...' : 'Save lead'}</button>
  </form>;
  return <div className="space-y-5">
    <nav aria-label="Lead views" className="flex items-center gap-1 sm:gap-2 border-b border-[#F1DDE9] pb-3">{[{ key: 'saved', label: `Saved leads (${leads.length})`, Icon: BookmarkCheck }, { key: 'discover', label: 'Discover', Icon: Compass }].map(({ key, label, Icon }) => <button key={key} type="button" className={`inline-flex items-center gap-1 sm:gap-2 rounded-xl px-2 sm:px-4 py-2 text-[10px] sm:text-xs font-bold whitespace-nowrap transition ${tab === key ? 'bg-[#FF7AB3] text-white shadow-xs' : 'border border-[#F1DDE9] bg-white text-[#736A6D] hover:bg-[#FAF7F9]'}`} aria-pressed={tab === key} onClick={() => { setTab(key); setMessage(''); }}><Icon className="h-3.5 w-3.5 shrink-0" />{label}</button>)}<button type="button" aria-haspopup="dialog" onClick={() => { setMessage(''); quickAddDialog.current?.showModal(); }} className="inline-flex items-center gap-1 sm:gap-2 whitespace-nowrap rounded-xl border border-[#F1DDE9] bg-[#FFF0F6] px-2 sm:px-4 py-2 text-[10px] sm:text-xs font-bold text-[#9D3C5E]"><Plus className="h-3.5 w-3.5 shrink-0" />Quick Add</button></nav>
    {message && <p role="status" className="rounded-xl bg-[#FFF0F6] p-3 text-sm text-[#9D3C5E]">{message}</p>}
    {tab === 'saved' ? <>
      <label className="flex items-center gap-2"><Search className="h-4 w-4 text-[#FF7AB3]" /><input aria-label="Search saved leads" value={query} onChange={e => setQuery(e.target.value)} className={input} placeholder="Search role or company" /></label>
      <div className="grid max-sm:grid-cols-1 gap-3.5 md:grid-cols-2 lg:grid-cols-3">{shown.map(app => <article key={app.id} className="flex max-sm:min-w-0 max-sm:break-words flex-col justify-between space-y-3 rounded-2xl border border-[#F1DDE9] bg-white p-4.5 transition hover:border-[#FF7AB3] hover:shadow-xs">
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
            <button type="button" aria-label={`View profile fit for ${app.role_title} at ${app.company_name}`} onClick={() => onSelectLead?.(app)} className="rounded-full cursor-pointer transition hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF7AB3] focus-visible:ring-offset-2"><RoleFitBadge app={app} /></button>
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
      {!shown.length && <p className="text-sm text-[#736A6D]">{leads.length ? 'No leads match your search.' : 'No saved leads yet. Use Quick Add to save a real posting.'}</p>}
    </> : null}
    <div hidden={tab !== 'discover'} className="space-y-5">
      <JobDiscoveryHub key={currentUser?.id || 'signed-out'} currentUser={currentUser} />
    </div>
    <dialog ref={quickAddDialog} aria-labelledby="quick-add-lead-title" onClick={event => { if (event.target === event.currentTarget) quickAddDialog.current?.close(); }} className="m-auto w-[calc(100%-2rem)] max-w-2xl max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl border border-[#F1DDE9] p-0 text-[#4A3E44] shadow-2xl backdrop:bg-black/35 backdrop:backdrop-blur-xs">{quickAdd}</dialog>
  </div>;
}
