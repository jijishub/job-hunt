'use client';

import RoleFitBadge from './RoleFitBadge';

import React from 'react';
import { JobApplication } from '@/types/job';
import StatusBadge from './StatusBadge';
import PriorityBadge from './PriorityBadge';
import {
  X,
  ExternalLink,
  Calendar,
  DollarSign,
  MapPin,
  Building2,
  Edit3,
  Trash2,
  Clock,
  Sparkles,
  CheckCircle2,
  Tag,
} from 'lucide-react';

interface ApplicationDetailModalProps {
  app: JobApplication | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (app: JobApplication) => void;
  onDelete: (id: string) => Promise<void>;
  onAnalyzeResume?: (appId: string) => void;
}

export default function ApplicationDetailModal({
  app,
  isOpen,
  onClose,
  onEdit,
  onDelete,
  onAnalyzeResume,
}: ApplicationDetailModalProps) {
  if (!isOpen || !app) return null;

  const formattedDate = app.date_applied
    ? new Date(app.date_applied).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : 'Not specified';

  const notionUrl = app.notion_page_id
    ? `https://notion.so/${app.notion_page_id.replace(/-/g, '')}`
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/35 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-[#F1DDE9] max-h-[90vh] flex flex-col overflow-hidden">
        <div className="h-28 bg-gradient-to-r from-[#FFB8CA] via-[#FCE7F3] to-[#FFF0F6] relative">
          <button
            onClick={onClose}
            className="absolute top-3 right-3 p-1.5 rounded-full bg-white/80 hover:bg-white text-stone-500 hover:text-stone-800 shadow-xs transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-7 pt-0 pb-4 relative flex items-end justify-between border-b border-[#F1DDE9]">
          <div className="-mt-9 flex items-end gap-3.5">
            <div className="w-16 h-16 rounded-2xl bg-white border-2 border-[#F1DDE9] shadow-md flex items-center justify-center overflow-hidden shrink-0">
              {app.company_logo?.startsWith('emoji:') ? (
                <span className="text-3xl">{app.company_logo.replace('emoji:', '')}</span>
              ) : app.company_logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={app.company_logo}
                  alt={app.company_name}
                  className="w-10 h-10 object-contain"
                />
              ) : (
                <Building2 className="w-8 h-8 text-stone-300" />
              )}
            </div>
            <div>
              <h1 className="text-xl font-bold text-[#4A3E44] tracking-tight">
                {app.role_title}
              </h1>
              <p className="text-sm font-medium text-[#9D3C5E] flex items-center gap-1.5">
                <span>{app.company_name}</span>
                {app.job_url && (
                  <a
                    href={app.job_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-stone-400 hover:text-[#FF7AB3] transition inline-flex items-center"
                    title="Open Job Posting"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 pb-1">
            {onAnalyzeResume && (
              <button
                type="button"
                onClick={() => onAnalyzeResume(app.id)}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-gradient-to-r from-[#FF7AB3] to-[#9D3C5E] hover:from-[#ff6aa8] hover:to-[#8c3553] shadow-xs rounded-xl transition cursor-pointer"
                title="Evaluate your resume against this job using Gemini"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>AI Match</span>
              </button>
            )}
            <button
              onClick={() => onEdit(app)}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-[#736A6D] hover:text-[#9D3C5E] bg-[#FAF7F9] hover:bg-[#FCE7F3] border border-[#F1DDE9] rounded-xl transition"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Edit</span>
            </button>
            <button
              onClick={async () => {
                if (confirm(`Are you sure you want to delete ${app.role_title} at ${app.company_name}?`)) {
                  await onDelete(app.id);
                  onClose();
                }
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-rose-500 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="p-7 overflow-y-auto space-y-6 text-sm">
          {notionUrl ? (
            <div className="p-3 rounded-xl bg-purple-50/60 border border-purple-200/80 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-purple-900">
                <CheckCircle2 className="w-4 h-4 text-purple-600" />
                <span>Connected & Live Synced with Notion page</span>
              </div>
              <a
                href={notionUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-medium text-purple-700 hover:underline"
              >
                <span>Open in Notion</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          ) : null}

          <div className="bg-[#FAF7F9] border border-[#F1DDE9] rounded-2xl p-4.5 space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-[11px] font-semibold text-[#736A6D] uppercase tracking-wider block mb-1">
                  Status & Stage
                </span>
                <div className="flex items-center gap-2 flex-wrap">
                  <StatusBadge status={app.notion_status || app.status} />
                  <RoleFitBadge app={app} />
                </div>
              </div>
              <div>
                <span className="text-[11px] font-semibold text-[#736A6D] uppercase tracking-wider block mb-1">
                  Priority
                </span>
                <PriorityBadge priority={app.priority} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-2 border-t border-[#F1DDE9]/60">
              <div>
                <span className="text-[11px] font-semibold text-[#736A6D] uppercase tracking-wider block mb-1">
                  Service / Category
                </span>
                <span className="text-xs text-[#9D3C5E] font-semibold">
                  {app.service ? `🏷️ ${app.service}` : 'General'}
                </span>
              </div>
              <div>
                <span className="text-[11px] font-semibold text-[#736A6D] uppercase tracking-wider block mb-1">
                  Work Model & Type
                </span>
                <span className="text-xs text-[#4A3E44] capitalize font-medium">
                  {app.work_model.toLowerCase().replace('_', ' ')} • {app.job_type.toLowerCase().replace('_', ' ')}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-2 border-t border-[#F1DDE9]/60">
              <div>
                <span className="text-[11px] font-semibold text-[#736A6D] uppercase tracking-wider block mb-1">
                  Location
                </span>
                <span className="text-xs text-[#4A3E44] flex items-center gap-1 font-medium">
                  <MapPin className="w-3.5 h-3.5 text-stone-400" />
                  {app.location || 'Not specified'}
                </span>
              </div>
              <div>
                <span className="text-[11px] font-semibold text-[#736A6D] uppercase tracking-wider block mb-1">
                  Compensation
                </span>
                <span className="text-xs text-[#4A3E44] flex items-center gap-1 font-medium">
                  <DollarSign className="w-3.5 h-3.5 text-stone-400" />
                  {app.salary_min || app.salary_max
                    ? `${app.salary_currency} ${[
                        app.salary_min ? app.salary_min.toLocaleString() : '',
                        app.salary_max ? `- ${app.salary_max.toLocaleString()}` : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}`
                    : 'Not disclosed'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-2 border-t border-[#F1DDE9]/60">
              <div>
                <span className="text-[11px] font-semibold text-[#736A6D] uppercase tracking-wider block mb-1">
                  Date Applied
                </span>
                <span className="text-xs text-[#4A3E44] flex items-center gap-1 font-medium">
                  <Calendar className="w-3.5 h-3.5 text-stone-400" />
                  {formattedDate}
                </span>
              </div>
            </div>

            {(app.contact_name || app.contact_email) && (
              <div className="pt-2 border-t border-[#F1DDE9]/60">
                <span className="text-[11px] font-semibold text-[#736A6D] uppercase tracking-wider block mb-1">
                  Contact / Recruiter
                </span>
                <p className="text-xs text-[#4A3E44]">
                  {app.contact_name} {app.contact_email && `(${app.contact_email})`}
                </p>
              </div>
            )}
          </div>

          {app.role_fit_analysis && <section className="rounded-xl border border-[#F1DDE9] bg-[#FFF5F8] p-4 text-xs space-y-2">
            <h3 className="font-semibold text-[#9D3C5E]">Role fit assessment</h3>
            <p>{app.role_fit_analysis.explanation}</p>
            {app.role_fit_analysis.strengths.length > 0 && <p><strong>Experience evidence:</strong> {app.role_fit_analysis.strengths.join('; ')}</p>}
            {app.role_fit_analysis.gaps.length > 0 && <p><strong>Requirements to address:</strong> {app.role_fit_analysis.gaps.join('; ')}</p>}
            {app.role_fit_analysis.preference_notes && <p><strong>Preference alignment:</strong> {app.role_fit_analysis.preference_alignment?.toLowerCase()} ? {app.role_fit_analysis.preference_notes}</p>}
          </section>}

          {app.information && (
            <div>
              <h3 className="text-xs font-semibold text-[#736A6D] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-[#FF7AB3]" />
                <span>Information & Source Details</span>
              </h3>
              <div className="p-4 rounded-xl border border-[#F1DDE9] bg-white text-xs text-[#4A3E44] whitespace-pre-wrap leading-relaxed">
                {app.information}
              </div>
            </div>
          )}

          <div>
            <h3 className="text-xs font-semibold text-[#736A6D] uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#FF7AB3]" />
              <span>Notes & Interview Preparation</span>
            </h3>
            <div className="p-4 rounded-xl border border-[#F1DDE9] bg-white min-h-[100px] text-xs text-[#4A3E44] whitespace-pre-wrap leading-relaxed">
              {app.notes || 'No notes added yet. Click "Edit" to add interview notes, salary negotiation targets, or research.'}
            </div>
          </div>
        </div>

        <div className="px-7 py-3 border-t border-[#F1DDE9] bg-[#FAF7F9] flex items-center justify-between text-xs text-[#736A6D]">
          <span className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            Last updated {new Date(app.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 font-medium text-stone-700 bg-white border border-[#F1DDE9] hover:bg-stone-50 rounded-xl transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

