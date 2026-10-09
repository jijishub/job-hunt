'use client';

import React, { useState, useEffect } from 'react';
import { JobApplication, UserAccount, ApplicationStatus } from '@/types/job';
import StatusBadge from './StatusBadge';
import PriorityBadge from './PriorityBadge';
import {
  Compass,
  Search,
  ExternalLink,
  Plus,
  Building2,
  MapPin,
  Check,
  Sparkles,
  RefreshCw,
  Globe,
  Upload,
  BookmarkCheck,
  ArrowRight,
  Trash2,
  CheckCircle2,
  FileText,
} from 'lucide-react';
import { GeneratedLead } from '@/lib/ai';

interface JobLead {
  id: string;
  title: string;
  company_name: string;
  url: string;
  location: string;
  remote: boolean;
  tags: string[];
  job_types: string[];
  description: string;
}

interface JobLeadsViewProps {
  onAddToTracker: (appData: Partial<JobApplication>) => Promise<void>;
  existingApplications: JobApplication[];
  currentUser: UserAccount | null;
  onUpdateStatus?: (id: string, newStatus: ApplicationStatus, notionStatus?: string) => Promise<void>;
  onDeleteApplication?: (id: string) => Promise<void>;
  onSelectLead?: (app: JobApplication) => void;
  onNavigateToResume?: (appId: string) => void;
}

export default function JobLeadsView({
  onAddToTracker,
  existingApplications,
  currentUser,
  onUpdateStatus,
  onDeleteApplication,
  onSelectLead,
  onNavigateToResume,
}: JobLeadsViewProps) {
  const [subView, setSubView] = useState<'saved' | 'discover'>('saved');
  const [leads, setLeads] = useState<JobLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [addingId, setAddingId] = useState<string | null>(null);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());

  // Filter saved leads (status === 'LEAD')
  const savedLeads = existingApplications.filter((a) => a.status === 'LEAD');

  // Portfolio state (Admin only)
  const isAdmin = currentUser?.role === 'admin';
  const [portfolioData, setPortfolioData] = useState<any>(null);
  const [portfolioLoading, setPortfolioLoading] = useState(false);
  const [adminPdfInfo, setAdminPdfInfo] = useState<{ filename: string; pages: number } | null>(null);
  const [isAdminPdfUploading, setIsAdminPdfUploading] = useState(false);

  // User industry & AI Scout States
  const userIndustry = currentUser?.industry || (isAdmin ? 'IT / Software' : 'Tourism / Hospitality Management');
  const [sourcingKeyword, setSourcingKeyword] = useState(
    currentUser?.industry && currentUser.industry !== 'General'
      ? currentUser.industry
      : isAdmin
      ? 'Forward-Deployed Engineer'
      : 'Tourism & Hospitality Management'
  );
  const [sourcingLocation, setSourcingLocation] = useState('Metro Manila / Philippines');
  const [aiSearching, setAiSearching] = useState(false);
  const [aiSearchResults, setAiSearchResults] = useState<GeneratedLead[]>([]);
  const [aiSearchError, setAiSearchError] = useState<string | null>(null);
  const [candidatePdfInfo, setCandidatePdfInfo] = useState<{ filename: string; pages: number } | null>(null);
  const [isPdfUploading, setIsPdfUploading] = useState(false);
  const [useResumeContext, setUseResumeContext] = useState(true);

  // Manual Quick-Add state
  const [manualTitle, setManualTitle] = useState('');
  const [manualCompany, setManualCompany] = useState('');
  const [manualUrl, setManualUrl] = useState('');
  const [manualNotes, setManualNotes] = useState('');
  const [manualSaving, setManualSaving] = useState(false);
  const [manualSuccess, setManualSuccess] = useState(false);

  // Promoting state
  const [promotingId, setPromotingId] = useState<string | null>(null);

  const fetchLeads = async (q: string = '') => {
    setLoading(true);
    try {
      const roleParam = isAdmin ? 'admin' : 'member';
      const res = await fetch(`/api/leads?role=${roleParam}${q ? `&q=${encodeURIComponent(q)}` : ''}`);
      const data = await res.json();
      if (data.success) {
        setLeads(data.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const loadPortfolioData = async () => {
    if (!isAdmin) return;
    setPortfolioLoading(true);
    try {
      const res = await fetch('/api/portfolio');
      const data = await res.json();
      const p = data.profile || data.data;
      if (data.success && p) {
        setPortfolioData(p);
      }
    } catch (err) {
      console.error('Failed to load portfolio:', err);
    } finally {
      setPortfolioLoading(false);
    }
  };

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    const isPdfExt = file.name.toLowerCase().endsWith('.pdf');
    const isPdfMime = file.type === 'application/pdf' || file.type === 'application/x-pdf';
    if (!isPdfExt && !isPdfMime) {
      alert('Only PDF files (.pdf) are accepted. Please upload a PDF resume.');
      return;
    }

    setIsPdfUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/resume/parse-pdf', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        const info = { filename: data.filename || file.name, pages: data.totalPages || 1 };
        setCandidatePdfInfo(info);
        if (isAdmin) setAdminPdfInfo(info);
        if (typeof window !== 'undefined' && data.text) {
          localStorage.setItem('candidate_resume_text', data.text);
          localStorage.setItem('candidate_resume_name', data.filename || file.name);
          if (isAdmin) {
            localStorage.setItem('admin_imported_resume_text', data.text);
            localStorage.setItem('admin_imported_resume_name', data.filename || file.name);
          }
        }
      } else {
        alert(data.error || 'Failed to parse PDF.');
      }
    } catch (err: any) {
      alert(`PDF upload failed: ${err.message}`);
    } finally {
      setIsPdfUploading(false);
    }
  };

  const handleAIScout = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setAiSearching(true);
    setAiSearchError(null);

    let profileText = '';
    if (useResumeContext && typeof window !== 'undefined') {
      profileText =
        localStorage.getItem('candidate_resume_text') ||
        localStorage.getItem('admin_imported_resume_text') ||
        (portfolioData ? JSON.stringify(portfolioData) : '') ||
        '';
    }

    try {
      const targetQuery = sourcingKeyword.trim() || userIndustry;
      const res = await fetch('/api/leads/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetRole: targetQuery,
          industry: userIndustry,
          locationPreference: sourcingLocation.trim() || 'Metro Manila / Philippines',
          profileText: profileText || undefined,
          count: 6,
        }),
      });

      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setAiSearchResults(json.data);
      } else {
        throw new Error(json.error || 'Failed to search job postings.');
      }
    } catch (err: any) {
      console.error('AI scout error:', err);
      setAiSearchError(err.message || 'Error scouting job postings with AI.');
    } finally {
      setAiSearching(false);
    }
  };

  const handleAddGeneratedLead = async (lead: GeneratedLead) => {
    setAddingId(lead.id);
    try {
      await onAddToTracker({
        role_title: lead.title,
        company_name: lead.company_name,
        company_logo: lead.company_logo,
        status: 'LEAD',
        notion_status: 'Inquiry',
        priority: 'HIGH',
        job_type: /intern/i.test(lead.job_types?.[0] || '') ? 'INTERNSHIP'
          : /part/i.test(lead.job_types?.[0] || '') ? 'PART_TIME'
          : /contract/i.test(lead.job_types?.[0] || '') ? 'CONTRACT' : 'FULL_TIME',
        work_model: lead.remote ? 'REMOTE' : 'ON_SITE',
        location: lead.location,
        job_url: lead.search_url,
        owner: currentUser?.id || 'admin',
        notes: `${lead.description}\n\nAI Match Verdict: ${lead.ai_verdict}${lead.salary_range ? `\nEst. Compensation: ${lead.salary_range}` : ''}`,
      });
      setAddedIds((prev) => new Set(prev).add(lead.id));
    } catch (err) {
      console.error('Failed to add generated lead:', err);
    } finally {
      setAddingId(null);
    }
  };

  useEffect(() => {
    fetchLeads();
    if (isAdmin) {
      loadPortfolioData();
    }
    if (typeof window !== 'undefined') {
      const savedName =
        localStorage.getItem('candidate_resume_name') ||
        localStorage.getItem('admin_imported_resume_name');
      if (savedName) {
        setCandidatePdfInfo({ filename: savedName, pages: 1 });
        if (isAdmin) {
          setAdminPdfInfo({ filename: savedName, pages: 1 });
        }
      }
    }
  }, [isAdmin]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchLeads(search);
  };

  const isAlreadyTracked = (lead: JobLead) => {
    return (
      addedIds.has(lead.id) ||
      existingApplications.some(
        (a) =>
          a.role_title.toLowerCase() === lead.title.toLowerCase() &&
          a.company_name.toLowerCase() === lead.company_name.toLowerCase()
      )
    );
  };

  const handleAdd = async (lead: JobLead) => {
    setAddingId(lead.id);
    try {
      await onAddToTracker({
        role_title: lead.title,
        company_name: lead.company_name,
        company_logo: `https://www.google.com/s2/favicons?domain=${lead.company_name.toLowerCase().replace(/\s+/g, '')}.com&sz=128`,
        status: 'LEAD',
        notion_status: 'Inquiry',
        priority: 'HIGH',
        work_model: lead.remote ? 'REMOTE' : 'HYBRID',
        location: lead.location,
        job_url: lead.url,
        owner: currentUser?.id || 'admin',
        notes: `Discovered from Job Leads Explorer.\nTags: ${lead.tags.join(', ')}\n${lead.description}`,
      });
      setAddedIds((prev) => new Set(prev).add(lead.id));
    } catch (err) {
      console.error(err);
    } finally {
      setAddingId(null);
    }
  };

  const handleManualAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualTitle.trim() || !manualCompany.trim()) return;

    setManualSaving(true);
    try {
      await onAddToTracker({
        role_title: manualTitle.trim(),
        company_name: manualCompany.trim(),
        company_logo: `https://www.google.com/s2/favicons?domain=${manualCompany.toLowerCase().replace(/\s+/g, '')}.com&sz=128`,
        status: 'LEAD',
        notion_status: 'Inquiry',
        priority: 'HIGH',
        job_url: manualUrl.trim() || undefined,
        owner: currentUser?.id || 'admin',
        notes: manualNotes.trim() || `Manual lead entry for ${currentUser?.industry || 'pipeline'}`,
      });
      setManualTitle('');
      setManualCompany('');
      setManualUrl('');
      setManualNotes('');
      setManualSuccess(true);
      setTimeout(() => setManualSuccess(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setManualSaving(false);
    }
  };

  const handlePromoteLead = async (lead: JobApplication) => {
    if (!onUpdateStatus) return;
    setPromotingId(lead.id);
    try {
      await onUpdateStatus(lead.id, 'APPLIED', 'Applied - With MOA');
    } catch (err) {
      console.error(err);
    } finally {
      setPromotingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Role-Specific Hero Section */}
      {isAdmin ? (
        /* Admin: Portfolio Integration Banner & PDF Import */
        <div className="bg-gradient-to-r from-white via-[#FFF0F6] to-white p-5 rounded-3xl border border-[#F1DDE9] shadow-2xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-lg">🌸</span>
                <h3 className="text-sm font-bold text-[#4A3E44]">
                  Administrator Career Hub • Live Portfolio & Resume Synced
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  jizellecasia.vercel.app
                </span>
                {adminPdfInfo && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200 flex items-center gap-1">
                    <FileText className="w-3 h-3" />
                    <span>PDF: {adminPdfInfo.filename}</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-[#736A6D]">
                Auto-matches opportunities against your portfolio, skills, or uploaded PDF resume (Forward-Deployed Engineer & AI Automation).
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap self-start md:self-auto">
              {/* PDF Import for Admin */}
              <label className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#9D3C5E] bg-white hover:bg-[#FFF0F6] border border-[#F1DDE9] rounded-xl transition shadow-2xs cursor-pointer">
                <Upload className={`w-3.5 h-3.5 text-[#FF7AB3] ${isPdfUploading ? 'animate-bounce' : ''}`} />
                <span>{isPdfUploading ? 'Parsing...' : '📄 Import PDF Resume'}</span>
                <input
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={handlePdfUpload}
                  disabled={isPdfUploading}
                  className="hidden"
                />
              </label>

              <button
                onClick={loadPortfolioData}
                disabled={portfolioLoading}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#9D3C5E] bg-white hover:bg-[#FFF0F6] border border-[#F1DDE9] rounded-xl transition shadow-2xs disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${portfolioLoading ? 'animate-spin' : ''}`} />
                <span>{portfolioLoading ? 'Refreshing...' : 'Re-sync Portfolio'}</span>
              </button>
            </div>
          </div>

          {portfolioData && (
            <div className="mt-3.5 pt-3.5 border-t border-[#F1DDE9]/70 flex items-center gap-1.5 flex-wrap text-xs text-[#736A6D]">
              <span className="font-semibold text-[#4A3E44]">Verified Stack:</span>
              {(portfolioData.skills || []).slice(0, 10).map((skill: string) => (
                <span
                  key={skill}
                  className="px-2 py-0.5 rounded-lg bg-white border border-[#F1DDE9] text-[11px] text-[#9D3C5E] font-medium"
                >
                  {skill}
                </span>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Member: Industry Lead Hub */
        <div className="bg-gradient-to-r from-white via-purple-50/40 to-white p-5 rounded-3xl border border-purple-200/60 shadow-2xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg overflow-hidden shrink-0 inline-flex items-center justify-center text-lg">
                  {currentUser?.avatar?.startsWith('http') ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={currentUser.avatar} alt="" className="w-full h-full object-cover rounded-lg" />
                  ) : (
                    currentUser?.avatar || '✨'
                  )}
                </span>
                <h3 className="text-sm font-bold text-[#4A3E44]">
                  {currentUser?.name}&apos;s Sourcing Hub • {userIndustry}
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                  Cloud DB Isolated
                </span>
                {candidatePdfInfo && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                    <FileText className="w-3 h-3" />
                    <span>Resume: {candidatePdfInfo.filename}</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-[#736A6D]">
                Curated launchpads, live internet AI scouting, and quick lead intake tailored specifically for {userIndustry} roles.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap self-start md:self-auto">
              <label className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-purple-700 bg-white hover:bg-purple-50 border border-purple-200 rounded-xl transition shadow-2xs cursor-pointer">
                <Upload className={`w-3.5 h-3.5 text-purple-500 ${isPdfUploading ? 'animate-bounce' : ''}`} />
                <span>{isPdfUploading ? 'Parsing...' : candidatePdfInfo ? `📄 Change Resume` : '📄 Import Resume PDF'}</span>
                <input
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={handlePdfUpload}
                  disabled={isPdfUploading}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Sub-Tabs: Saved Leads vs Discover Feed */}
      <div className="flex items-center justify-between gap-2 border-b border-[#F1DDE9] pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSubView('saved')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
              subView === 'saved'
                ? 'bg-[#FF7AB3] text-white shadow-xs'
                : 'bg-white text-[#736A6D] hover:bg-[#FAF7F9] border border-[#F1DDE9]'
            }`}
          >
            <BookmarkCheck className="w-3.5 h-3.5" />
            <span>My Saved Leads ({savedLeads.length})</span>
          </button>

          <button
            onClick={() => setSubView('discover')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
              subView === 'discover'
                ? 'bg-[#FF7AB3] text-white shadow-xs'
                : 'bg-white text-[#736A6D] hover:bg-[#FAF7F9] border border-[#F1DDE9]'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>Discover & Sourcing Hub {aiSearchResults.length > 0 ? `(${aiSearchResults.length} AI found)` : ''}</span>
          </button>
        </div>

        <span className="text-[11px] text-[#736A6D] hidden sm:inline">
          Leads stay isolated and do not create new company directory rows until applied.
        </span>
      </div>

      {/* VIEW 1: MY SAVED LEADS PIPELINE */}
      {subView === 'saved' && (
        <div className="space-y-4">
          {savedLeads.length === 0 ? (
            <div className="py-16 text-center bg-white rounded-3xl border border-[#F1DDE9] space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-[#FFF0F6] text-[#FF7AB3] flex items-center justify-center mx-auto">
                <BookmarkCheck className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#4A3E44]">No saved leads yet</h3>
                <p className="text-xs text-[#736A6D] max-w-sm mx-auto mt-1">
                  Use the <strong>AI Job Scout</strong> or <strong>Direct Sourcing Launchpads</strong> in the Discover tab to find opportunities and save them here.
                </p>
              </div>
              <button
                onClick={() => setSubView('discover')}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-[#FF7AB3] hover:bg-[#F06292] rounded-xl shadow-xs transition"
              >
                <Compass className="w-3.5 h-3.5" />
                <span>Explore Opportunities</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {savedLeads.map((app) => (
                <div
                  key={app.id}
                  onClick={() => onSelectLead?.(app)}
                  className="bg-white p-4.5 rounded-2xl border border-[#F1DDE9] hover:border-[#FF7AB3] hover:shadow-xs transition flex flex-col justify-between space-y-3 cursor-pointer group"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-[#FAF7F9] border border-[#F1DDE9] flex items-center justify-center shrink-0 overflow-hidden shadow-2xs">
                          {app.company_logo?.startsWith('emoji:') ? (
                            <span className="text-xs">{app.company_logo.replace('emoji:', '')}</span>
                          ) : app.company_logo ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={app.company_logo} alt="" className="w-4 h-4 object-contain" />
                          ) : (
                            <Building2 className="w-4 h-4 text-stone-300" />
                          )}
                        </div>
                        <div>
                          <span className="text-xs font-bold text-[#4A3E44] group-hover:text-[#9D3C5E] transition block">
                            {app.company_name}
                          </span>
                          {app.location && (
                            <span className="text-[11px] text-[#736A6D] flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-stone-400 shrink-0" />
                              <span className="truncate max-w-[150px]">{app.location}</span>
                            </span>
                          )}
                        </div>
                      </div>

                      <PriorityBadge priority={app.priority} size="sm" />
                    </div>

                    <h4 className="text-sm font-bold text-[#4A3E44] line-clamp-1">{app.role_title}</h4>

                    {app.notes && (
                      <p className="text-xs text-[#736A6D] line-clamp-2 leading-relaxed bg-[#FAF7F9] p-2 rounded-xl border border-[#F1DDE9]/60">
                        {app.notes}
                      </p>
                    )}

                    <div className="flex items-center gap-1.5 flex-wrap pt-1">
                      <StatusBadge status={app.notion_status || 'Inquiry'} size="sm" />
                      {app.work_model && (
                        <span className="text-[10px] font-semibold text-stone-600 bg-stone-50 px-2 py-0.5 rounded-md border border-stone-200">
                          {app.work_model}
                        </span>
                      )}
                    </div>
                  </div>

                  <div
                    className="pt-3 border-t border-[#F1DDE9]/60 flex items-center justify-between gap-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center gap-1">
                      {app.job_url && (
                        <a
                          href={app.job_url}
                          target="_blank"
                          rel="noreferrer"
                          title="Open job link"
                          className="p-1.5 text-stone-400 hover:text-[#9D3C5E] rounded-lg hover:bg-[#FAF7F9] transition"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                      {onNavigateToResume && (
                        <button
                          type="button"
                          onClick={() => onNavigateToResume(app.id)}
                          title="Run AI Resume Match"
                          className="p-1.5 text-stone-400 hover:text-[#FF7AB3] rounded-lg hover:bg-[#FAF7F9] transition"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-[#FF7AB3]" />
                        </button>
                      )}
                      {onDeleteApplication && (
                        <button
                          type="button"
                          onClick={async () => {
                            if (confirm(`Remove lead for ${app.role_title}?`)) {
                              await onDeleteApplication(app.id);
                            }
                          }}
                          title="Remove Lead"
                          className="p-1.5 text-stone-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    <button
                      type="button"
                      disabled={promotingId === app.id}
                      onClick={() => handlePromoteLead(app)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-[#FF7AB3] to-[#9D3C5E] hover:from-[#ff6aa8] hover:to-[#8c3553] shadow-2xs transition disabled:opacity-50"
                      title="Promote lead to Applied application in your main tracker"
                    >
                      <span>{promotingId === app.id ? 'Promoting...' : 'Promote to Applied'}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* VIEW 2: DISCOVER & SOURCING LAUNCHPADS */}
      {subView === 'discover' && (
        <div className="space-y-6">
          {/* SECTION 1: 4 DIRECT SOURCING LAUNCHPADS (ALREADY-WIRED LINKS) */}
          <div className="bg-white p-5 rounded-2xl border border-[#F1DDE9] shadow-2xs space-y-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h4 className="text-xs font-bold text-[#736A6D] uppercase tracking-wider flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-[#FF7AB3]" />
                  <span>Direct Sourcing Launchpads</span>
                </h4>
                <p className="text-[11px] text-[#736A6D]">
                  Already-wired live job search links across top hiring platforms. Updates instantly with your target query.
                </p>
              </div>

              <div className="flex items-center gap-1.5 self-start sm:self-auto">
                <span className="text-[11px] font-semibold text-[#736A6D]">Query:</span>
                <input
                  type="text"
                  value={sourcingKeyword}
                  onChange={(e) => setSourcingKeyword(e.target.value)}
                  placeholder="Target role / industry..."
                  className="px-2.5 py-1 text-xs rounded-xl border border-[#F1DDE9] bg-[#FAF7F9] text-[#4A3E44] focus:outline-none focus:border-[#FF7AB3] w-48 sm:w-60"
                />
              </div>
            </div>

            {/* Quick Presets */}
            <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
              <span className="text-stone-400 font-medium">Quick Presets:</span>
              {[
                'Tourism Management',
                'Hotel Front Office & Reservations',
                'Guest Relations Officer',
                'Software Engineer',
                'Marketing & Growth',
              ].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setSourcingKeyword(preset)}
                  className={`px-2 py-0.5 rounded-lg border text-[10px] font-medium transition ${
                    sourcingKeyword === preset
                      ? 'bg-[#FFF0F6] text-[#9D3C5E] border-[#FF7AB3]'
                      : 'bg-white text-stone-600 border-[#F1DDE9] hover:bg-[#FAF7F9]'
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>

            {/* 4 Launchpad Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {/* LinkedIn */}
              <a
                href={`https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(sourcingKeyword || userIndustry)}`}
                target="_blank"
                rel="noreferrer"
                className="p-3 rounded-xl border border-[#F1DDE9] bg-[#FAF7F9]/60 hover:bg-[#FFF0F6] hover:border-[#FF7AB3] transition flex items-center justify-between group"
              >
                <div>
                  <span className="text-xs font-bold text-[#4A3E44] block group-hover:text-[#9D3C5E]">
                    LinkedIn Jobs
                  </span>
                  <span className="text-[10px] text-stone-500">Live Search Link</span>
                </div>
                <ExternalLink className="w-3.5 h-3.5 text-stone-400 group-hover:text-[#FF7AB3]" />
              </a>

              {/* JobStreet */}
              <a
                href={`https://www.jobstreet.com.ph/en/job-search/${encodeURIComponent(sourcingKeyword || userIndustry)}-jobs/`}
                target="_blank"
                rel="noreferrer"
                className="p-3 rounded-xl border border-[#F1DDE9] bg-[#FAF7F9]/60 hover:bg-[#FFF0F6] hover:border-[#FF7AB3] transition flex items-center justify-between group"
              >
                <div>
                  <span className="text-xs font-bold text-[#4A3E44] block group-hover:text-[#9D3C5E]">
                    JobStreet
                  </span>
                  <span className="text-[10px] text-stone-500">PH & Southeast Asia</span>
                </div>
                <ExternalLink className="w-3.5 h-3.5 text-stone-400 group-hover:text-[#FF7AB3]" />
              </a>

              {/* Indeed */}
              <a
                href={`https://ph.indeed.com/jobs?q=${encodeURIComponent(sourcingKeyword || userIndustry)}`}
                target="_blank"
                rel="noreferrer"
                className="p-3 rounded-xl border border-[#F1DDE9] bg-[#FAF7F9]/60 hover:bg-[#FFF0F6] hover:border-[#FF7AB3] transition flex items-center justify-between group"
              >
                <div>
                  <span className="text-xs font-bold text-[#4A3E44] block group-hover:text-[#9D3C5E]">
                    Indeed
                  </span>
                  <span className="text-[10px] text-stone-500">Direct Employer Feeds</span>
                </div>
                <ExternalLink className="w-3.5 h-3.5 text-stone-400 group-hover:text-[#FF7AB3]" />
              </a>

              {/* Google Search */}
              <a
                href={`https://www.google.com/search?q=${encodeURIComponent((sourcingKeyword || userIndustry) + ' jobs hiring 2026')}&ibp=htl;jobs`}
                target="_blank"
                rel="noreferrer"
                className="p-3 rounded-xl border border-[#F1DDE9] bg-[#FAF7F9]/60 hover:bg-[#FFF0F6] hover:border-[#FF7AB3] transition flex items-center justify-between group"
              >
                <div>
                  <span className="text-xs font-bold text-[#4A3E44] block group-hover:text-[#9D3C5E]">
                    Google Jobs
                  </span>
                  <span className="text-[10px] text-stone-400">Aggregated Search</span>
                </div>
                <ExternalLink className="w-3.5 h-3.5 text-stone-400 group-hover:text-[#FF7AB3]" />
              </a>
            </div>
          </div>

          {/* SECTION 2: AI JOB SCOUT (BRIEFLY SEARCH JOB POSTING ON THE INTERNET) */}
          <div className="bg-gradient-to-br from-white via-[#FFF0F6]/40 to-white p-5 rounded-2xl border border-[#F1DDE9] shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#FF7AB3]" />
                  <h3 className="text-sm font-bold text-[#4A3E44]">
                    AI Job Scout • Live Internet Job Search
                  </h3>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#FFF0F6] text-[#9D3C5E] border border-[#F1DDE9]">
                    AI Powered
                  </span>
                </div>
                <p className="text-xs text-[#736A6D]">
                  Briefly search job postings on the internet tailored specifically to your background, target role, and location.
                </p>
              </div>

              {/* Resume Context & Upload */}
              <div className="flex items-center gap-2 flex-wrap">
                {candidatePdfInfo ? (
                  <span className="text-[11px] font-semibold px-2.5 py-1 rounded-xl bg-purple-50 text-purple-700 border border-purple-200 flex items-center gap-1.5">
                    <FileText className="w-3 h-3 text-purple-600" />
                    <span className="max-w-[150px] truncate">{candidatePdfInfo.filename}</span>
                  </span>
                ) : null}

                <label className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-[#9D3C5E] bg-white hover:bg-[#FFF0F6] border border-[#F1DDE9] rounded-xl transition shadow-2xs cursor-pointer">
                  <Upload className={`w-3.5 h-3.5 text-[#FF7AB3] ${isPdfUploading ? 'animate-bounce' : ''}`} />
                  <span>{isPdfUploading ? 'Parsing...' : candidatePdfInfo ? 'Change Resume' : 'Import Resume PDF'}</span>
                  <input
                    type="file"
                    accept=".pdf,application/pdf"
                    onChange={handlePdfUpload}
                    disabled={isPdfUploading}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {/* AI Search Controls */}
            <form onSubmit={handleAIScout} className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-1">
              <div className="sm:col-span-5">
                <label className="text-[11px] font-bold text-[#4A3E44] block mb-1">
                  Target Role / Keywords
                </label>
                <input
                  type="text"
                  required
                  value={sourcingKeyword}
                  onChange={(e) => setSourcingKeyword(e.target.value)}
                  placeholder="e.g. Tourism Management, Hotel Reservations, Software Engineer"
                  className="w-full px-3 py-2 rounded-xl border border-[#F1DDE9] text-xs text-[#4A3E44] bg-white focus:outline-none focus:border-[#FF7AB3]"
                />
              </div>

              <div className="sm:col-span-4">
                <label className="text-[11px] font-bold text-[#4A3E44] block mb-1">
                  Location Preference
                </label>
                <input
                  type="text"
                  value={sourcingLocation}
                  onChange={(e) => setSourcingLocation(e.target.value)}
                  placeholder="e.g. Metro Manila / Philippines or Remote"
                  className="w-full px-3 py-2 rounded-xl border border-[#F1DDE9] text-xs text-[#4A3E44] bg-white focus:outline-none focus:border-[#FF7AB3]"
                />
              </div>

              <div className="sm:col-span-3 flex items-end">
                <button
                  type="submit"
                  disabled={aiSearching}
                  className="w-full px-4 py-2 text-xs font-bold text-white bg-gradient-to-r from-[#FF7AB3] to-[#9D3C5E] hover:from-[#ff6aa8] hover:to-[#8c3553] rounded-xl shadow-xs transition flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <Sparkles className={`w-3.5 h-3.5 ${aiSearching ? 'animate-spin' : ''}`} />
                  <span>{aiSearching ? 'Scouting Jobs...' : '✨ AI Search Job Postings'}</span>
                </button>
              </div>
            </form>

            {/* Resume context toggle if candidate uploaded a resume */}
            {candidatePdfInfo && (
              <label className="flex items-center gap-2 text-[11px] text-[#736A6D] cursor-pointer pt-0.5">
                <input
                  type="checkbox"
                  checked={useResumeContext}
                  onChange={(e) => setUseResumeContext(e.target.checked)}
                  className="rounded border-[#F1DDE9] text-[#FF7AB3] focus:ring-0"
                />
                <span>Include candidate resume credentials to match qualification fit</span>
              </label>
            )}

            {aiSearchError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700">
                {aiSearchError}
              </div>
            )}
          </div>

          {/* SECTION 3: AI DISCOVERED RESULTS */}
          {aiSearchResults.length > 0 && (
            <div className="space-y-3.5">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-[#4A3E44] flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-[#FF7AB3]" />
                  <span>AI Discovered Job Postings ({aiSearchResults.length})</span>
                </h3>
                <span className="text-[11px] text-[#736A6D]">
                  Curated across the internet • 1-click add to your leads pipeline
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {aiSearchResults.map((lead) => {
                  const alreadySaved = existingApplications.some(
                    (a) =>
                      a.role_title.toLowerCase() === lead.title.toLowerCase() &&
                      a.company_name.toLowerCase() === lead.company_name.toLowerCase()
                  ) || addedIds.has(lead.id);
                  const isAdding = addingId === lead.id;

                  return (
                    <div
                      key={lead.id}
                      className="bg-white p-4.5 rounded-2xl border border-[#F1DDE9] hover:border-[#FF7AB3] hover:shadow-xs transition flex flex-col justify-between space-y-3 group"
                    >
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-9 h-9 rounded-xl bg-[#FAF7F9] border border-[#F1DDE9] flex items-center justify-center shrink-0 overflow-hidden">
                              {lead.company_logo ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={lead.company_logo} alt="" className="w-5 h-5 object-contain" />
                              ) : (
                                <Building2 className="w-4 h-4 text-[#FF7AB3]" />
                              )}
                            </div>
                            <div>
                              <span className="text-xs font-bold text-[#4A3E44] group-hover:text-[#9D3C5E] transition block">
                                {lead.company_name}
                              </span>
                              <span className="text-[11px] text-[#736A6D] flex items-center gap-1">
                                <MapPin className="w-3 h-3 text-stone-400" />
                                {lead.location}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5">
                            {lead.remote && (
                              <span className="text-[10px] font-semibold text-[#9D3C5E] bg-[#FFF0F6] px-2 py-0.5 rounded-full border border-[#F1DDE9]">
                                Remote
                              </span>
                            )}
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                              {lead.match_score}% Fit
                            </span>
                          </div>
                        </div>

                        <h3 className="text-sm font-bold text-[#4A3E44] line-clamp-1">{lead.title}</h3>

                        {lead.description && (
                          <p className="text-xs text-[#736A6D] line-clamp-2 leading-relaxed">
                            {lead.description}
                          </p>
                        )}

                        {lead.ai_verdict && (
                          <div className="text-[11px] text-[#9D3C5E] bg-[#FFF0F6]/70 p-2 rounded-xl border border-[#F1DDE9]/60">
                            <strong>AI Verdict:</strong> {lead.ai_verdict}
                          </div>
                        )}

                        {lead.salary_range && (
                          <div className="text-[11px] font-semibold text-[#4A3E44]">
                            Est. Compensation: <span className="text-emerald-700">{lead.salary_range}</span>
                          </div>
                        )}

                        <div className="flex items-center gap-1.5 flex-wrap pt-1">
                          {lead.tags?.slice(0, 4).map((tag) => (
                            <span
                              key={tag}
                              className="text-[10px] font-medium text-stone-600 bg-stone-50 px-2 py-0.5 rounded-md border border-stone-200"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="pt-3 border-t border-[#F1DDE9]/60 flex items-center justify-between">
                        {lead.search_url ? (
                          <a
                            href={lead.search_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs font-semibold text-[#9D3C5E] hover:underline inline-flex items-center gap-1"
                          >
                            <span>View Job on Google Jobs</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : <span />}

                        <button
                          onClick={() => handleAddGeneratedLead(lead)}
                          disabled={alreadySaved || isAdding}
                          className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                            alreadySaved
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 cursor-default'
                              : 'bg-[#FF7AB3] text-white hover:bg-[#F06292] shadow-xs'
                          }`}
                        >
                          {alreadySaved ? (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              <span>Saved to Leads</span>
                            </>
                          ) : isAdding ? (
                            <span>Saving...</span>
                          ) : (
                            <>
                              <Plus className="w-3.5 h-3.5" />
                              <span>Add as Lead</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* SECTION 4: MEMBER ONBOARDING NOTICE (IF NO AI SEARCH PERFORMED YET) */}
          {!isAdmin && aiSearchResults.length === 0 && (
            <div className="p-6 bg-white rounded-2xl border border-[#F1DDE9] text-center space-y-3">
              <div className="w-10 h-10 rounded-2xl bg-[#FFF0F6] text-[#FF7AB3] flex items-center justify-center mx-auto">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-[#4A3E44]">
                  Ready to scout jobs for {userIndustry}?
                </h4>
                <p className="text-xs text-[#736A6D] max-w-md mx-auto mt-1">
                  We removed seeded IT software leads for member accounts so your workspace stays clean and dedicated to your background.
                  Click <strong>&quot;AI Search Job Postings&quot;</strong> above or click any of the <strong>Direct Sourcing Launchpads</strong> to discover active openings on the internet.
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleAIScout()}
                disabled={aiSearching}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-gradient-to-r from-[#FF7AB3] to-[#9D3C5E] hover:from-[#ff6aa8] hover:to-[#8c3553] rounded-xl shadow-xs transition"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Search {userIndustry} Roles with AI</span>
              </button>
            </div>
          )}

          {/* SECTION 5: QUICK-ADD LEAD FORM */}
          <div className="bg-white p-5 rounded-2xl border border-[#F1DDE9] shadow-2xs space-y-3">
            <h4 className="text-xs font-bold text-[#736A6D] uppercase tracking-wider flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5 text-[#FF7AB3]" />
              <span>Quick-Add Lead Found on Job Boards</span>
            </h4>

            {manualSuccess && (
              <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-700 flex items-center gap-2">
                <Check className="w-4 h-4 shrink-0" />
                <span>Lead added to your leads pipeline successfully without modifying companies!</span>
              </div>
            )}

            <form onSubmit={handleManualAdd} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <input
                  type="text"
                  required
                  placeholder="Role / Job Title (e.g. Front Office Supervisor)"
                  value={manualTitle}
                  onChange={(e) => setManualTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#F1DDE9] text-xs text-[#4A3E44] focus:outline-none focus:border-[#FF7AB3] bg-[#FAF7F9]/50"
                />
              </div>
              <div>
                <input
                  type="text"
                  required
                  placeholder="Company Name"
                  value={manualCompany}
                  onChange={(e) => setManualCompany(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#F1DDE9] text-xs text-[#4A3E44] focus:outline-none focus:border-[#FF7AB3] bg-[#FAF7F9]/50"
                />
              </div>
              <div>
                <input
                  type="url"
                  placeholder="Job URL (LinkedIn / JobStreet / Google link)"
                  value={manualUrl}
                  onChange={(e) => setManualUrl(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#F1DDE9] text-xs text-[#4A3E44] focus:outline-none focus:border-[#FF7AB3] bg-[#FAF7F9]/50"
                />
              </div>

              <div className="sm:col-span-3 flex justify-end">
                <button
                  type="submit"
                  disabled={manualSaving}
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#FF7AB3] hover:bg-[#F06292] rounded-xl shadow-xs transition flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{manualSaving ? 'Saving...' : 'Save as Lead'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* SECTION 6: ADMIN SEEDED / CURATED FEED (ONLY IF ADMIN AND LEADS EXIST) */}
          {isAdmin && leads.length > 0 && (
            <div className="space-y-3.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-[#F1DDE9]">
                <div>
                  <h2 className="text-sm font-bold text-[#4A3E44] flex items-center gap-1.5">
                    <Compass className="w-4 h-4 text-[#FF7AB3]" />
                    <span>Admin Seeded Opportunities Feed</span>
                  </h2>
                  <p className="text-xs text-[#736A6D]">
                    Seeded developer opportunities matching admin tech portfolio
                  </p>
                </div>

                <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Filter seeded roles, tags..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="w-56 pl-8 pr-3 py-1.5 rounded-xl border border-[#F1DDE9] text-xs text-[#4A3E44] placeholder-stone-400 focus:outline-none focus:border-[#FF7AB3] transition bg-white"
                    />
                    <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-2" />
                  </div>
                  <button
                    type="submit"
                    className="px-3.5 py-1.5 text-xs font-semibold text-white bg-[#FF7AB3] hover:bg-[#F06292] rounded-xl transition"
                  >
                    Find
                  </button>
                </form>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {leads.map((lead) => {
                  const alreadyAdded = isAlreadyTracked(lead);
                  const isAdding = addingId === lead.id;

                  return (
                    <div
                      key={lead.id}
                      className="bg-white p-4.5 rounded-2xl border border-[#F1DDE9] hover:border-[#FF7AB3] hover:shadow-xs transition flex flex-col justify-between space-y-3 group"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div className="flex items-center gap-2.5">
                            <div className="w-9 h-9 rounded-xl bg-[#FAF7F9] border border-[#F1DDE9] flex items-center justify-center shrink-0">
                              <Building2 className="w-4 h-4 text-[#FF7AB3]" />
                            </div>
                            <div>
                              <span className="text-xs font-bold text-[#4A3E44] group-hover:text-[#9D3C5E] transition block">
                                {lead.company_name}
                              </span>
                              <span className="text-[11px] text-[#736A6D] flex items-center gap-1">
                                <MapPin className="w-3 h-3 text-stone-400" />
                                {lead.location}
                              </span>
                            </div>
                          </div>

                          {lead.remote && (
                            <span className="text-[10px] font-semibold text-[#9D3C5E] bg-[#FFF0F6] px-2 py-0.5 rounded-full border border-[#F1DDE9]">
                              Remote
                            </span>
                          )}
                        </div>

                        <h3 className="text-sm font-bold text-[#4A3E44] line-clamp-1">
                          {lead.title}
                        </h3>

                        {lead.description && (
                          <p className="text-xs text-[#736A6D] line-clamp-2 mt-1 leading-relaxed">
                            {lead.description}
                          </p>
                        )}

                        <div className="flex items-center gap-1.5 flex-wrap mt-2.5">
                          {lead.tags.slice(0, 4).map((tag) => (
                            <span
                              key={tag}
                              className="text-[10px] font-medium text-stone-600 bg-stone-50 px-2 py-0.5 rounded-md border border-stone-200"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="pt-3 border-t border-[#F1DDE9]/60 flex items-center justify-between">
                        {lead.url ? (
                          <a
                            href={lead.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs font-medium text-stone-500 hover:text-[#9D3C5E] inline-flex items-center gap-1 transition"
                          >
                            <span>View Job Posting</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : <span />}

                        <button
                          onClick={() => handleAdd(lead)}
                          disabled={alreadyAdded || isAdding}
                          className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                            alreadyAdded
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 cursor-default'
                              : 'bg-[#FF7AB3] text-white hover:bg-[#F06292] shadow-xs'
                          }`}
                        >
                          {alreadyAdded ? (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              <span>Saved to Leads</span>
                            </>
                          ) : isAdding ? (
                            <span>Saving...</span>
                          ) : (
                            <>
                              <Plus className="w-3.5 h-3.5" />
                              <span>Add as Lead</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
