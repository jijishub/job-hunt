'use client';

import React from 'react';
import {
  RefreshCw,
  Plus,
  Settings,
} from 'lucide-react';
import { JobApplication } from '@/types/job';

interface HeaderProps {
  applications?: JobApplication[];
  onNewApp: () => void;
  onOpenNotionSettings: () => void;
  onSyncNotion: () => void;
  isSyncing: boolean;
  notionStatus: any;
}

export default function Header({
  onNewApp,
  onOpenNotionSettings,
  onSyncNotion,
  isSyncing,
  notionStatus,
}: HeaderProps) {
  const isNotionConnected = notionStatus?.configured && notionStatus?.status?.success;

  return (
    <header className="border-b border-[#F1DDE9] bg-white/80 backdrop-blur-md sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#FFB8CA] to-[#FF7AB3] text-white flex items-center justify-center text-xl shadow-xs shrink-0">
            🌸
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-[#4A3E44] tracking-tight">
                Job Hunt & Leads
              </h1>
              <button
                onClick={onOpenNotionSettings}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border transition ${
                  isNotionConnected
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                    : notionStatus?.configured
                    ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                    : 'bg-rose-50 text-[#9D3C5E] border-[#F1DDE9] hover:bg-rose-100'
                }`}
                title="Click to view Notion Sync settings"
              >
                {isNotionConnected ? (
                  <>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span>Notion Live</span>
                  </>
                ) : (
                  <>
                    <span className="w-1.5 h-1.5 rounded-full bg-[#FF7AB3]" />
                    <span>Connect Notion</span>
                  </>
                )}
              </button>
            </div>
            <p className="text-xs text-[#736A6D]">Personal career pipeline & Notion live database</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onSyncNotion}
            disabled={isSyncing}
            title="Sync with Notion"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-[#9D3C5E] bg-[#FFF0F6] hover:bg-[#FCE7F3] border border-[#F1DDE9] rounded-xl transition shadow-2xs disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{isSyncing ? 'Syncing...' : 'Sync Notion'}</span>
          </button>

          <button
            onClick={onOpenNotionSettings}
            title="Notion Credentials & Settings"
            className="p-2 text-[#736A6D] hover:text-[#9D3C5E] hover:bg-[#FAF7F9] border border-[#F1DDE9] rounded-xl transition"
          >
            <Settings className="w-4 h-4" />
          </button>

          <button
            onClick={onNewApp}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#FF7AB3] hover:bg-[#F06292] rounded-xl shadow-xs transition"
          >
            <Plus className="w-4 h-4" />
            <span>New Application</span>
          </button>
        </div>
      </div>
    </header>
  );
}
