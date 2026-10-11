'use client';
import { useEffect, useState } from 'react';

export default function CandidateProfileEditor({ expanded = false }: { expanded?: boolean }) {
  const [text, setText] = useState('');
  const [message, setMessage] = useState('Loading your saved resume…');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    fetch('/api/profile').then(response => response.json()).then(data => {
      if (!data.success) throw new Error(data.error);
      setText(data.resumeText); setMessage(data.resumeText ? 'Your account resume is ready for analysis.' : 'Add your resume to enable AI fit analysis.');
    }).catch(error => setMessage(error.message));
  }, []);
  async function save(resumeText: string) {
    const response = await fetch('/api/profile', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ resumeText }) });
    const data = await response.json(); if (!response.ok) throw new Error(data.error);
    setMessage('Resume saved to your account. New analyses will use this version.');
  }
  return (
    <section className="rounded-xl border border-[#F1DDE9] bg-[#FFF5F8] p-3 text-xs">
      <h3 className="font-semibold text-[#9D3C5E]">Resume used for fit analysis</h3>
      <p className="my-2 text-[#736A6D]" role="status">{message}</p>
      <label className="block mb-2">Upload a resume PDF
        <input type="file" accept="application/pdf,.pdf" disabled={busy} className="mt-2 block w-full cursor-pointer rounded-lg text-xs text-[#736A6D] file:mr-3 file:cursor-pointer file:rounded-lg file:border file:border-[#9D3C5E] file:bg-[#9D3C5E] file:px-4 file:py-2 file:text-xs file:font-semibold file:text-white file:shadow-sm hover:file:border-[#7D2D49] hover:file:bg-[#7D2D49] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF7AB3] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 disabled:file:cursor-not-allowed" onChange={async event => {
          const file = event.target.files?.[0]; if (!file) return;
          setBusy(true);
          try {
            const body = new FormData(); body.append('file', file);
            const response = await fetch('/api/resume/parse-pdf', { method: 'POST', body });
            const data = await response.json(); if (!response.ok || !data.success) throw new Error(data.error || 'PDF extraction failed.');
            setText(data.text); await save(data.text);
          } catch (error) { setMessage(error instanceof Error ? error.message : 'Resume upload failed.'); }
          finally { setBusy(false); }
        }} />
      </label>
      <label className="block">Resume text<textarea aria-label="Account resume text" rows={5} value={text} onChange={event => setText(event.target.value)} className="mt-1 w-full rounded-lg border border-[#F1DDE9] p-2 bg-white" /></label>
      <button type="button" disabled={busy || !text.trim()} onClick={async () => { setBusy(true); try { await save(text); } catch (error) { setMessage(error instanceof Error ? error.message : 'Save failed.'); } finally { setBusy(false); } }} className="mt-2 cursor-pointer rounded-lg border border-[#9D3C5E] bg-[#9D3C5E] px-4 py-2 font-semibold text-white shadow-sm transition hover:border-[#7D2D49] hover:bg-[#7D2D49] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF7AB3] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">{busy ? 'Saving…' : 'Save resume'}</button>
    </section>
  );
}
