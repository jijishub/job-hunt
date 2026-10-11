'use client';

import RoleFitBadge from './RoleFitBadge';

import React from 'react';
import { JobApplication } from '@/types/job';
import StatusBadge from './StatusBadge';
import PriorityBadge from './PriorityBadge';
import { formatSalaryRange } from '@/lib/currencies';
import {
  Building2,
  ExternalLink,
  MapPin,
  Calendar,
  Sparkles,
  Edit3,
  Trash2,
  CheckCircle2,
} from 'lucide-react';

interface ApplicationTableProps {
  applications: JobApplication[];
  onSelectApp: (app: JobApplication) => void;
  onEditApp: (app: JobApplication) => void;
  onDeleteApp: (id: string) => Promise<void>;
}

export default function ApplicationTable({
  applications,
  onSelectApp,
  onEditApp,
  onDeleteApp,
}: ApplicationTableProps) {
  if (applications.length === 0) {
    return (
      <div className="text-center py-16 px-4 bg-white rounded-2xl border border-[#F1DDE9]">
        <div className="w-12 h-12 rounded-2xl bg-[#FCE7F3] text-[#FF7AB3] flex items-center justify-center mx-auto mb-3">
          <Sparkles className="w-6 h-6" />
        </div>
        <h3 className="text-sm font-semibold text-[#4A3E44]">No applications found</h3>
        <p className="text-xs text-[#736A6D] mt-1 max-w-sm mx-auto">
          Start tracking your job search by clicking &quot;+ New Application&quot; or syncing from Notion.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-[#F1DDE9] shadow-xs overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-[#F1DDE9] bg-[#FAF7F9] text-[#736A6D] font-semibold tracking-wider">
              <th className="py-3 px-4 w-[28%]">ROLE & POSITION</th>
              <th className="py-3 px-4 w-[20%]">COMPANY</th>
              <th className="py-3 px-4 w-[14%]">STATUS</th>
              <th className="py-3 px-4">ROLE FIT</th>
              <th className="py-3 px-4 w-[12%]">PRIORITY</th>
              <th className="py-3 px-4 w-[14%]">WORK MODEL</th>
              <th className="py-3 px-4 w-[12%]">DATE APPLIED</th>
              <th className="py-3 px-3 text-right">ACTIONS</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-[#F1DDE9]/60">
            {applications.map((app) => {
              const formattedDate = app.date_applied
                ? new Date(app.date_applied).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })
                : '—';
              const salary = formatSalaryRange(app.salary_min, app.salary_max, app.salary_currency);

              return (
                <tr
                  key={app.id}
                  onClick={() => onSelectApp(app)}
                  className="group hover:bg-[#FFF5F8]/70 cursor-pointer transition-colors"
                >
                  <td className="py-3.5 px-4 font-medium text-[#4A3E44]">
                    <div className="flex items-center gap-2">
                      <span className="group-hover:text-[#9D3C5E] transition font-semibold">
                        {app.role_title}
                      </span>
                      {app.notion_page_id && (
                        <span title="Synced with Notion">
                          <CheckCircle2 className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                        </span>
                      )}
                    </div>
                    {app.not_proceeding && <span className="block text-[10px] text-rose-700 mt-1">Not Proceeding</span>}
                    {app.notes && (
                      <span className="text-[10px] text-[#736A6D] block truncate max-w-[220px] mt-0.5" title={app.notes}>
                        {app.notes}
                      </span>
                    )}
                    {salary ? (
                      <span className="text-[11px] text-[#736A6D] block mt-0.5">
                        {salary}
                      </span>
                    ) : null}
                  </td>

                  <td className="py-3.5 px-4 text-[#4A3E44]">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-[#FAF7F9] border border-[#F1DDE9] flex items-center justify-center shrink-0 overflow-hidden shadow-2xs">
                        {app.company_logo?.startsWith('emoji:') ? (
                          <span className="text-xs">{app.company_logo.replace('emoji:', '')}</span>
                        ) : app.company_logo ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={app.company_logo}
                            alt=""
                            className="w-4 h-4 object-contain"
                          />
                        ) : (
                          <Building2 className="w-3 h-3 text-stone-300" />
                        )}
                      </div>
                      <span className="font-medium text-[#4A3E44]">{app.company_name}</span>
                    </div>
                    {app.service && (
                      <div className="mt-1">
                        <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-semibold bg-[#FFF0F6] text-[#9D3C5E] border border-[#F1DDE9] truncate max-w-[180px]" title={app.service}>
                          {app.service}
                        </span>
                      </div>
                    )}
                  </td>

                  <td className="py-3.5 px-4">
                    <StatusBadge status={app.notion_status || app.status} size="sm" />
                  </td>

                  <td className="py-3 px-4"><RoleFitBadge app={app} /></td>
                  <td className="py-3.5 px-4">
                    <PriorityBadge priority={app.priority} size="sm" />
                  </td>

                  <td className="py-3.5 px-4 text-[#736A6D]">
                    <div className="flex items-center gap-1 font-medium capitalize">
                      {app.work_model.toLowerCase().replace('_', '-')}
                    </div>
                    {app.location && (
                      <div className="flex items-center gap-0.5 text-[11px] text-[#736A6D]/80 mt-0.5 truncate max-w-[140px]">
                        <MapPin className="w-2.5 h-2.5 shrink-0" />
                        <span className="truncate">{app.location}</span>
                      </div>
                    )}
                  </td>

                  <td className="py-3.5 px-4 text-[#736A6D] whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-stone-400" />
                      <span>{formattedDate}</span>
                    </div>
                  </td>

                  <td
                    className="py-3.5 px-3 text-right"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-end gap-1 opacity-80 group-hover:opacity-100 transition">
                      {app.job_url && (
                        <a
                          href={app.job_url}
                          target="_blank"
                          rel="noreferrer"
                          title="Open Posting"
                          className="p-1.5 text-stone-400 hover:text-[#FF7AB3] hover:bg-white rounded-lg transition"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                      <button
                        onClick={() => onEditApp(app)}
                        title="Edit Application"
                        className="p-1.5 text-stone-400 hover:text-[#9D3C5E] hover:bg-white rounded-lg transition"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={async () => {
                          if (confirm(`Delete application for ${app.role_title}?`)) {
                            await onDeleteApp(app.id);
                          }
                        }}
                        title="Delete"
                        className="p-1.5 text-stone-400 hover:text-rose-500 hover:bg-white rounded-lg transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

