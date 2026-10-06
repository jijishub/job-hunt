'use client';

import React, { useState, useEffect } from 'react';
import { UserAccount, UserRole } from '@/types/job';
import {
  X,
  UserPlus,
  ShieldCheck,
  User,
  Trash2,
  Edit3,
  Sparkles,
  Building,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  ExternalLink,
  Copy,
  Check,
  Eye,
  EyeOff,
  RotateCcw,
} from 'lucide-react';

interface UserManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  users: UserAccount[];
  onRefreshUsers: () => Promise<void>;
  currentUserId?: string;
  initialTab?: 'accounts' | 'google';
}

export default function UserManagementModal({
  isOpen,
  onClose,
  users,
  onRefreshUsers,
  currentUserId,
  initialTab = 'accounts',
}: UserManagementModalProps) {
  const [activeTab, setActiveTab] = useState<'accounts' | 'google'>('accounts');

  // Account Form State (Create & Edit)
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>('member');
  const [industry, setIndustry] = useState('Hospitality Management');
  const [customIndustry, setCustomIndustry] = useState('');
  const [avatar, setAvatar] = useState('✨');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Google SSO Settings State
  const [googleClientId, setGoogleClientId] = useState('');
  const [googleClientSecret, setGoogleClientSecret] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [isGoogleConfigured, setIsGoogleConfigured] = useState(false);
  const [redirectUri, setRedirectUri] = useState('http://localhost:3000/api/auth/callback/google');
  const [originUrl, setOriginUrl] = useState('http://localhost:3000');
  const [isSavingGoogle, setIsSavingGoogle] = useState(false);
  const [googleSuccess, setGoogleSuccess] = useState<string | null>(null);
  const [googleError, setGoogleError] = useState<string | null>(null);
  const [copiedRedirect, setCopiedRedirect] = useState(false);
  const [copiedOrigin, setCopiedOrigin] = useState(false);

  const fetchGoogleSettings = async () => {
    try {
      const res = await fetch('/api/settings/google');
      const data = await res.json();
      if (data.success) {
        setIsGoogleConfigured(data.isConfigured);
        if (data.clientId) setGoogleClientId(data.clientId);
        if (data.redirectUri) setRedirectUri(data.redirectUri);
        if (data.origin) setOriginUrl(data.origin);
      }
    } catch (e) {
      console.error('Failed to load Google settings:', e);
    }
  };

  useEffect(() => {
    if (isOpen) {
      if (initialTab && initialTab !== activeTab) {
        setActiveTab(initialTab);
      }
      fetchGoogleSettings();
      setErrorMessage(null);
      setSuccessMessage(null);
    }
  }, [isOpen, initialTab]);

  if (!isOpen) return null;

  const startEditing = (user: UserAccount) => {
    setEditingUser(user);
    setName(user.name);
    setEmail(user.email);
    setRole(user.role);
    setAvatar(user.avatar || (user.role === 'admin' ? '🌸' : '✨'));

    const predefined = [
      'Hospitality Management',
      'IT / AI & Software',
      'Marketing & Growth',
      'UI/UX & Design',
      'Finance & Accounting',
      'Healthcare',
    ];
    if (predefined.includes(user.industry || '')) {
      setIndustry(user.industry || 'Hospitality Management');
      setCustomIndustry('');
    } else {
      setIndustry('Other');
      setCustomIndustry(user.industry || '');
    }

    setErrorMessage(null);
    setSuccessMessage(null);
  };

  const cancelEditing = () => {
    setEditingUser(null);
    setName('');
    setEmail('');
    setRole('member');
    setIndustry('Hospitality Management');
    setCustomIndustry('');
    setAvatar('✨');
    setErrorMessage(null);
  };

  const handleSubmitUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      setErrorMessage('Name and Email are required.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const finalIndustry = industry === 'Other' ? customIndustry.trim() || 'General' : industry;

    try {
      if (editingUser) {
        // Edit existing user
        const res = await fetch(`/api/users/${editingUser.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: name.trim(),
            email: email.trim().toLowerCase(),
            role,
            industry: finalIndustry,
            avatar: avatar || (role === 'admin' ? '🌸' : '✨'),
            notion_enabled: role === 'admin',
          }),
        });
        const data = await res.json();
        if (!data.success) {
          throw new Error(data.error || 'Failed to update user account');
        }
        setSuccessMessage(`Account for "${name.trim()}" updated successfully!`);
        cancelEditing();
      } else {
        // Create net-new user
        const res = await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: name.trim(),
            email: email.trim().toLowerCase(),
            role,
            industry: finalIndustry,
            avatar: avatar || (role === 'admin' ? '🌸' : '✨'),
            notion_enabled: role === 'admin',
          }),
        });
        const data = await res.json();
        if (!data.success) {
          throw new Error(data.error || 'Failed to create user account');
        }
        setSuccessMessage(`Account for "${name.trim()}" created successfully!`);
        setName('');
        setEmail('');
        setRole('member');
        setIndustry('Hospitality Management');
        setCustomIndustry('');
      }

      await onRefreshUsers();
    } catch (err: any) {
      setErrorMessage(err.message || 'Something went wrong saving user.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    if (!confirm(`Are you sure you want to delete "${userName}"?`)) return;

    try {
      const res = await fetch(`/api/users/${userId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        if (editingUser?.id === userId) {
          cancelEditing();
        }
        await onRefreshUsers();
      }
    } catch (err) {
      console.error('Failed to delete user:', err);
    }
  };

  const handleSaveGoogleCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!googleClientId.trim()) {
      setGoogleError('Google Client ID is required.');
      return;
    }

    setIsSavingGoogle(true);
    setGoogleSuccess(null);
    setGoogleError(null);

    try {
      const res = await fetch('/api/settings/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: googleClientId.trim(),
          clientSecret: googleClientSecret.trim(),
        }),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to save Google credentials');
      }

      setIsGoogleConfigured(true);
      setGoogleSuccess('Google SSO credentials saved to .env.local and activated!');
      setGoogleClientSecret('');
    } catch (err: any) {
      setGoogleError(err.message || 'Error saving Google credentials.');
    } finally {
      setIsSavingGoogle(false);
    }
  };

  const copyToClipboard = (text: string, isOrigin: boolean = false) => {
    navigator.clipboard.writeText(text);
    if (isOrigin) {
      setCopiedOrigin(true);
      setTimeout(() => setCopiedOrigin(false), 2000);
    } else {
      setCopiedRedirect(true);
      setTimeout(() => setCopiedRedirect(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-xl w-full max-w-2xl overflow-hidden border border-[#F1DDE9] max-h-[92vh] flex flex-col">
        {/* Header with Navigation Tabs */}
        <div className="p-5 border-b border-[#F1DDE9] bg-gradient-to-r from-white via-[#FFF0F6] to-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#FFB8CA] to-[#FF7AB3] text-white flex items-center justify-center shadow-xs">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#4A3E44]">User Accounts & Authentication</h2>
              <div className="flex items-center gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => setActiveTab('accounts')}
                  className={`text-xs font-semibold px-2.5 py-1 rounded-lg transition ${
                    activeTab === 'accounts'
                      ? 'bg-[#FF7AB3] text-white shadow-2xs'
                      : 'text-[#736A6D] hover:bg-white hover:text-[#4A3E44]'
                  }`}
                >
                  👥 Accounts & RBAC
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('google')}
                  className={`text-xs font-semibold px-2.5 py-1 rounded-lg transition flex items-center gap-1.5 ${
                    activeTab === 'google'
                      ? 'bg-[#FF7AB3] text-white shadow-2xs'
                      : 'text-[#736A6D] hover:bg-white hover:text-[#4A3E44]'
                  }`}
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Google SSO Credentials</span>
                  {isGoogleConfigured && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  )}
                </button>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-stone-400 hover:text-[#4A3E44] rounded-xl hover:bg-[#FAF7F9] transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab 1: User Accounts & RBAC */}
        {activeTab === 'accounts' && (
          <div className="p-6 overflow-y-auto space-y-6">
            {/* Informational RBAC Note */}
            <div className="p-3.5 rounded-2xl bg-[#FFF0F6]/80 border border-[#F1DDE9] flex items-start gap-3">
              <Sparkles className="w-4 h-4 text-[#FF7AB3] shrink-0 mt-0.5" />
              <div className="text-xs text-[#736A6D] space-y-0.5">
                <p className="font-semibold text-[#9D3C5E]">Role-Based Access Control (RBAC):</p>
                <p>
                  <strong>Admin (You)</strong>: Has Notion 2-way sync & live portfolio discovery.{' '}
                  <strong>Members</strong>: Stored in Cloud DB. Zero Notion confusion.
                </p>
              </div>
            </div>

            {/* Existing Accounts List */}
            <div>
              <h3 className="text-xs font-bold text-[#736A6D] uppercase tracking-wider mb-2.5">
                Existing Accounts ({users.length})
              </h3>
              <div className="space-y-2">
                {users.map((u) => {
                  const isAdmin = u.role === 'admin';
                  const isCurrent = u.id === currentUserId;
                  const isCurrentlyEditing = editingUser?.id === u.id;

                  return (
                    <div
                      key={u.id}
                      className={`p-3.5 rounded-2xl border transition flex items-center justify-between gap-3 ${
                        isCurrentlyEditing
                          ? 'border-[#FF7AB3] bg-[#FFF0F6]/40 shadow-xs ring-1 ring-[#FF7AB3]'
                          : 'border-[#F1DDE9] bg-white hover:border-[#FF7AB3]'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-[#FAF7F9] border border-[#F1DDE9] flex items-center justify-center text-base shrink-0">
                          {u.avatar || (isAdmin ? '🌸' : '✨')}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-[#4A3E44] truncate">{u.name.replace(/\s*\(Ji\)/gi, '').trim()}</span>
                            {isCurrent && (
                              <span className="text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.2 rounded-md">
                                You
                              </span>
                            )}
                            <span
                              className={`text-[10px] font-semibold px-2 py-0.2 rounded-full border ${
                                isAdmin
                                  ? 'bg-[#FFF0F6] text-[#9D3C5E] border-[#F1DDE9]'
                                  : 'bg-stone-50 text-stone-600 border-stone-200'
                              }`}
                            >
                              {isAdmin ? '👑 ADMIN' : '👤 MEMBER'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-[#736A6D] mt-0.5 truncate">
                            <span>{u.email}</span>
                            <span>•</span>
                            <span className="truncate">{u.industry || 'General Industry'}</span>
                            <span>•</span>
                            <span className={u.notion_enabled ? 'text-emerald-600 font-medium' : 'text-stone-500'}>
                              {u.notion_enabled ? 'Notion Sync' : 'Cloud DB'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {/* Edit Button */}
                        <button
                          onClick={() => startEditing(u)}
                          title={`Edit ${u.name}'s profile`}
                          className={`px-2.5 py-1.5 text-xs font-semibold rounded-xl border transition flex items-center gap-1 ${
                            isCurrentlyEditing
                              ? 'bg-[#FF7AB3] text-white border-[#FF7AB3]'
                              : 'bg-white text-[#736A6D] hover:text-[#9D3C5E] hover:bg-[#FFF0F6] border-[#F1DDE9]'
                          }`}
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Edit</span>
                        </button>

                        {/* Delete Button (Only for non-admin) */}
                        {!isAdmin && (
                          <button
                            onClick={() => handleDeleteUser(u.id, u.name)}
                            title={`Delete ${u.name}`}
                            className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Create or Edit Account Form */}
            <div className="pt-4 border-t border-[#F1DDE9]">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold text-[#736A6D] uppercase tracking-wider flex items-center gap-1.5">
                  {editingUser ? (
                    <>
                      <Edit3 className="w-4 h-4 text-[#FF7AB3]" />
                      <span className="text-[#9D3C5E]">Editing Profile: {editingUser.name}</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4 text-[#FF7AB3]" />
                      <span>Add New Account Directly in UI</span>
                    </>
                  )}
                </h3>

                {editingUser && (
                  <button
                    type="button"
                    onClick={cancelEditing}
                    className="text-xs font-medium text-stone-500 hover:text-stone-800 flex items-center gap-1 hover:underline"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Cancel Editing</span>
                  </button>
                )}
              </div>

              {errorMessage && (
                <div className="mb-3 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {successMessage && (
                <div className="mb-3 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-700 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{successMessage}</span>
                </div>
              )}

              <form onSubmit={handleSubmitUser} className="space-y-3.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#736A6D] mb-1">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Alex Rivera"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-[#F1DDE9] text-xs text-[#4A3E44] focus:outline-none focus:border-[#FF7AB3] transition bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#736A6D] mb-1">
                      Email Address *
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="e.g. alex@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-[#F1DDE9] text-xs text-[#4A3E44] focus:outline-none focus:border-[#FF7AB3] transition bg-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#736A6D] mb-1">
                      Role (RBAC)
                    </label>
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value as UserRole)}
                      className="w-full px-3 py-2 rounded-xl border border-[#F1DDE9] text-xs font-semibold text-[#736A6D] focus:outline-none focus:border-[#FF7AB3] bg-white transition cursor-pointer"
                    >
                      <option value="member">👤 Member (Cloud DB Isolated)</option>
                      <option value="admin">👑 Administrator (Full Notion & Portfolio)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#736A6D] mb-1">
                      Industry / Domain Focus
                    </label>
                    <select
                      value={industry}
                      onChange={(e) => setIndustry(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-[#F1DDE9] text-xs font-semibold text-[#736A6D] focus:outline-none focus:border-[#FF7AB3] bg-white transition cursor-pointer"
                    >
                      <option value="Hospitality Management">🏨 Hospitality Management</option>
                      <option value="IT / AI & Software">💻 IT / AI & Software</option>
                      <option value="Marketing & Growth">📈 Marketing & Growth</option>
                      <option value="UI/UX & Design">🎨 UI/UX & Design</option>
                      <option value="Finance & Accounting">💰 Finance & Accounting</option>
                      <option value="Healthcare">🏥 Healthcare</option>
                      <option value="Other">Custom Industry...</option>
                    </select>
                  </div>
                </div>

                {industry === 'Other' && (
                  <div>
                    <label className="block text-xs font-semibold text-[#736A6D] mb-1">
                      Specify Custom Industry
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Architecture, Culinary Arts, Supply Chain"
                      value={customIndustry}
                      onChange={(e) => setCustomIndustry(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-[#F1DDE9] text-xs text-[#4A3E44] focus:outline-none focus:border-[#FF7AB3] transition bg-white"
                    />
                  </div>
                )}

                <div className="flex items-center justify-between pt-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-[#736A6D]">Icon:</span>
                    {['✨', '🌸', '💼', '🏨', '💻', '🎨', '👤'].map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => setAvatar(emoji)}
                        className={`w-7 h-7 rounded-lg text-sm flex items-center justify-center transition border ${
                          avatar === emoji
                            ? 'bg-[#FFF0F6] border-[#FF7AB3] shadow-xs'
                            : 'bg-white border-[#F1DDE9] hover:bg-[#FAF7F9]'
                        }`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-2">
                    {editingUser && (
                      <button
                        type="button"
                        onClick={cancelEditing}
                        className="px-3 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-100 rounded-xl transition"
                      >
                        Cancel
                      </button>
                    )}
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="px-4 py-2 text-xs font-semibold text-white bg-[#FF7AB3] hover:bg-[#F06292] rounded-xl shadow-xs transition disabled:opacity-50 flex items-center gap-1.5"
                    >
                      {editingUser ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>{isSubmitting ? 'Saving...' : 'Save Changes'}</span>
                        </>
                      ) : (
                        <>
                          <UserPlus className="w-3.5 h-3.5" />
                          <span>{isSubmitting ? 'Creating...' : 'Create Account'}</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Tab 2: Google SSO Credentials */}
        {activeTab === 'google' && (
          <div className="p-6 overflow-y-auto space-y-5">
            {/* Connection Status Banner */}
            <div
              className={`p-4 rounded-2xl border transition flex items-start gap-3 ${
                isGoogleConfigured
                  ? 'bg-emerald-50/70 border-emerald-200'
                  : 'bg-amber-50/70 border-amber-200'
              }`}
            >
              {isGoogleConfigured ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              )}
              <div>
                <h4 className="text-sm font-bold text-[#4A3E44]">
                  {isGoogleConfigured
                    ? 'Google OAuth SSO is Active'
                    : 'Google SSO Credentials Not Configured'}
                </h4>
                <p className="text-xs text-[#736A6D] mt-0.5">
                  {isGoogleConfigured
                    ? 'Users can sign in with their Google accounts. Their names and avatars are auto-extracted.'
                    : 'Provide your Google Client ID and Secret below to activate 1-click Google Sign-In.'}
                </p>
              </div>
            </div>

            {googleSuccess && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-700 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{googleSuccess}</span>
              </div>
            )}

            {googleError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{googleError}</span>
              </div>
            )}

            {/* Input Form */}
            <form onSubmit={handleSaveGoogleCredentials} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#736A6D] uppercase tracking-wider mb-1">
                  Google Client ID *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 1234567890-abcdefghijkl.apps.googleusercontent.com"
                  value={googleClientId}
                  onChange={(e) => setGoogleClientId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#F1DDE9] font-mono text-xs text-[#4A3E44] focus:outline-none focus:border-[#FF7AB3] bg-white transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#736A6D] uppercase tracking-wider mb-1">
                  Google Client Secret *
                </label>
                <div className="relative">
                  <input
                    type={showSecret ? 'text' : 'password'}
                    placeholder={
                      isGoogleConfigured
                        ? '•••••••••••••••••••••••••••••••• (Leave blank to keep existing)'
                        : 'e.g. GOCSPX-xxxxxxxxxxxxxxxxxxxxxxxx'
                    }
                    value={googleClientSecret}
                    onChange={(e) => setGoogleClientSecret(e.target.value)}
                    className="w-full pl-3.5 pr-10 py-2.5 rounded-xl border border-[#F1DDE9] font-mono text-xs text-[#4A3E44] focus:outline-none focus:border-[#FF7AB3] bg-white transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecret(!showSecret)}
                    className="absolute right-3 top-3 text-stone-400 hover:text-stone-700"
                  >
                    {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  disabled={isSavingGoogle}
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#FF7AB3] hover:bg-[#F06292] rounded-xl shadow-xs transition disabled:opacity-50 flex items-center gap-1.5"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>{isSavingGoogle ? 'Saving...' : 'Save Google SSO Credentials'}</span>
                </button>
              </div>
            </form>

            {/* Google Cloud Console Setup Guide & Redirect URIs */}
            <div className="pt-4 border-t border-[#F1DDE9] space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-[#736A6D] uppercase tracking-wider">
                  Google Cloud Console Settings
                </h4>
                <a
                  href="https://console.cloud.google.com/apis/credentials"
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-semibold text-[#9D3C5E] hover:underline flex items-center gap-1"
                >
                  <span>Open Google Cloud Console</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>

              {/* Authorized Redirect URI */}
              <div>
                <label className="block text-[11px] font-semibold text-[#736A6D] mb-1">
                  1. Authorized redirect URI (Required)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={redirectUri}
                    className="w-full px-3 py-2 text-xs font-mono bg-stone-50 border border-[#F1DDE9] rounded-xl text-stone-700 select-all"
                  />
                  <button
                    type="button"
                    onClick={() => copyToClipboard(redirectUri, false)}
                    className="inline-flex items-center gap-1 px-3 py-2 text-xs font-medium text-[#9D3C5E] bg-[#FFF0F6] hover:bg-[#FCE7F3] border border-[#F1DDE9] rounded-xl transition shrink-0"
                  >
                    {copiedRedirect ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedRedirect ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>

              {/* Authorized JavaScript Origins */}
              <div>
                <label className="block text-[11px] font-semibold text-[#736A6D] mb-1">
                  2. Authorized JavaScript origins
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={originUrl}
                    className="w-full px-3 py-2 text-xs font-mono bg-stone-50 border border-[#F1DDE9] rounded-xl text-stone-700 select-all"
                  />
                  <button
                    type="button"
                    onClick={() => copyToClipboard(originUrl, true)}
                    className="inline-flex items-center gap-1 px-3 py-2 text-xs font-medium text-[#9D3C5E] bg-[#FFF0F6] hover:bg-[#FCE7F3] border border-[#F1DDE9] rounded-xl transition shrink-0"
                  >
                    {copiedOrigin ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedOrigin ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
