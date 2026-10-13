'use client';

import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';

export default function DeploymentNotice() {
  const [updated, setUpdated] = useState(false);
  useEffect(() => {
    const current = process.env.NEXT_PUBLIC_APP_VERSION;
    if (!current) return;
    const controller = new AbortController();
    let checking = false, detected = false;
    const check = async () => {
      if (checking || detected || document.visibilityState === 'hidden') return;
      checking = true;
      try {
        const response = await fetch('/api/version', { cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(5000)]) });
        if (!response.ok) return;
        const data = await response.json();
        if (!controller.signal.aborted && typeof data.version === 'string' && data.version && data.version !== current) {
          detected = true; setUpdated(true);
        }
      } catch { /* A failed version check must not interrupt the user's work. */ }
      finally { checking = false; }
    };
    void check();
    const timer = setInterval(check, 60000);
    window.addEventListener('focus', check);
    window.addEventListener('online', check);
    document.addEventListener('visibilitychange', check);
    return () => {
      controller.abort(); clearInterval(timer);
      window.removeEventListener('focus', check);
      window.removeEventListener('online', check);
      document.removeEventListener('visibilitychange', check);
    };
  }, []);
  if (!updated) return null;
  return <div role="alert" className="fixed inset-x-0 bottom-0 z-40 border-t border-[#E9B8CD] bg-[#FFF0F6] px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-lg">
    <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-[#4A3E44]"><strong>Job Hunt has been updated.</strong> Save your draft, then reload to continue with the latest version.</p>
      <button type="button" onClick={() => window.location.reload()} className="inline-flex items-center gap-2 rounded-xl bg-[#9D3C5E] px-4 py-2 text-sm font-semibold text-white"><RefreshCw aria-hidden="true" className="h-4 w-4" />Reload now</button>
    </div>
  </div>;
}
