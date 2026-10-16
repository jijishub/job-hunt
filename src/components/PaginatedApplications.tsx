'use client';
import { useEffect, useState } from 'react';
import ApplicationTable from './ApplicationTable';
import type { JobApplication } from '@/types/job';

export default function PaginatedApplications(props: React.ComponentProps<typeof ApplicationTable>) {
  const [page,setPage] = useState(0);
  const [remote,setRemote] = useState<{ key: string; data: JobApplication[] } | null>(null);
  const [error,setError] = useState('');
  const pageSize = 25;
  const signature = JSON.stringify(props.applications.map(app => [app.id,app.updated_at]));
  const lastPage = Math.max(0, Math.ceil(props.applications.length/pageSize)-1);
  const current = Math.min(page,lastPage);
  const key = `${signature}:${current}`;
  useEffect(() => { setPage(0); },[signature]);
  useEffect(() => {
    if (props.applications.length <= pageSize) return;
    const controller = new AbortController(); setError('');
    fetch('/api/applications/list', { method: 'POST', signal: controller.signal, headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ ids: props.applications.map(app => app.id), offset: current*pageSize, limit: pageSize }) }).then(r => r.json()).then(result => {
      if (!result.success) throw new Error(result.error || 'Could not load this page.');
      if (result.paged && Array.isArray(result.data)) setRemote({ key, data: result.data });
    }).catch(error => { if (error.name !== 'AbortError') setError(error.message); });
    return () => controller.abort();
  // The signature captures both ordering and updates without rerunning on render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[key]);
  const localPage = props.applications.slice(current*pageSize,(current+1)*pageSize);
  return <div className="space-y-3">
    {error && <p role="alert" className="text-xs text-rose-700">{error} Showing the saved list snapshot.</p>}
    <ApplicationTable {...props} applications={remote?.key === key ? remote.data : localPage} />
    {props.applications.length>pageSize && <nav aria-label="Application pages" className="flex items-center justify-end gap-3 text-xs text-[#736A6D]">
      <button type="button" disabled={current===0} onClick={() => setPage(current-1)} className="rounded-xl border border-[#F1DDE9] bg-white px-3 py-2 disabled:opacity-40">Previous</button>
      <span>Page {current+1} of {lastPage+1} · {props.applications.length} applications</span>
      <button type="button" disabled={current===lastPage} onClick={() => setPage(current+1)} className="rounded-xl border border-[#F1DDE9] bg-white px-3 py-2 disabled:opacity-40">Next</button>
    </nav>}
  </div>;
}
