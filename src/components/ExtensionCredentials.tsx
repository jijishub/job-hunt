'use client';
import { useEffect, useState } from 'react';
type Credential = { id: string; label: string; expires_at: string; revoked_at: string | null };
export default function ExtensionCredentials() {
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [label, setLabel] = useState('Job Hunt extension');
  const [token, setToken] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [observedAt, setObservedAt] = useState(0);
  const refresh = async () => {
    const response = await fetch('/api/extension-credentials', { cache: 'no-store' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || 'Could not load extension connections.');
    setObservedAt(Date.now()); setCredentials(data.data);
  };
  useEffect(() => { let active = true;
    fetch('/api/extension-credentials', { cache: 'no-store' }).then(async response => {
      const data = await response.json(); if (!response.ok) throw new Error(data.error?.message || 'Could not load extension connections.');
      if (active) { setObservedAt(Date.now()); setCredentials(data.data); }
    }).catch(error => { if (active) setMessage(error.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  return <section className="mt-4 rounded-xl border border-[#F1DDE9] p-3 text-xs" aria-label="Extension connection">
    <h3 className="font-semibold">Job Hunt extension</h3>
    <p className="mt-1 text-[#736A6D]">Create a credential to save captures and fit results from your extension. It expires in 24 hours.</p>
    <label className="mt-3 block">Connection label<input aria-label="Extension connection label" maxLength={100} value={label} onChange={e => setLabel(e.target.value)} className="mt-1 w-full rounded-lg border border-[#F1DDE9] p-2" /></label>
    <button type="button" disabled={busy || loading || !label.trim()} className="mt-2 rounded-lg bg-[#FFF0F5] px-3 py-2 font-semibold text-[#9D3C5E] disabled:opacity-50" onClick={async () => {
      setBusy(true); setMessage(''); setToken('');
      try { const response = await fetch('/api/extension-credentials', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ label }) });
        const data = await response.json(); if (!response.ok) throw new Error(data.error?.message || 'Could not create credential.');
        setToken(data.token); setObservedAt(Date.now()); setCredentials(current => [data.credential, ...current]);
      } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not create credential.'); }
      finally { setBusy(false); }
    }}>Create extension credential</button>
    {token && <div className="mt-3 rounded-lg bg-[#FFF5F8] p-3"><label className="block">Copy this credential now. It is shown once.<textarea aria-label="New extension credential" readOnly value={token} rows={3} autoComplete="off" spellCheck={false} className="mt-2 w-full break-all rounded border border-[#F1DDE9] p-2 font-mono" /></label>
      <button type="button" className="mt-2 font-semibold text-[#9D3C5E]" onClick={async () => { try { await navigator.clipboard.writeText(token); setMessage('Credential copied.'); } catch { setMessage('Select and copy the credential above.'); } }}>Copy credential</button>
      <button type="button" className="ml-4 font-semibold text-[#9D3C5E]" onClick={() => setToken('')}>Hide credential</button></div>}
    <ul className="mt-3 space-y-2">{credentials.map(c => <li key={c.id} className="flex items-center justify-between gap-3"><span className="min-w-0 break-words">{c.label}<span className="block text-[#736A6D]">{c.revoked_at ? 'Revoked' : Date.parse(c.expires_at) <= observedAt ? 'Expired' : `Expires ${new Date(c.expires_at).toLocaleString()}`}</span></span>
      {!c.revoked_at && <button type="button" disabled={busy} className="shrink-0 font-semibold text-[#9D3C5E]" aria-label={`Revoke ${c.label}`} onClick={async () => { setBusy(true); setMessage(''); setToken('');
        try { const response = await fetch(`/api/extension-credentials?id=${encodeURIComponent(c.id)}`, { method: 'DELETE' }); const data = await response.json(); if (!response.ok) throw new Error(data.error?.message || 'Could not revoke credential.'); await refresh(); }
        catch (error) { setMessage(error instanceof Error ? error.message : 'Could not revoke credential.'); } finally { setBusy(false); }
      }}>Revoke</button>}</li>)}</ul>
    {message && <p role="status" className="mt-2 text-[#9D3C5E]">{message}</p>}
  </section>;
}
