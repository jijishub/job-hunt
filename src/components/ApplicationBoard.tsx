'use client';

import React from 'react';
import { JobApplication, ApplicationStatus } from '@/types/job';
import PriorityBadge from './PriorityBadge';
import {
  Building2,
  MapPin,
  Plus,
  CheckCircle2,
} from 'lucide-react';

interface ApplicationBoardProps {
  applications: JobApplication[];
  onSelectApp: (app: JobApplication) => void;
  onNewAppWithStatus: (status: ApplicationStatus) => void;
  onUpdateStatus: (id: string, newStatus: ApplicationStatus) => Promise<void>;
}

const COLUMNS: { status: ApplicationStatus; title: string; color: string; badgeDot: string }[] = [
  { status: 'LEAD', title: 'Leads & Wishlist', color: 'border-purple-200 bg-purple-50/40', badgeDot: 'bg-purple-400' },
  { status: 'APPLIED', title: 'Applied', color: 'border-sky-200 bg-sky-50/40', badgeDot: 'bg-sky-400' },
  { status: 'SCREENING', title: 'Screening Call', color: 'border-amber-200 bg-amber-50/40', badgeDot: 'bg-amber-400' },
  { status: 'INTERVIEWING', title: 'Interviewing', color: 'border-[#F1DDE9] bg-pink-50/40', badgeDot: 'bg-[#FF7AB3]' },
  { status: 'OFFER', title: 'Offer Received 🎉', color: 'border-emerald-200 bg-emerald-50/40', badgeDot: 'bg-emerald-400' },
  { status: 'REJECTED', title: 'Archived / Rejected', color: 'border-stone-200 bg-stone-50/40', badgeDot: 'bg-stone-400' },
];

export default function ApplicationBoard({
  applications,
  onSelectApp,
  onNewAppWithStatus,
  onUpdateStatus,
}: ApplicationBoardProps) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-6 pt-1 items-start min-h-[600px]">
      {COLUMNS.map((col) => {
        const colApps = applications.filter((app) => {
          if (col.status === 'REJECTED') {
            return app.status === 'REJECTED' || app.status === 'WITHDRAWN';
          }
          if (col.status === 'OFFER') {
            return app.status === 'OFFER' || app.status === 'ACCEPTED';
          }
          return app.status === col.status;
        });

        return (
          <div
            key={col.status}
            className="w-72 shrink-0 bg-[#FAF7F9] rounded-2xl border border-[#F1DDE9] p-3 flex flex-col max-h-[82vh]"
          >
            <div className="flex items-center justify-between px-2 py-1.5 mb-2.5">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${col.badgeDot}`} />
                <h3 className="text-xs font-semibold text-[#4A3E44]">{col.title}</h3>
                <span className="text-[11px] font-medium text-[#736A6D] px-1.5 py-0.5 rounded-full bg-white border border-[#F1DDE9]">
                  {colApps.length}
                </span>
              </div>
              <button
                onClick={() => onNewAppWithStatus(col.status)}
                title="Add to column"
                className="p-1 rounded-lg text-stone-400 hover:text-[#9D3C5E] hover:bg-[#FCE7F3] transition"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-2.5 overflow-y-auto pr-1">
              {colApps.map((app) => (
                <div
                  key={app.id}
                  onClick={() => onSelectApp(app)}
                  className="group bg-white p-3.5 rounded-xl border border-[#F1DDE9] hover:border-[#FF7AB3] hover:shadow-sm cursor-pointer transition-all space-y-2.5 relative"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <div className="w-5 h-5 rounded bg-stone-50 border border-[#F1DDE9] flex items-center justify-center shrink-0 overflow-hidden">
                        {app.company_logo?.startsWith('emoji:') ? (
                          <span className="text-xs">{app.company_logo.replace('emoji:', '')}</span>
                        ) : app.company_logo ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={app.company_logo} alt="" className="w-3.5 h-3.5 object-contain" />
                        ) : (
                          <Building2 className="w-3 h-3 text-stone-300" />
                        )}
                      </div>
                      <span className="text-xs font-semibold text-[#736A6D]">
                        {app.company_name}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      {app.notion_page_id && (
                        <CheckCircle2 className="w-3.5 h-3.5 text-purple-400" />
                      )}
                      <PriorityBadge priority={app.priority} size="sm" />
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold text-[#4A3E44] group-hover:text-[#9D3C5E] transition line-clamp-2">
                      {app.role_title}
                    </h4>
                    {app.information && (
                      <p className="text-[10px] text-[#736A6D] italic truncate mt-0.5" title={app.information}>
                        📌 {app.information}
                      </p>
                    )}
                  </div>

                  {/* Notion Stage & Service Categorization Badges */}
                  {(app.notion_status || app.service) && (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {app.notion_status && (
                        <span className="inline-block px-2 py-0.5 rounded-md text-[9px] font-bold bg-[#FFF0F6] text-[#9D3C5E] border border-[#F1DDE9] truncate max-w-[140px]" title={app.notion_status}>
                          {app.notion_status}
                        </span>
                      )}
                      {app.service && (
                        <span className="inline-block px-2 py-0.5 rounded-md text-[9px] font-semibold bg-stone-100 text-[#736A6D] border border-stone-200/60 truncate max-w-[120px]" title={app.service}>
                          🏷️ {app.service}
                        </span>
                      )}
                    </div>
                  )}

                  <div className="text-[11px] text-[#736A6D] space-y-1">
                    {app.salary_min || app.salary_max ? (
                      <div>
                        {app.salary_currency}{' '}
                        {[
                          app.salary_min ? app.salary_min.toLocaleString() : '',
                          app.salary_max ? `- ${app.salary_max.toLocaleString()}` : '',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                      </div>
                    ) : null}
                    {app.location && (
                      <div className="flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-stone-400" />
                        <span className="truncate">{app.location}</span>
                      </div>
                    )}
                  </div>

                  <div
                    className="pt-2 border-t border-[#F1DDE9]/60 flex items-center justify-between text-[11px]"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span className="text-stone-400 text-[10px]">Move to:</span>
                    <select
                      value={app.status}
                      onChange={(e) =>
                        onUpdateStatus(app.id, e.target.value as ApplicationStatus)
                      }
                      className="text-[11px] font-medium text-[#736A6D] bg-stone-50 hover:bg-[#FCE7F3] border border-[#F1DDE9] rounded-lg px-2 py-0.5 focus:outline-none transition"
                    >
                      <option value="LEAD">Lead</option>
                      <option value="APPLIED">Applied</option>
                      <option value="SCREENING">Screening</option>
                      <option value="INTERVIEWING">Interviewing</option>
                      <option value="OFFER">Offer</option>
                      <option value="REJECTED">Rejected</option>
                    </select>
                  </div>
                </div>
              ))}

              {colApps.length === 0 && (
                <div className="py-6 text-center text-[11px] text-stone-400 border border-dashed border-[#F1DDE9] rounded-xl">
                  No applications
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

