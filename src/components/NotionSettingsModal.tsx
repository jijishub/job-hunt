'use client';

import React, { useState, useEffect } from 'react';
import { X, RefreshCw, CheckCircle2, AlertCircle, ExternalLink, Copy, Check, Sparkles } from 'lucide-react';

interface NotionSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSyncTrigger: () => Promise<void>;
}

export default function NotionSettingsModal({
  isOpen,
  onClose,
  onSyncTrigger,
}: NotionSettingsModalProps) {
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [statusData, setStatusData] = useState<any>(null);
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [syncResult, setSyncResult] = useState<any>(null);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/notion/sync');
      const data = await res.json();
      setStatusData(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchStatus();
      setSyncResult(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleManualSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/notion/sync', { method: 'POST' });
      const data = await res.json();
      setSyncResult(data);
      await onSyncTrigger();
      await fetchStatus();
    } catch (e: any) {
      setSyncResult({ success: false, error: e.message });
    } finally {
      setSyncing(false);
    }
  };

  const webhookUrl = typeof window !== 'undefined' ? `${window.location.origin}/api/notion/webhook` : '/api/notion/webhook';

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedWebhook(true);
    setTimeout(() => setCopiedWebhook(false), 2000);
  };

  const isConnected = statusData?.configured && statusData?.status?.success;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-xl bg-white rounded-2xl shadow-xl border border-[#F1DDE9] max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#F1DDE9] bg-gradient-to-r from-[#FFF5F8] to-[#FFF]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#FCE7F3] flex items-center justify-center text-[#9D3C5E]">
              <Sparkles className="w-4 h-4 text-[#FF7AB3]" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-[#4A3E44]">
                Notion 2-Way Live Sync
              </h2>
              <p className="text-xs text-[#736A6D]">Sync applications & leads between Vercel & Notion</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6 text-sm text-[#4A3E44]">
          <div
            className={`p-4 rounded-xl border transition ${
              isConnected
                ? 'bg-emerald-50/70 border-emerald-200'
                : statusData?.configured
                ? 'bg-amber-50/70 border-amber-200'
                : 'bg-rose-50/70 border-[#F1DDE9]'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                {isConnected ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-[#FF7AB3] mt-0.5 shrink-0" />
                )}
                <div>
                  <h3 className="text-sm font-semibold text-[#4A3E44]">
                    {isConnected
                      ? `Connected to Notion: "${statusData?.status?.databaseTitle || 'Job Tracker'}"`
                      : statusData?.configured
                      ? 'Notion Configured but Connection Failed'
                      : 'Notion Credentials Not Connected Yet'}
                  </h3>
                  <p className="text-xs text-[#736A6D] mt-0.5">
                    {isConnected
                      ? 'Live 2-way sync is active. Both platforms receive events seamlessly.'
                      : statusData?.status?.message ||
                        'Add your Notion Integration Secret and Database ID to .env or Vercel Environment Variables.'}
                  </p>
                </div>
              </div>
              <button
                onClick={fetchStatus}
                disabled={loading}
                title="Refresh Status"
                className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg hover:bg-white/80 transition"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            <div className="mt-4 pt-3 border-t border-[#F1DDE9]/60 flex items-center justify-between">
              <span className="text-xs text-[#736A6D]">
                Database ID: <code className="bg-white px-1.5 py-0.5 rounded border border-[#F1DDE9] font-mono text-[11px]">{statusData?.databaseId || 'Not set'}</code>
              </span>
              <button
                onClick={handleManualSync}
                disabled={syncing || !statusData?.configured}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-[#FF7AB3] hover:bg-[#F06292] rounded-lg transition disabled:opacity-50 shadow-xs"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? 'Syncing...' : 'Sync Now'}
              </button>
            </div>

            {syncResult && (
              <div className="mt-3 p-2.5 rounded-lg bg-white border border-[#F1DDE9] text-xs">
                {syncResult.success ? (
                  <p className="text-emerald-700 font-medium">
                    ✓ Sync completed! Pulled {syncResult.pulled} records from Notion, pushed {syncResult.pushed} records.
                  </p>
                ) : (
                  <p className="text-rose-600 font-medium">
                    ✕ Sync error: {syncResult.error || syncResult.message}
                  </p>
                )}
              </div>
            )}
          </div>

          <div>
            <h4 className="text-xs font-semibold text-[#736A6D] uppercase tracking-wider mb-2">
              Instant Webhook Endpoint (For Notion Live Push)
            </h4>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={webhookUrl}
                className="w-full px-3 py-2 text-xs font-mono bg-stone-50 border border-[#F1DDE9] rounded-xl text-stone-700 select-all"
              />
              <button
                type="button"
                onClick={() => copyToClipboard(webhookUrl)}
                className="inline-flex items-center gap-1 px-3 py-2 text-xs font-medium text-[#9D3C5E] bg-[#FCE7F3] hover:bg-[#F5BEDB] rounded-xl transition shrink-0"
              >
                {copiedWebhook ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedWebhook ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <p className="text-[11px] text-[#736A6D] mt-1.5">
              Paste this URL in Notion Webhooks or automation (Zapier / Make / Notion native) to trigger live push whenever a page is edited in Notion.
            </p>
          </div>

          <div className="space-y-3 pt-2 border-t border-[#F1DDE9]">
            <h4 className="text-xs font-semibold text-[#736A6D] uppercase tracking-wider">
              How to Connect Your Notion in 3 Simple Steps:
            </h4>
            <ol className="space-y-2.5 text-xs text-[#54494B] list-decimal list-inside">
              <li>
                <span className="font-semibold">Create Notion Integration:</span> Go to{' '}
                <a
                  href="https://www.notion.so/my-integrations"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[#FF7AB3] hover:underline inline-flex items-center gap-0.5"
                >
                  notion.so/my-integrations <ExternalLink className="w-3 h-3" />
                </a>{' '}
                and create an internal integration named &quot;Job Tracker&quot;. Copy the <code>Secret API Key</code>.
              </li>
              <li>
                <span className="font-semibold">Share your Database:</span> Open your Notion Job Hunt database, click <code>··· (top right)</code> &rarr; <code>Connect to</code> &rarr; select &quot;Job Tracker&quot;.
              </li>
              <li>
                <span className="font-semibold">Copy Database ID:</span> The 32-character string in your Notion database URL:
                <br />
                <code className="text-[11px] text-[#9D3C5E] bg-pink-50/80 px-1 py-0.5 rounded mt-1 inline-block">
                  notion.so/workspace/<strong>[YOUR_DATABASE_ID]</strong>?v=...
                </code>
              </li>
            </ol>
          </div>

          <div className="p-3.5 rounded-xl bg-[#FAF7F9] border border-[#F1DDE9]">
            <h4 className="text-xs font-semibold text-[#4A3E44] mb-1.5">
              Recommended Notion Database Columns:
            </h4>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-[#736A6D]">
              <div>• <strong>Name</strong> (Title)</div>
              <div>• <strong>Company</strong> (Select or Text)</div>
              <div>• <strong>Status</strong> (Select)</div>
              <div>• <strong>Priority</strong> (Select)</div>
              <div>• <strong>Work Model</strong> (Select)</div>
              <div>• <strong>Salary</strong> (Text)</div>
              <div>• <strong>Job URL</strong> (URL)</div>
              <div>• <strong>Date Applied</strong> (Date)</div>
            </div>
          </div>
        </div>

        <div className="px-6 py-3 border-t border-[#F1DDE9] bg-stone-50 flex items-center justify-between text-xs text-[#736A6D]">
          <span>Add keys to <code>.env.local</code> or Vercel Environment Variables</span>
          <button
            onClick={onClose}
            className="px-4 py-2 font-medium text-white bg-[#FF7AB3] hover:bg-[#F06292] rounded-xl transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

