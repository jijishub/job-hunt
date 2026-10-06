'use client';

import React, { useState, useEffect } from 'react';
import { JobApplication, UserAccount } from '@/types/job';
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
  Briefcase,
} from 'lucide-react';

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
}

export default function JobLeadsView({
  onAddToTracker,
  existingApplications,
  currentUser,
}: JobLeadsViewProps) {
  const [leads, setLeads] = useState<JobLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [addingId, setAddingId] = useState<string | null>(null);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());

  // Portfolio state (Admin only)
  const isAdmin = currentUser?.role === 'admin';
  const [portfolioData, setPortfolioData] = useState<any>(null);
  const [portfolioLoading, setPortfolioLoading] = useState(false);

  // Manual Quick-Add state (For Members)
  const [manualTitle, setManualTitle] = useState('');
  const [manualCompany, setManualCompany] = useState('');
  const [manualUrl, setManualUrl] = useState('');
  const [manualNotes, setManualNotes] = useState('');
  const [manualSaving, setManualSaving] = useState(false);
  const [manualSuccess, setManualSuccess] = useState(false);

  const fetchLeads = async (q: string = '') => {
    setLoading(true);
    try {
      const res = await fetch(`/api/leads${q ? `?q=${encodeURIComponent(q)}` : ''}`);
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
      if (data.success) {
        setPortfolioData(data.data);
      }
    } catch (err) {
      console.error('Failed to load portfolio:', err);
    } finally {
      setPortfolioLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
    if (isAdmin) {
      loadPortfolioData();
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

  const userIndustry = currentUser?.industry || 'Hospitality Management';

  return (
    <div className="space-y-6">
      {/* Role-Specific Hero Section */}
      {isAdmin ? (
        /* Admin: Portfolio Integration Banner */
        <div className="bg-gradient-to-r from-white via-[#FFF0F6] to-white p-5 rounded-3xl border border-[#F1DDE9] shadow-2xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-lg">🌸</span>
                <h3 className="text-sm font-bold text-[#4A3E44]">
                  Administrator Career Hub • Live Portfolio Synced
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  jizellecasia.vercel.app
                </span>
              </div>
              <p className="text-xs text-[#736A6D]">
                Auto-matches opportunities against your live projects, skills, and target roles (Forward-Deployed Engineer & AI Automation).
              </p>
            </div>

            <button
              onClick={loadPortfolioData}
              disabled={portfolioLoading}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#9D3C5E] bg-white hover:bg-[#FFF0F6] border border-[#F1DDE9] rounded-xl transition shadow-2xs self-start md:self-auto disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${portfolioLoading ? 'animate-spin' : ''}`} />
              <span>{portfolioLoading ? 'Refreshing...' : 'Re-sync Portfolio'}</span>
            </button>
          </div>

          {portfolioData && (
            <div className="mt-3.5 pt-3.5 border-t border-[#F1DDE9]/70 flex items-center gap-1.5 flex-wrap text-xs text-[#736A6D]">
              <span className="font-semibold text-[#4A3E44]">Verified Skills:</span>
              {(portfolioData.skills || []).slice(0, 8).map((skill: string) => (
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
                <span className="text-lg">{currentUser?.avatar || '✨'}</span>
                <h3 className="text-sm font-bold text-[#4A3E44]">
                  {currentUser?.name}&apos;s Sourcing Hub • {userIndustry}
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                  Cloud DB Isolated
                </span>
              </div>
              <p className="text-xs text-[#736A6D]">
                Curated launchpads and quick lead intake tailored specifically for {userIndustry} roles.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 4 Dedicated Sourcing Channels Launchpad */}
      <div className="bg-white p-4.5 rounded-2xl border border-[#F1DDE9] space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold text-[#736A6D] uppercase tracking-wider flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5 text-[#FF7AB3]" />
            <span>Direct Sourcing Launchpads</span>
          </h4>
          <span className="text-[11px] text-[#736A6D]">
            Target: <strong className="text-[#4A3E44]">{isAdmin ? 'Software & AI Roles' : userIndustry}</strong>
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {/* LinkedIn */}
          <a
            href={
              isAdmin
                ? 'https://www.linkedin.com/jobs/search/?keywords=Forward-Deployed%20Engineer'
                : `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(userIndustry)}`
            }
            target="_blank"
            rel="noreferrer"
            className="p-3 rounded-xl border border-[#F1DDE9] bg-[#FAF7F9]/60 hover:bg-[#FFF0F6] hover:border-[#FF7AB3] transition flex items-center justify-between group"
          >
            <div>
              <span className="text-xs font-bold text-[#4A3E44] block group-hover:text-[#9D3C5E]">
                LinkedIn Jobs
              </span>
              <span className="text-[10px] text-stone-500">Global & Remote</span>
            </div>
            <ExternalLink className="w-3.5 h-3.5 text-stone-400 group-hover:text-[#FF7AB3]" />
          </a>

          {/* JobStreet */}
          <a
            href={`https://www.jobstreet.com.ph/en/job-search/${encodeURIComponent(isAdmin ? 'Software Developer' : userIndustry)}-jobs/`}
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
            href={`https://ph.indeed.com/jobs?q=${encodeURIComponent(isAdmin ? 'Software Engineer' : userIndustry)}`}
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

          {/* Google Search (Lower Prio) */}
          <a
            href={`https://www.google.com/search?q=${encodeURIComponent((isAdmin ? 'Software Engineer' : userIndustry) + ' jobs hiring 2026')}&ibp=htl;jobs`}
            target="_blank"
            rel="noreferrer"
            className="p-3 rounded-xl border border-[#F1DDE9] bg-[#FAF7F9]/60 hover:bg-[#FFF0F6] hover:border-[#FF7AB3] transition flex items-center justify-between group"
          >
            <div>
              <span className="text-xs font-bold text-[#4A3E44] block group-hover:text-[#9D3C5E]">
                Google Search
              </span>
              <span className="text-[10px] text-stone-400">Aggregated Search</span>
            </div>
            <ExternalLink className="w-3.5 h-3.5 text-stone-400 group-hover:text-[#FF7AB3]" />
          </a>
        </div>
      </div>

      {/* Manual Quick-Add Form (Specifically helpful for non-IT members who source manually) */}
      {!isAdmin && (
        <div className="bg-white p-5 rounded-2xl border border-purple-200/80 shadow-2xs space-y-3">
          <h4 className="text-xs font-bold text-[#736A6D] uppercase tracking-wider flex items-center gap-1.5">
            <Plus className="w-3.5 h-3.5 text-purple-600" />
            <span>Quick-Add Lead Found on Job Boards</span>
          </h4>

          {manualSuccess && (
            <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-700 flex items-center gap-2">
              <Check className="w-4 h-4 shrink-0" />
              <span>Lead added to your tracker pipeline successfully!</span>
            </div>
          )}

          <form onSubmit={handleManualAdd} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <input
                type="text"
                required
                placeholder="Role / Job Title (e.g. Hotel Guest Lead)"
                value={manualTitle}
                onChange={(e) => setManualTitle(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#F1DDE9] text-xs text-[#4A3E44] focus:outline-none focus:border-[#FF7AB3] bg-[#FAF7F9]/50"
              />
            </div>
            <div>
              <input
                type="text"
                required
                placeholder="Company / Hotel / Venue"
                value={manualCompany}
                onChange={(e) => setManualCompany(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#F1DDE9] text-xs text-[#4A3E44] focus:outline-none focus:border-[#FF7AB3] bg-[#FAF7F9]/50"
              />
            </div>
            <div>
              <input
                type="url"
                placeholder="Job URL (LinkedIn / JobStreet link)"
                value={manualUrl}
                onChange={(e) => setManualUrl(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#F1DDE9] text-xs text-[#4A3E44] focus:outline-none focus:border-[#FF7AB3] bg-[#FAF7F9]/50"
              />
            </div>

            <div className="sm:col-span-3 flex justify-end">
              <button
                type="submit"
                disabled={manualSaving}
                className="px-4 py-2 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-xl shadow-xs transition flex items-center gap-1.5 disabled:opacity-50"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{manualSaving ? 'Saving...' : 'Add Lead to My Tracker'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Search & Leads Explorer */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-[#F1DDE9]">
        <div>
          <h2 className="text-sm font-bold text-[#4A3E44] flex items-center gap-1.5">
            <Compass className="w-4 h-4 text-[#FF7AB3]" />
            <span>Curated Opportunities Feed</span>
          </h2>
          <p className="text-xs text-[#736A6D]">
            Explore opportunities and add them directly to your tracking board
          </p>
        </div>

        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
          <div className="relative">
            <input
              type="text"
              placeholder="Search roles, tags, skills..."
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

      {/* Leads Grid */}
      {loading ? (
        <div className="py-20 text-center">
          <div className="w-8 h-8 border-2 border-[#FF7AB3] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-xs text-[#736A6D]">Searching for open opportunities...</p>
        </div>
      ) : leads.length === 0 ? (
        <div className="py-16 text-center bg-white rounded-2xl border border-[#F1DDE9]">
          <p className="text-xs text-[#736A6D]">No leads found matching your search. Try another keyword!</p>
        </div>
      ) : (
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
      )}
    </div>
  );
}
