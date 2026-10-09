'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import { useSession } from 'next-auth/react';
import {
  JobApplication,
  Company,
  ApplicationStatus,
  Priority,
  UserAccount,
} from '@/types/job';
import Header from '@/components/Header';
import SSOLandingView from '@/components/SSOLandingView';
import ApplicationTable from '@/components/ApplicationTable';
import ApplicationBoard from '@/components/ApplicationBoard';
import CompaniesView from '@/components/CompaniesView';
import AnalyticsView from '@/components/AnalyticsView';
import JobLeadsView from '@/components/JobLeadsView';
import ApplicationDetailModal from '@/components/ApplicationDetailModal';
import ApplicationModal from '@/components/ApplicationModal';
import CompanyModal from '@/components/CompanyModal';
import NotionSettingsModal from '@/components/NotionSettingsModal';
import UserManagementModal from '@/components/UserManagementModal';
import ResumeAnalyzerView from '@/components/ResumeAnalyzerView';
import {
  Table as TableIcon,
  Columns,
  Building2,
  Search,
  ArrowUpDown,
  Compass,
  BarChart3,
  Sparkles,
} from 'lucide-react';

export default function JobHuntDashboard() {
  const { data: session, status: authStatus } = useSession();
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);

  const [activeView, setActiveView] = useState<'table' | 'board' | 'companies' | 'leads' | 'analytics' | 'resume'>('table');
  const [resumeTargetAppId, setResumeTargetAppId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [notionStatus, setNotionStatus] = useState<any>(null);

  // Filter and Search States
  const [searchQuery, setSearchQuery] = useState('');
  const [ownerFilter, setOwnerFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [notionStatusFilter, setNotionStatusFilter] = useState<string>('ALL');
  const [serviceFilter, setServiceFilter] = useState<string>('ALL');
  const [positionFilter, setPositionFilter] = useState<string>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'updated' | 'date_applied' | 'priority' | 'company'>('updated');

  // Modals
  const [selectedApp, setSelectedApp] = useState<JobApplication | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isAppModalOpen, setIsAppModalOpen] = useState(false);
  const [editingApp, setEditingApp] = useState<JobApplication | null>(null);

  const [isCompanyModalOpen, setIsCompanyModalOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);

  const [isNotionModalOpen, setIsNotionModalOpen] = useState(false);
  const [isUserManagementOpen, setIsUserManagementOpen] = useState(false);
  const [userManagementTab, setUserManagementTab] = useState<'accounts' | 'google'>('accounts');

  const fetchData = async () => {
    try {
      const sessionEmail = session?.user?.email?.toLowerCase().trim();
      const sessionRole = (session?.user as any)?.role;
      const isAdmin =
        sessionRole === 'admin' ||
        sessionEmail === 'jizellecasia@gmail.com' ||
        sessionEmail === 'jizelle.casia@gmail.com';
      const compsQuery = sessionEmail
        ? `?user=${encodeURIComponent(sessionEmail)}&role=${isAdmin ? 'admin' : 'member'}`
        : '';

      const [appsRes, compsRes, notionRes, usersRes] = await Promise.all([
        fetch('/api/applications'),
        fetch(`/api/companies${compsQuery}`),
        fetch('/api/notion/sync'),
        fetch('/api/users'),
      ]);

      const appsData = await appsRes.json();
      const compsData = await compsRes.json();
      const notionData = await notionRes.json();
      const usersData = await usersRes.json();

      if (appsData.success) setApplications(appsData.data);
      if (compsData.success) setCompanies(compsData.data);
      setNotionStatus(notionData);

      // Auto-recovery: if applications is empty or has fewer than 5 rows on load and Notion is connected, auto-sync!
      // Strictly restricted to Master Admin!
      const sessionUserRole = (session?.user as any)?.role;
      const sessionUserEmail = session?.user?.email?.toLowerCase().trim();
      const isAdminUser =
        sessionUserRole === 'admin' ||
        sessionUserEmail === 'jizellecasia@gmail.com' ||
        sessionUserEmail === 'jizelle.casia@gmail.com';

      if (
        isAdminUser &&
        (!appsData.data || appsData.data.length < 5) &&
        notionData.configured &&
        notionData.status?.success
      ) {
        const syncRes = await fetch('/api/notion/sync', { method: 'POST' });
        const syncResult = await syncRes.json();
        if (syncResult.success) {
          if (syncResult.data) setApplications(syncResult.data);
          if (syncResult.companies) setCompanies(syncResult.companies);
        }
      }

      if (usersData.success && usersData.data.length > 0) {
        setUsers(usersData.data);
        const sessionEmail = session?.user?.email?.toLowerCase().trim();
        const matched = sessionEmail
          ? usersData.data.find((u: UserAccount) => u.email.toLowerCase().trim() === sessionEmail)
          : null;
        if (matched) {
          setCurrentUser(matched);
          if (matched.role === 'member') {
            setOwnerFilter(matched.id);
          }
        } else if (session?.user) {
          const isMemberRole = !isAdminUser;
          const userObj: UserAccount = {
            id: (session.user as any)?.id || 'user_sso',
            name: session.user.name || 'Member',
            email: session.user.email || '',
            role: isMemberRole ? 'member' : 'admin',
            avatar: session.user.image || '✨',
            notion_enabled: !isMemberRole,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          setCurrentUser(userObj);
          if (isMemberRole) {
            setOwnerFilter(userObj.id);
          }
        }
      }
    } catch (err) {
      console.error('Failed to load initial data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (authStatus === 'authenticated') {
      fetchData();
    }
  }, [authStatus]);

  const handleNotionSync = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch('/api/notion/sync', { method: 'POST' });
      const syncResult = await res.json();
      if (!res.ok || !syncResult.success) {
        alert(syncResult.message || syncResult.error || 'Notion sync failed. Please retry.');
      }
      if (syncResult.success) {
        if (syncResult.data) setApplications(syncResult.data);
        if (syncResult.companies) setCompanies(syncResult.companies);
      }
      await fetchData();
    } catch (err) {
      console.error('Error during sync:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSaveApplication = async (data: Partial<JobApplication>) => {
    if (editingApp && editingApp.id) {
      const res = await fetch(`/api/applications/${editingApp.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (!res.ok || !result.success) throw new Error(result.error || 'Failed to save application');
      if (result.sync_error) alert(`Application saved. Notion sync failed: ${result.sync_error}`);
      if (result.success) {
        setApplications((prev) =>
          prev.map((a) => (a.id === editingApp.id ? result.data : a))
        );
        if (selectedApp?.id === editingApp.id) {
          setSelectedApp(result.data);
        }
      }
    } else {
      const res = await fetch('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (!res.ok || !result.success) throw new Error(result.error || 'Failed to save application');
      if (result.sync_error) alert(`Application saved. Notion sync failed: ${result.sync_error}`);
      if (result.success) {
        setApplications((prev) => [result.data, ...prev]);
      }
    }

    fetch('/api/companies')
      .then((r) => r.json())
      .then((d) => d.success && setCompanies(d.data));
  };

  const handleDeleteApplication = async (id: string) => {
    const res = await fetch(`/api/applications/${id}`, { method: 'DELETE' });
    const result = await res.json();
    if (result.success) {
      setApplications((prev) => prev.filter((a) => a.id !== id));
      if (selectedApp?.id === id) {
        setIsDetailOpen(false);
        setSelectedApp(null);
      }
    }
  };

  const handleUpdateStatus = async (
    id: string,
    newStatus: ApplicationStatus,
    notionStatusName?: string
  ) => {
    setApplications((prev) =>
      prev.map((a) =>
        a.id === id
          ? {
              ...a,
              status: newStatus,
              notion_status: notionStatusName || a.notion_status,
            }
          : a
      )
    );
    try {
      const response = await fetch(`/api/applications/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: newStatus,
          notion_status: notionStatusName,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || 'Failed to update status');
      setApplications((prev) => prev.map((app) => app.id === id ? result.data : app));
    } catch (e) {
      console.error('Failed to update status:', e);
      fetchData();
      throw e;
    }
  };

  const handleSaveCompany = async (data: Partial<Company>) => {
    const sessionEmail = session?.user?.email?.toLowerCase().trim();
    const payload = {
      ...data,
      created_by: data.created_by || sessionEmail || currentUser?.id,
    };
    const res = await fetch('/api/companies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const result = await res.json();
    if (result.success) {
      await fetchData();
    }
  };

  const handleDeleteCompany = async (id: string) => {
    const res = await fetch(`/api/companies?id=${id}`, { method: 'DELETE' });
    const result = await res.json();
    if (result.success) {
      await fetchData();
    }
  };

  // Extract unique Notion categories for quick smart filtering
  const uniqueNotionStatuses = useMemo(() => {
    const set = new Set<string>();
    applications.forEach((a) => {
      if (a.notion_status) set.add(a.notion_status);
    });
    return Array.from(set).sort();
  }, [applications]);

  const uniqueServices = useMemo(() => {
    const set = new Set<string>();
    applications.forEach((a) => {
      if (a.service) set.add(a.service);
    });
    return Array.from(set).sort();
  }, [applications]);

  const uniquePositions = useMemo(() => {
    const set = new Set<string>();
    applications.forEach((a) => {
      if (a.role_title) set.add(a.role_title);
    });
    return Array.from(set).sort();
  }, [applications]);

  const filteredApplications = useMemo(() => {
    return applications
      .filter((app) => {
        // STRICT RBAC PIPELINE ISOLATION:
        // Members can ONLY see their own applications!
        const isMember = currentUser?.role === 'member';
        if (isMember) {
          const appOwner = (app.owner || '').trim().toLowerCase();
          const memberId = (currentUser?.id || '').toLowerCase();
          const memberEmail = (currentUser?.email || '').toLowerCase();
          const memberName = (currentUser?.name || '').toLowerCase();

          const isOwnerMatch =
            (memberId && appOwner === memberId) ||
            (memberEmail && appOwner === memberEmail) ||
            (memberName && appOwner === memberName);

          if (!isOwnerMatch) return false;
        } else if (ownerFilter !== 'ALL') {
          const appOwner = (app.owner || '').trim().toLowerCase();
          const targetFilter = ownerFilter.toLowerCase();
          if (appOwner !== targetFilter) {
            const matchedUser = users.find((u) => u.id === ownerFilter);
            const isMatch =
              matchedUser &&
              (appOwner === matchedUser.name.toLowerCase() ||
                appOwner === matchedUser.email.toLowerCase() ||
                appOwner.includes(matchedUser.name.toLowerCase()));
            if (!isMatch) return false;
          }
        }

        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchTitle = app.role_title.toLowerCase().includes(q);
          const matchCompany = app.company_name.toLowerCase().includes(q);
          const matchNotes = app.notes?.toLowerCase().includes(q);
          const matchLocation = app.location?.toLowerCase().includes(q);
          const matchService = app.service?.toLowerCase().includes(q);
          const matchInfo = app.information?.toLowerCase().includes(q);
          const matchNotionStatus = app.notion_status?.toLowerCase().includes(q);
          if (
            !matchTitle &&
            !matchCompany &&
            !matchNotes &&
            !matchLocation &&
            !matchService &&
            !matchInfo &&
            !matchNotionStatus
          ) {
            return false;
          }
        }

        if (statusFilter !== 'ALL' && app.status !== statusFilter) {
          return false;
        }

        if (notionStatusFilter !== 'ALL' && app.notion_status !== notionStatusFilter) {
          return false;
        }

        if (serviceFilter !== 'ALL' && app.service !== serviceFilter) {
          return false;
        }

        if (positionFilter !== 'ALL' && app.role_title !== positionFilter) {
          return false;
        }

        if (priorityFilter !== 'ALL' && app.priority !== priorityFilter) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'updated') {
          return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
        }
        if (sortBy === 'date_applied') {
          return (
            new Date(b.date_applied || 0).getTime() -
            new Date(a.date_applied || 0).getTime()
          );
        }
        if (sortBy === 'company') {
          return a.company_name.localeCompare(b.company_name);
        }
        if (sortBy === 'priority') {
          const priorityScore: Record<Priority, number> = {
            DREAM: 4,
            HIGH: 3,
            MEDIUM: 2,
            LOW: 1,
          };
          return priorityScore[b.priority] - priorityScore[a.priority];
        }
        return 0;
      });
  }, [
    applications,
    searchQuery,
    ownerFilter,
    statusFilter,
    notionStatusFilter,
    serviceFilter,
    positionFilter,
    priorityFilter,
    sortBy,
    users,
    currentUser,
  ]);

  const leads = useMemo(() => {
    return filteredApplications.filter((app) => app.status === 'LEAD');
  }, [filteredApplications]);

  // STRICT COMPANY ISOLATION:
  // 1. Admin sees all companies in her Notion workspace.
  // 2. Members NEVER see Admin's Notion companies! Members only see companies they created or use in their applications.
  const filteredCompanies = useMemo(() => {
    const sessionEmail = session?.user?.email?.toLowerCase().trim();
    const currentEmail = currentUser?.email?.toLowerCase().trim();
    const currentId = currentUser?.id?.toLowerCase().trim();
    const sessionRole = (session?.user as any)?.role;
    const isAdmin =
      currentUser?.role === 'admin' ||
      sessionRole === 'admin' ||
      sessionEmail === 'jizellecasia@gmail.com' ||
      sessionEmail === 'jizelle.casia@gmail.com';

    if (isAdmin) {
      return companies;
    }

    // Member Isolation:
    return companies.filter((c: any) => {
      const creator = (c.created_by || '').toLowerCase().trim();
      const isCreatorMatch =
        (sessionEmail && creator === sessionEmail) ||
        (currentEmail && creator === currentEmail) ||
        (currentId && creator === currentId);

      const isUsedInMemberApp = filteredApplications.some(
        (app) =>
          app.company_id === c.id ||
          (app.company_name && c.name && app.company_name.toLowerCase().trim() === c.name.toLowerCase().trim())
      );

      return isCreatorMatch || isUsedInMemberApp;
    });
  }, [companies, session, currentUser, filteredApplications]);

  if (authStatus === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#FFF5F8] to-[#FAF7F9] flex flex-col items-center justify-center gap-3">
        <div className="w-14 h-14 rounded-3xl bg-white border border-[#F1DDE9] p-1.5 shadow-xs flex items-center justify-center animate-pulse">
          <Image
            src="/job-hunt-facvicon.png"
            alt="Job Hunt"
            width={48}
            height={48}
            className="rounded-2xl object-contain"
          />
        </div>
        <p className="text-xs text-[#736A6D] font-semibold animate-pulse">Loading workspace...</p>
      </div>
    );
  }

  if (authStatus === 'unauthenticated' || !session) {
    return <SSOLandingView />;
  }

  return (
    <div className="min-h-screen bg-[#FAF7F9] text-[#4A3E44] flex flex-col">
      <Header
        applications={applications}
        onNewApp={() => {
          setEditingApp(null);
          setIsAppModalOpen(true);
        }}
        onOpenNotionSettings={() => setIsNotionModalOpen(true)}
        onSyncNotion={handleNotionSync}
        isSyncing={isSyncing}
        notionStatus={notionStatus}
        users={users}
        currentUser={currentUser}
        onSelectUser={(u) => {
          setCurrentUser(u);
          // When switching user, also auto-filter pipeline if desired
          setOwnerFilter(u.id);
        }}
        onOpenUserManagement={(tab = 'accounts') => {
          setUserManagementTab(tab);
          setIsUserManagementOpen(true);
        }}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 w-full flex-1 space-y-4">
        {/* Unified Control Deck: Navigation Tabs + Filters in ONE Cohesive Card */}
        <div className="bg-white rounded-2xl border border-[#F1DDE9] shadow-2xs overflow-hidden">
          {/* Top Bar: Primary Navigation Tabs & Pipeline Metric */}
          <div className="p-2 sm:p-2.5 flex items-center justify-between gap-2 flex-wrap border-b border-[#F1DDE9]/60">
            <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap">
              <button
                onClick={() => setActiveView('table')}
                className={`inline-flex items-center gap-2 px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-semibold transition ${
                  activeView === 'table'
                    ? 'bg-[#FF7AB3] text-white shadow-xs'
                    : 'text-[#736A6D] hover:bg-[#FAF7F9] hover:text-[#4A3E44]'
                }`}
              >
                <TableIcon className="w-4 h-4" />
                <span>Table View</span>
              </button>

              <button
                onClick={() => setActiveView('board')}
                className={`inline-flex items-center gap-2 px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-semibold transition ${
                  activeView === 'board'
                    ? 'bg-[#FF7AB3] text-white shadow-xs'
                    : 'text-[#736A6D] hover:bg-[#FAF7F9] hover:text-[#4A3E44]'
                }`}
              >
                <Columns className="w-4 h-4" />
                <span>Board View</span>
              </button>

              <button
                onClick={() => setActiveView('companies')}
                className={`inline-flex items-center gap-2 px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-semibold transition ${
                  activeView === 'companies'
                    ? 'bg-[#FF7AB3] text-white shadow-xs'
                    : 'text-[#736A6D] hover:bg-[#FAF7F9] hover:text-[#4A3E44]'
                }`}
              >
                <Building2 className="w-4 h-4" />
                <span>Companies ({filteredCompanies.length})</span>
              </button>

              <button
                onClick={() => setActiveView('leads')}
                className={`inline-flex items-center gap-2 px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-semibold transition ${
                  activeView === 'leads'
                    ? 'bg-[#FF7AB3] text-white shadow-xs'
                    : 'text-[#736A6D] hover:bg-[#FAF7F9] hover:text-[#4A3E44]'
                }`}
              >
                <Compass className="w-4 h-4 text-emerald-500" />
                <span>🎯 Leads ({leads.length})</span>
              </button>

              <button
                onClick={() => setActiveView('analytics')}
                className={`inline-flex items-center gap-2 px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-semibold transition ${
                  activeView === 'analytics'
                    ? 'bg-[#FF7AB3] text-white shadow-xs'
                    : 'text-[#736A6D] hover:bg-[#FAF7F9] hover:text-[#4A3E44]'
                }`}
              >
                <BarChart3 className="w-4 h-4" />
                <span>📊 Analytics</span>
              </button>

              <button
                onClick={() => {
                  setResumeTargetAppId(null);
                  setActiveView('resume');
                }}
                className={`inline-flex items-center gap-2 px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-semibold transition ${
                  activeView === 'resume'
                    ? 'bg-[#FF7AB3] text-white shadow-xs'
                    : 'text-[#736A6D] hover:bg-[#FAF7F9] hover:text-[#4A3E44]'
                }`}
              >
                <Sparkles className="w-4 h-4 text-[#FF7AB3]" />
                <span>📄 AI Resume & ATS</span>
              </button>
            </div>

            <div className="flex items-center gap-2 px-3 py-1.5 bg-[#FAF7F9] rounded-xl text-xs text-[#736A6D] font-medium border border-[#F1DDE9] whitespace-nowrap ml-auto">
              <span>Pipeline: <strong className="text-[#9D3C5E] font-bold">{filteredApplications.length}</strong> jobs</span>
            </div>
          </div>

          {/* Integrated Search & Filters Toolbar (Active on Table & Board Views) */}
          {(activeView === 'table' || activeView === 'board') && (
            <div className="bg-[#FAF7F9]/40 p-3 sm:p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3">
              {/* Search Input */}
              <div className="relative flex-1 min-w-[220px]">
                <input
                  type="text"
                  placeholder="Search role, company, location, or notes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 rounded-xl border border-[#F1DDE9] text-xs sm:text-sm text-[#4A3E44] placeholder-stone-400 focus:outline-none focus:border-[#FF7AB3] transition bg-white"
                />
                <Search className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-2 text-stone-400 hover:text-stone-600 text-sm font-bold"
                    title="Clear search"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Filter Dropdowns with graceful wrapping */}
              <div className="flex items-center gap-2 flex-wrap">
                {/* Dynamic Applicant / Account Filter */}
                {currentUser?.role === 'admin' ? (
                  <select
                    value={ownerFilter}
                    onChange={(e) => setOwnerFilter(e.target.value)}
                    className="px-3 py-2 rounded-xl border border-[#F1DDE9] text-xs font-semibold text-[#736A6D] focus:outline-none focus:border-[#FF7AB3] bg-white transition cursor-pointer"
                  >
                    <option value="ALL">👥 All Pipelines</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.avatar?.startsWith('http') ? (u.role === 'admin' ? '🌸' : '👤') : (u.avatar || '👤')} {u.name} ({u.role.toUpperCase()})
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="px-3 py-2 rounded-xl border border-[#F1DDE9] text-xs font-semibold text-[#736A6D] bg-white flex items-center gap-1.5 whitespace-nowrap">
                    <span>👤 My Pipeline ({currentUser?.name || 'Member'})</span>
                  </div>
                )}

                {/* Notion Exact Stage Filter */}
                {uniqueNotionStatuses.length > 0 && (
                  <select
                    value={notionStatusFilter}
                    onChange={(e) => setNotionStatusFilter(e.target.value)}
                    className="px-3 py-2 rounded-xl border border-[#F1DDE9] text-xs font-semibold text-[#736A6D] focus:outline-none focus:border-[#FF7AB3] bg-white transition cursor-pointer max-w-[150px] truncate"
                    title="Filter by exact Notion stage"
                  >
                    <option value="ALL">Notion: All Stages</option>
                    {uniqueNotionStatuses.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                )}

                {/* Service / Industry Category Filter */}
                {uniqueServices.length > 0 && (
                  <select
                    value={serviceFilter}
                    onChange={(e) => setServiceFilter(e.target.value)}
                    className="px-3 py-2 rounded-xl border border-[#F1DDE9] text-xs font-semibold text-[#736A6D] focus:outline-none focus:border-[#FF7AB3] bg-white transition cursor-pointer max-w-[150px] truncate"
                    title="Filter by Industry / Service category"
                  >
                    <option value="ALL">🏷️ All Services</option>
                    {uniqueServices.map((svc) => (
                      <option key={svc} value={svc}>
                        {svc}
                      </option>
                    ))}
                  </select>
                )}

                {/* Intern Position Filter */}
                {uniquePositions.length > 0 && (
                  <select
                    value={positionFilter}
                    onChange={(e) => setPositionFilter(e.target.value)}
                    className="px-3 py-2 rounded-xl border border-[#F1DDE9] text-xs font-semibold text-[#736A6D] focus:outline-none focus:border-[#FF7AB3] bg-white transition cursor-pointer max-w-[140px] truncate"
                    title="Filter by Position / Role"
                  >
                    <option value="ALL">💼 All Roles</option>
                    {uniquePositions.map((pos) => (
                      <option key={pos} value={pos}>
                        {pos}
                      </option>
                    ))}
                  </select>
                )}

                {/* Priority Filter */}
                <select
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-[#F1DDE9] text-xs font-semibold text-[#736A6D] focus:outline-none focus:border-[#FF7AB3] bg-white transition cursor-pointer"
                >
                  <option value="ALL">All Priorities</option>
                  <option value="DREAM">⭐ Dream</option>
                  <option value="HIGH">🔥 High</option>
                  <option value="MEDIUM">⚡ Medium</option>
                  <option value="LOW">☕ Low</option>
                </select>

                {/* Sort By */}
                <div className="flex items-center gap-1.5 border border-[#F1DDE9] rounded-xl px-3 py-2 bg-white text-xs text-[#736A6D]">
                  <ArrowUpDown className="w-3.5 h-3.5 text-stone-400" />
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="bg-transparent focus:outline-none text-xs font-semibold text-[#736A6D] cursor-pointer"
                  >
                    <option value="updated">Recent Activity</option>
                    <option value="date_applied">Applied Date</option>
                    <option value="priority">Priority</option>
                    <option value="company">Company Name</option>
                  </select>
                </div>

                {(searchQuery ||
                  ownerFilter !== 'ALL' ||
                  statusFilter !== 'ALL' ||
                  notionStatusFilter !== 'ALL' ||
                  serviceFilter !== 'ALL' ||
                  positionFilter !== 'ALL' ||
                  priorityFilter !== 'ALL') && (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setOwnerFilter('ALL');
                      setStatusFilter('ALL');
                      setNotionStatusFilter('ALL');
                      setServiceFilter('ALL');
                      setPositionFilter('ALL');
                      setPriorityFilter('ALL');
                    }}
                    className="text-xs text-[#9D3C5E] hover:underline font-semibold px-2 py-1 whitespace-nowrap"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="py-24 text-center">
            <div className="w-10 h-10 border-2 border-[#FF7AB3] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-xs text-[#736A6D]">Loading your job hunt pipeline...</p>
          </div>
        ) : activeView === 'table' ? (
          <ApplicationTable
            applications={filteredApplications}
            onSelectApp={(app) => {
              setSelectedApp(app);
              setIsDetailOpen(true);
            }}
            onEditApp={(app) => {
              setEditingApp(app);
              setIsAppModalOpen(true);
            }}
            onDeleteApp={handleDeleteApplication}
          />
        ) : activeView === 'board' ? (
          <ApplicationBoard
            applications={filteredApplications}
            onSelectApp={(app) => {
              setSelectedApp(app);
              setIsDetailOpen(true);
            }}
            onNewAppWithStatus={(status) => {
              setEditingApp({ status } as any);
              setIsAppModalOpen(true);
            }}
            onUpdateStatus={handleUpdateStatus}
          />
        ) : activeView === 'companies' ? (
          <CompaniesView
            companies={filteredCompanies}
            onAddCompany={() => {
              setEditingCompany(null);
              setIsCompanyModalOpen(true);
            }}
            onEditCompany={(comp) => {
              setEditingCompany(comp);
              setIsCompanyModalOpen(true);
            }}
            onDeleteCompany={handleDeleteCompany}
          />
        ) : activeView === 'leads' ? (
          <JobLeadsView
            onAddToTracker={handleSaveApplication}
            existingApplications={filteredApplications}
            currentUser={currentUser}
            onUpdateStatus={handleUpdateStatus}
            onDeleteApplication={handleDeleteApplication}
            onSelectLead={(app) => {
              setSelectedApp(app);
              setIsDetailOpen(true);
            }}
            onNavigateToResume={(appId) => {
              setResumeTargetAppId(appId);
              setActiveView('resume');
            }}
          />
        ) : activeView === 'analytics' ? (
          <AnalyticsView applications={filteredApplications} companies={filteredCompanies} />
        ) : activeView === 'resume' ? (
          <ResumeAnalyzerView
            applications={filteredApplications}
            initialSelectedAppId={resumeTargetAppId}
          />
        ) : null}
      </main>

      {/* Application Details Modal */}
      <ApplicationDetailModal
        app={selectedApp}
        isOpen={isDetailOpen}
        onClose={() => {
          setIsDetailOpen(false);
          setSelectedApp(null);
        }}
        onEdit={(app) => {
          setIsDetailOpen(false);
          setEditingApp(app);
          setIsAppModalOpen(true);
        }}
        onDelete={handleDeleteApplication}
        onAnalyzeResume={(appId) => {
          setResumeTargetAppId(appId);
          setActiveView('resume');
          setIsDetailOpen(false);
        }}
      />

      {/* Add / Edit Application Modal */}
      <ApplicationModal
        isOpen={isAppModalOpen}
        onClose={() => {
          setIsAppModalOpen(false);
          setEditingApp(null);
        }}
        onSave={handleSaveApplication}
        companies={filteredCompanies}
        initialData={editingApp}
        users={users}
        currentUserId={currentUser?.id}
      />

      {/* Company Modal */}
      <CompanyModal
        isOpen={isCompanyModalOpen}
        onClose={() => {
          setIsCompanyModalOpen(false);
          setEditingCompany(null);
        }}
        onSave={handleSaveCompany}
        initialData={editingCompany}
      />

      {/* Notion Settings Modal (Admin Only) */}
      <NotionSettingsModal
        isOpen={isNotionModalOpen}
        onClose={() => setIsNotionModalOpen(false)}
        onSyncTrigger={handleNotionSync}
      />

      {/* User Accounts & RBAC Modal (Admin Only) */}
      <UserManagementModal
        isOpen={isUserManagementOpen}
        onClose={() => setIsUserManagementOpen(false)}
        users={users}
        onRefreshUsers={fetchData}
        currentUserId={currentUser?.id}
        initialTab={userManagementTab}
      />
    </div>
  );
}
