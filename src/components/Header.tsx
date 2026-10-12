'use client';

import React, { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { useSession, signIn, signOut } from 'next-auth/react';
import {
  RefreshCw,
  Plus,
  Settings,
  Users,
  ChevronDown,
  LogOut,
  LogIn,
  Database,
  KeyRound,
  Copy,
  Check,
} from 'lucide-react';
import { JobApplication, UserAccount } from '@/types/job';
import { JOB_JSON_PROMPT } from '@/lib/job-import';

interface HeaderProps {
  applications?: JobApplication[];
  onNewApp: () => void;
  onOpenPreferences: () => void;
  onOpenNotionSettings: () => void;
  onSyncNotion: () => void;
  isSyncing: boolean;
  notionStatus: any;
  users?: UserAccount[];
  currentUser: UserAccount | null;
  onSelectUser?: (user: UserAccount) => void;
  onOpenUserManagement: (tab?: 'accounts' | 'google') => void;
}

export default function Header({
  onNewApp,
  onOpenPreferences,
  onOpenNotionSettings,
  onSyncNotion,
  isSyncing,
  notionStatus,
  currentUser,
  onOpenUserManagement,
}: HeaderProps) {
  const sessionContext = useSession();
  const session = sessionContext?.data;
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [promptCopyState, setPromptCopyState] = useState<'idle' | 'copied' | 'error'>('idle');

  useEffect(() => {
    if (promptCopyState !== 'copied') return;
    const timer = setTimeout(() => setPromptCopyState('idle'), 2500);
    return () => clearTimeout(timer);
  }, [promptCopyState]);

  const copyGeminiPrompt = async () => {
    try {
      await navigator.clipboard.writeText(JOB_JSON_PROMPT);
      setPromptCopyState('copied');
    } catch {
      setPromptCopyState('error');
    }
  };

  const isNotionConnected = notionStatus?.configured && notionStatus?.status?.success;

  // Active user details
  const activeName = (session?.user?.name || currentUser?.name || 'Admin').replace(/\s*\(Ji\)/gi, '').trim();
  const activeEmail = session?.user?.email || currentUser?.email || '';
  const activeRole = (session?.user as any)?.role || currentUser?.role || 'member';
  const isAdmin = activeRole === 'admin';
  const activeIndustry = (session?.user as any)?.industry || currentUser?.industry || (isAdmin ? 'IT / Software' : 'General');
  const activeAvatar = session?.user?.image || currentUser?.avatar || (isAdmin ? '🌸' : '✨');
  const isAvatarUrl = activeAvatar?.startsWith('http') || activeAvatar?.startsWith('/');

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="border-b border-[#F1DDE9] bg-white/85 backdrop-blur-md sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        {/* Left: Brand & Status */}
        <div className="flex min-w-0 items-center gap-3">
          <Image src="/job-hunt official text.png" alt="Job Hunt" width={180} height={60} loading="eager" className="w-36 sm:w-44 h-auto object-contain" />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">

              {/* RBAC Notion Status vs Member Cloud DB Status */}
              {isAdmin ? (
                <button
                  onClick={onOpenNotionSettings}
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border transition ${
                    isNotionConnected
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                      : notionStatus?.configured
                      ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                      : 'bg-rose-50 text-[#9D3C5E] border-[#F1DDE9] hover:bg-rose-100'
                  }`}
                  title="Notion 2-Way Live Sync (Administrator Only)"
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
              ) : (
                <div
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border bg-purple-50 text-purple-700 border-purple-200"
                  title="Member accounts are stored securely in Cloud DB without Notion sync"
                >
                  <Database className="w-3 h-3 text-purple-600" />
                  <span>Cloud DB</span>
                </div>
              )}
            </div>

            <p className="text-xs text-[#736A6D]">
              {isAdmin
                ? 'Admin mode: 2-way Notion DB & live portfolio sync'
                : `Member pipeline: ${activeIndustry} focus`}
            </p>
          </div>
        </div>

        {/* Right: Actions, RBAC Switcher & User Account */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Admin Notion Sync Buttons */}
          {isAdmin && (
            <>
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
                type="button"
                onClick={onOpenNotionSettings}
                aria-label="Notion settings"
                title="Notion Credentials & Settings"
                className="p-2 text-[#736A6D] hover:text-[#9D3C5E] hover:bg-[#FAF7F9] border border-[#F1DDE9] rounded-xl transition"
              >
                {/* Notion brand mark from Simple Icons (CC0). */}
                <svg aria-hidden="true" viewBox="0 0 24 24" className="w-4 h-4 text-black" fill="currentColor">
                  <path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.981-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.167V6.354c0-.606-.233-.933-.748-.887l-15.177.887c-.56.047-.747.327-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.748 0-.935-.234-1.495-.933l-4.577-7.186v6.952L12.21 19s0 .84-1.168.84l-3.222.186c-.093-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.215-.139c-.093-.514.28-.887.747-.933zM1.936 1.035l13.31-.98c1.634-.14 2.055-.047 3.082.7l4.249 2.986c.7.513.934.653.934 1.213v16.378c0 1.026-.373 1.634-1.68 1.726l-15.458.934c-.98.047-1.448-.093-1.962-.747l-3.129-4.06c-.56-.747-.793-1.306-.793-1.96V2.667c0-.839.374-1.54 1.447-1.632z" />
                </svg>
              </button>
            </>
          )}

          <button type="button" onClick={onOpenPreferences} className="inline-flex items-center gap-1.5 rounded-xl border border-[#F1DDE9] bg-white px-3 py-2 text-xs font-semibold text-[#9D3C5E]"><Settings className="w-3.5 h-3.5" />My preferences</button>

          {/* New Application CTA */}
          <button
            onClick={onNewApp}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#FF7AB3] hover:bg-[#F06292] rounded-xl shadow-xs transition"
          >
            <Plus className="w-4 h-4" />
            <span>New App</span>
          </button>

          <div className="relative">
            <button type="button" onClick={copyGeminiPrompt} aria-label="Copy Gemini job JSON extraction prompt" title="Copy Gemini job JSON extraction prompt" className="inline-flex items-center gap-1.5 rounded-xl border border-[#F1DDE9] bg-white px-2.5 py-2 text-xs font-semibold text-[#9D3C5E] hover:bg-[#FFF0F6] transition">
              {promptCopyState === 'copied' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              <span aria-live="polite">{promptCopyState === 'copied' ? 'Copied!' : 'Copy Prompt'}</span>
            </button>
            {promptCopyState === 'error' && <div className="absolute right-0 z-50 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-xl border border-[#F1DDE9] bg-white p-3 shadow-xl">
              <p role="alert" className="text-xs text-[#736A6D]">Clipboard access failed. Select and copy the prompt below.</p>
              <textarea aria-label="Gemini extraction prompt" readOnly value={JOB_JSON_PROMPT} rows={5} onFocus={event => event.target.select()} className="mt-2 w-full rounded-lg border border-[#F1DDE9] p-2 text-xs" />
              <button type="button" onClick={() => setPromptCopyState('idle')} className="mt-2 text-xs font-semibold text-[#9D3C5E]">Dismiss</button>
            </div>}
          </div>
          {/* Dynamic User & Account Switcher Dropdown */}
          <div className="relative max-sm:ml-auto" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-[#F1DDE9] bg-white hover:bg-[#FAF7F9] transition text-left shadow-2xs"
            >
              <div className="w-7 h-7 rounded-lg bg-[#FAF7F9] flex items-center justify-center text-xs border border-[#F1DDE9] overflow-hidden shrink-0">
                {isAvatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={activeAvatar}
                    alt={activeName}
                    className="w-full h-full object-cover rounded-lg"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <span>{activeAvatar}</span>
                )}
              </div>
              <div className="hidden sm:block">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-[#4A3E44] max-w-[110px] truncate">
                    {activeName}
                  </span>
                  <span
                    className={`text-[9px] font-bold px-1.5 py-0.2 rounded-md uppercase ${
                      isAdmin ? 'bg-[#FFF0F6] text-[#9D3C5E]' : 'bg-stone-100 text-stone-600'
                    }`}
                  >
                    {activeRole}
                  </span>
                </div>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-stone-400" />
            </button>

            {/* Dropdown Menu */}
            {dropdownOpen && (
              <div className="absolute right-0 mt-2 w-72 max-w-[calc(100vw-2rem)] max-h-[70dvh] overflow-y-auto rounded-2xl bg-white border border-[#F1DDE9] shadow-xl p-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                {/* Active Profile Info */}
                <div className="p-3 bg-[#FAF7F9] rounded-xl border border-[#F1DDE9]/60 mb-2">
                  <div className="flex items-center gap-2.5 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-white border border-[#F1DDE9] flex items-center justify-center text-xs overflow-hidden shrink-0">
                      {isAvatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={activeAvatar}
                          alt={activeName}
                          className="w-full h-full object-cover rounded-lg"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <span>{activeAvatar}</span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[#4A3E44] truncate">{activeName}</span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            isAdmin
                              ? 'bg-[#FFF0F6] text-[#9D3C5E] border-[#F1DDE9]'
                              : 'bg-stone-50 text-stone-600 border-stone-200'
                          }`}
                        >
                          {isAdmin ? 'ADMIN' : 'MEMBER'}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#736A6D] truncate mt-0.5">{activeEmail}</p>
                    </div>
                  </div>
                  <p className="text-[10px] text-[#9D3C5E] font-medium pt-1 border-t border-[#F1DDE9]/40">Focus: {activeIndustry}</p>
                </div>

                {/* Workspace Access Note */}
                <div className="px-3 py-2 bg-stone-50 rounded-xl text-[11px] text-[#736A6D] border border-stone-200/60 my-2">
                  <span className="font-semibold text-[#4A3E44] block">🔒 Google SSO Invite-Only</span>
                  <span>Only accounts invited by Admin can access this workspace.</span>
                </div>

                {/* Admin Accounts Management Link */}
                {isAdmin && (
                  <div className="pt-2 border-t border-[#F1DDE9] space-y-1">
                    <button
                      onClick={() => {
                        setDropdownOpen(false);
                        onOpenUserManagement('accounts');
                      }}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-[#9D3C5E] hover:bg-[#FFF0F6] rounded-xl transition"
                    >
                      <Users className="w-3.5 h-3.5" />
                      <span>Manage Accounts & RBAC</span>
                    </button>
                    <button
                      onClick={() => {
                        setDropdownOpen(false);
                        onOpenUserManagement('google');
                      }}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-[#736A6D] hover:text-[#9D3C5E] hover:bg-[#FFF0F6] rounded-xl transition"
                    >
                      <KeyRound className="w-3.5 h-3.5 text-[#FF7AB3]" />
                      <span>Google SSO Credentials</span>
                    </button>
                  </div>
                )}

                {/* Google Sign-In & Sign-Out */}
                <div className="pt-2 mt-1 border-t border-[#F1DDE9]/60">
                  {session ? (
                    <button
                      onClick={() => signOut()}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-rose-600 hover:bg-rose-50 rounded-xl transition"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Sign Out</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => signIn('google')}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-[#4A3E44] hover:bg-[#FAF7F9] rounded-xl transition font-medium"
                    >
                      <LogIn className="w-3.5 h-3.5 text-[#FF7AB3]" />
                      <span>Sign In with Google</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
