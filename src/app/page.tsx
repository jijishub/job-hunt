'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  JobApplication,
  Company,
  ApplicationStatus,
  Priority,
  UserAccount,
} from '@/types/job';
import Header from '@/components/Header';
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
import {
  Table as TableIcon,
  Columns,
  Building2,
  Search,
  ArrowUpDown,
  Compass,
  BarChart3,
} from 'lucide-react';

export default function JobHuntDashboard() {
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);

  const [activeView, setActiveView] = useState<'table' | 'board' | 'companies' | 'leads' | 'analytics'>('table');
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [notionStatus, setNotionStatus] = useState<any>(null);

  // Filter and Search States
  const [searchQuery, setSearchQuery] = useState('');
  const [ownerFilter, setOwnerFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
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
      const [appsRes, compsRes, notionRes, usersRes] = await Promise.all([
        fetch('/api/applications'),
        fetch('/api/companies'),
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

      if (usersData.success && usersData.data.length > 0) {
        setUsers(usersData.data);
        setCurrentUser((prev) => {
          if (prev) {
            const found = usersData.data.find((u: UserAccount) => u.id === prev.id);
            return found || prev;
          }
          // Default to the admin account or first user
          const admin = usersData.data.find((u: UserAccount) => u.role === 'admin');
          return admin || usersData.data[0];
        });
      }
    } catch (err) {
      console.error('Failed to load initial data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleNotionSync = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch('/api/notion/sync', { method: 'POST' });
      await res.json();
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

  const handleUpdateStatus = async (id: string, newStatus: ApplicationStatus) => {
    setApplications((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: newStatus } : a))
    );
    try {
      await fetch(`/api/applications/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
    } catch (e) {
      console.error('Failed to update status:', e);
      fetchData();
    }
  };

  const handleSaveCompany = async (data: Partial<Company>) => {
    const res = await fetch('/api/companies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
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

  const filteredApplications = useMemo(() => {
    return applications
      .filter((app) => {
        // Owner / Applicant filter
        if (ownerFilter !== 'ALL') {
          const appOwner = app.owner || 'user_ji';
          if (appOwner !== ownerFilter) {
            // Also match if owner was saved as 'jizelle' or 'ji' and filter is 'user_ji'
            const isMatch =
              (ownerFilter === 'user_ji' && (appOwner === 'jizelle' || appOwner === 'ji')) ||
              (ownerFilter === 'user_denise' && appOwner === 'denise');
            if (!isMatch) return false;
          }
        }

        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchTitle = app.role_title.toLowerCase().includes(q);
          const matchCompany = app.company_name.toLowerCase().includes(q);
          const matchNotes = app.notes?.toLowerCase().includes(q);
          const matchLocation = app.location?.toLowerCase().includes(q);
          if (!matchTitle && !matchCompany && !matchNotes && !matchLocation) {
            return false;
          }
        }

        if (statusFilter !== 'ALL' && app.status !== statusFilter) {
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
  }, [applications, searchQuery, ownerFilter, statusFilter, priorityFilter, sortBy]);

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
        {/* Navigation Tabs Bar (Clean, Dedicated Single-Row) */}
        <div className="bg-white p-2 rounded-2xl border border-[#F1DDE9] shadow-2xs flex items-center justify-between gap-3 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-1.5 flex-nowrap whitespace-nowrap min-w-max">
            <button
              onClick={() => setActiveView('table')}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition ${
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
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition ${
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
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition ${
                activeView === 'companies'
                  ? 'bg-[#FF7AB3] text-white shadow-xs'
                  : 'text-[#736A6D] hover:bg-[#FAF7F9] hover:text-[#4A3E44]'
              }`}
            >
              <Building2 className="w-4 h-4" />
              <span>Companies ({companies.length})</span>
            </button>

            <button
              onClick={() => setActiveView('leads')}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition ${
                activeView === 'leads'
                  ? 'bg-[#FF7AB3] text-white shadow-xs'
                  : 'text-[#736A6D] hover:bg-[#FAF7F9] hover:text-[#4A3E44]'
              }`}
            >
              <Compass className="w-4 h-4 text-emerald-500" />
              <span>🎯 Find Leads</span>
            </button>

            <button
              onClick={() => setActiveView('analytics')}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition ${
                activeView === 'analytics'
                  ? 'bg-[#FF7AB3] text-white shadow-xs'
                  : 'text-[#736A6D] hover:bg-[#FAF7F9] hover:text-[#4A3E44]'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>📊 Analytics</span>
            </button>
          </div>

          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-[#FAF7F9] rounded-xl text-xs text-[#736A6D] font-medium border border-[#F1DDE9] whitespace-nowrap">
            <span>Pipeline: <strong className="text-[#9D3C5E] font-bold">{applications.length}</strong> jobs</span>
          </div>
        </div>

        {/* Dedicated Search & Filters Toolbar (Active on Table & Board Views) */}
        {(activeView === 'table' || activeView === 'board') && (
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-[#F1DDE9] shadow-2xs">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[240px]">
              <input
                type="text"
                placeholder="Search role, company, location, or notes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-2 rounded-xl border border-[#F1DDE9] text-xs sm:text-sm text-[#4A3E44] placeholder-stone-400 focus:outline-none focus:border-[#FF7AB3] transition bg-[#FAF7F9]/60"
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

            {/* Filter Dropdowns */}
            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              {/* Dynamic Applicant / Account Filter */}
              <select
                value={ownerFilter}
                onChange={(e) => setOwnerFilter(e.target.value)}
                className="px-3 py-2 rounded-xl border border-[#F1DDE9] text-xs font-semibold text-[#736A6D] focus:outline-none focus:border-[#FF7AB3] bg-white transition cursor-pointer"
              >
                <option value="ALL">👥 All Pipelines</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.avatar || '👤'} {u.name} ({u.role.toUpperCase()})
                  </option>
                ))}
              </select>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 rounded-xl border border-[#F1DDE9] text-xs font-semibold text-[#736A6D] focus:outline-none focus:border-[#FF7AB3] bg-white transition cursor-pointer"
              >
                <option value="ALL">All Statuses</option>
                <option value="LEAD">Leads</option>
                <option value="APPLIED">Applied</option>
                <option value="SCREENING">Screening</option>
                <option value="INTERVIEWING">Interviewing</option>
                <option value="OFFER">Offers</option>
                <option value="REJECTED">Rejected</option>
              </select>

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

              {(searchQuery || ownerFilter !== 'ALL' || statusFilter !== 'ALL' || priorityFilter !== 'ALL') && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setOwnerFilter('ALL');
                    setStatusFilter('ALL');
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
            companies={companies}
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
            existingApplications={applications}
            currentUser={currentUser}
          />
        ) : activeView === 'analytics' ? (
          <AnalyticsView applications={filteredApplications} companies={companies} />
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
      />

      {/* Add / Edit Application Modal */}
      <ApplicationModal
        isOpen={isAppModalOpen}
        onClose={() => {
          setIsAppModalOpen(false);
          setEditingApp(null);
        }}
        onSave={handleSaveApplication}
        companies={companies}
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
