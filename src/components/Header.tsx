'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';
import {
  RefreshCw,
  Plus,
  Settings,
  ShieldCheck,
  User,
  Users,
  ChevronDown,
  LogOut,
  LogIn,
  Check,
  Database,
  KeyRound,
} from 'lucide-react';
import { JobApplication, UserAccount } from '@/types/job';

interface HeaderProps {
  applications?: JobApplication[];
  onNewApp: () => void;
  onOpenNotionSettings: () => void;
  onSyncNotion: () => void;
  isSyncing: boolean;
  notionStatus: any;
  users: UserAccount[];
  currentUser: UserAccount | null;
  onSelectUser: (user: UserAccount) => void;
  onOpenUserManagement: (tab?: 'accounts' | 'google') => void;
}

export default function Header({
  onNewApp,
  onOpenNotionSettings,
  onSyncNotion,
  isSyncing,
  notionStatus,
  users,
  currentUser,
  onSelectUser,
  onOpenUserManagement,
}: HeaderProps) {
  const sessionContext = useSession();
  const session = sessionContext?.data;
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isNotionConnected = notionStatus?.configured && notionStatus?.status?.success;

  // Active user details
  const activeName = (session?.user?.name || currentUser?.name || 'Admin').replace(/\s*\(Ji\)/gi, '').trim();
  const activeEmail = session?.user?.email || currentUser?.email || '';
  const activeRole = (session?.user as any)?.role || currentUser?.role || 'admin';
  const isAdmin = activeRole === 'admin';
  const activeIndustry = (session?.user as any)?.industry || currentUser?.industry || (isAdmin ? 'IT / Software' : 'General');
  const activeAvatar = currentUser?.avatar || (isAdmin ? '🌸' : '✨');

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
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#FFB8CA] to-[#FF7AB3] text-white flex items-center justify-center text-xl shadow-xs shrink-0">
            {activeAvatar}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-bold text-[#4A3E44] tracking-tight">
                Job Hunt & Leads
              </h1>

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
                ? 'Admin mode: 2-way Notion database & live portfolio discovery'
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
                onClick={onOpenNotionSettings}
                title="Notion Credentials & Settings"
                className="p-2 text-[#736A6D] hover:text-[#9D3C5E] hover:bg-[#FAF7F9] border border-[#F1DDE9] rounded-xl transition"
              >
                <Settings className="w-4 h-4" />
              </button>
            </>
          )}

          {/* New Application CTA */}
          <button
            onClick={onNewApp}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#FF7AB3] hover:bg-[#F06292] rounded-xl shadow-xs transition"
          >
            <Plus className="w-4 h-4" />
            <span>New App</span>
          </button>

          {/* Dynamic User & Account Switcher Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-[#F1DDE9] bg-white hover:bg-[#FAF7F9] transition text-left shadow-2xs"
            >
              <div className="w-6 h-6 rounded-lg bg-[#FAF7F9] flex items-center justify-center text-xs border border-[#F1DDE9]">
                {activeAvatar}
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
              <div className="absolute right-0 mt-2 w-72 rounded-2xl bg-white border border-[#F1DDE9] shadow-xl p-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                {/* Active Profile Info */}
                <div className="p-3 bg-[#FAF7F9] rounded-xl border border-[#F1DDE9]/60 mb-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#4A3E44] truncate">{activeName}</span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        isAdmin
                          ? 'bg-[#FFF0F6] text-[#9D3C5E] border-[#F1DDE9]'
                          : 'bg-stone-50 text-stone-600 border-stone-200'
                      }`}
                    >
                      {isAdmin ? '👑 ADMIN' : '👤 MEMBER'}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#736A6D] truncate mt-0.5">{activeEmail}</p>
                  <p className="text-[10px] text-[#9D3C5E] font-medium mt-1">Focus: {activeIndustry}</p>
                </div>

                {/* Provisioned Accounts Switcher */}
                <div className="px-2 py-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
                    Switch Account / Persona
                  </span>
                </div>

                <div className="space-y-1 my-1 max-h-48 overflow-y-auto">
                  {users.map((u) => {
                    const isSelected = (currentUser?.id || users[0]?.id) === u.id;
                    return (
                      <button
                        key={u.id}
                        onClick={() => {
                          onSelectUser(u);
                          setDropdownOpen(false);
                        }}
                        className={`w-full flex items-center justify-between p-2 rounded-xl text-xs transition ${
                          isSelected
                            ? 'bg-[#FFF0F6] text-[#9D3C5E] font-bold'
                            : 'hover:bg-[#FAF7F9] text-[#4A3E44]'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <span>{u.avatar || '👤'}</span>
                          <span className="truncate">{u.name.replace(/\s*\(Ji\)/gi, '').trim()}</span>
                          <span className="text-[10px] text-stone-400 font-normal">
                            ({u.role})
                          </span>
                        </div>
                        {isSelected && <Check className="w-3.5 h-3.5 text-[#FF7AB3]" />}
                      </button>
                    );
                  })}
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
