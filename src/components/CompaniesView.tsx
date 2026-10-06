'use client';

import React from 'react';
import { Company } from '@/types/job';
import {
  Building2,
  ExternalLink,
  Plus,
  Edit3,
  Trash2,
  Globe,
  Briefcase,
} from 'lucide-react';

interface CompaniesViewProps {
  companies: (Company & { applicationCount?: number })[];
  onAddCompany: () => void;
  onEditCompany: (company: Company) => void;
  onDeleteCompany: (id: string) => Promise<void>;
  onFilterByCompany?: (companyName: string) => void;
}

export default function CompaniesView({
  companies,
  onAddCompany,
  onEditCompany,
  onDeleteCompany,
}: CompaniesViewProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-[#4A3E44]">
            Reusable Company Directory ({companies.length})
          </h2>
          <p className="text-xs text-[#736A6D]">
            Manage company profiles, logos, and tracked opportunities
          </p>
        </div>
        <button
          onClick={onAddCompany}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-white bg-[#FF7AB3] hover:bg-[#F06292] rounded-xl shadow-xs transition"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Company</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {companies.map((company) => {
          return (
            <div
              key={company.id}
              className="bg-white p-4 rounded-2xl border border-[#F1DDE9] hover:border-[#FF7AB3] hover:shadow-sm transition group flex flex-col justify-between"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-[#FAF7F9] border border-[#F1DDE9] flex items-center justify-center shrink-0 overflow-hidden shadow-2xs">
                    {company.logo_url?.startsWith('emoji:') ? (
                      <span className="text-2xl">{company.logo_url.replace('emoji:', '')}</span>
                    ) : company.logo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={company.logo_url}
                        alt={company.name}
                        className="w-7 h-7 object-contain"
                      />
                    ) : (
                      <Building2 className="w-6 h-6 text-stone-300" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-[#4A3E44] group-hover:text-[#9D3C5E] transition">
                      {company.name}
                    </h3>
                    <p className="text-xs text-[#736A6D]">
                      {company.industry || 'Tech & Product'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => onEditCompany(company)}
                    title="Edit Company"
                    className="p-1.5 text-stone-400 hover:text-[#9D3C5E] hover:bg-[#FAF7F9] rounded-lg transition"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={async () => {
                      if (confirm(`Delete company ${company.name}?`)) {
                        await onDeleteCompany(company.id);
                      }
                    }}
                    title="Delete"
                    className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-[#F1DDE9]/60 flex items-center justify-between text-xs text-[#736A6D]">
                <div className="flex items-center gap-1 font-medium">
                  <Briefcase className="w-3.5 h-3.5 text-[#FF7AB3]" />
                  <span className="text-[#4A3E44]">
                    {company.applicationCount || 0} applications
                  </span>
                </div>

                {company.website && (
                  <a
                    href={
                      company.website.startsWith('http')
                        ? company.website
                        : `https://${company.website}`
                    }
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] text-stone-400 hover:text-[#FF7AB3] transition"
                  >
                    <Globe className="w-3 h-3" />
                    <span>Website</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

