'use client';

import React, { useState, useEffect } from 'react';
import { JobApplication } from '@/types/job';
import {
  Compass,
  Search,
  ExternalLink,
  Plus,
  Building2,
  MapPin,
  Check,
  Sparkles,
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
}

export default function JobLeadsView({
  onAddToTracker,
  existingApplications,
}: JobLeadsViewProps) {
  const [leads, setLeads] = useState<JobLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [addingId, setAddingId] = useState<string | null>(null);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());

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

  useEffect(() => {
    fetchLeads();
  }, []);

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
        notes: `Discovered from Job Leads Explorer.\nTags: ${lead.tags.join(', ')}\n${lead.description}`,
      });
      setAddedIds((prev) => new Set(prev).add(lead.id));
    } catch (err) {
      console.error(err);
    } finally {
      setAddingId(null);
    }
  };

  return (
    <div className="space-y-5">
      {/* Search & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-[#F1DDE9]">
        <div>
          <h2 className="text-sm font-bold text-[#4A3E44] flex items-center gap-1.5">
            <Compass className="w-4 h-4 text-[#FF7AB3]" />
            <span>Discover Opportunities & Leads</span>
          </h2>
          <p className="text-xs text-[#736A6D]">
            Curated remote tech, design & OJT roles ready to add to your tracker
          </p>
        </div>

        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
          <div className="relative">
            <input
              type="text"
              placeholder="Search (e.g. React, UI, OJT)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-56 pl-8 pr-3 py-1.5 rounded-xl border border-[#F1DDE9] text-xs text-[#4A3E44] placeholder-stone-400 focus:outline-none focus:border-[#FF7AB3] transition"
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

      {/* Leads List */}
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
                className="bg-white p-4.5 rounded-2xl border border-[#F1DDE9] hover:border-[#FF7AB3] hover:shadow-sm transition flex flex-col justify-between space-y-3 group"
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

                  {/* Tags */}
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

                {/* Actions */}
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

