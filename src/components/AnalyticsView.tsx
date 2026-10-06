'use client';

import React from 'react';
import { JobApplication, Company } from '@/types/job';
import {
  Sparkles,
  Trophy,
  Briefcase,
  TrendingUp,
  Building2,
  PieChart,
  CheckCircle2,
  Clock,
  Send,
  UserCheck,
} from 'lucide-react';

interface AnalyticsViewProps {
  applications: JobApplication[];
  companies: Company[];
}

export default function AnalyticsView({ applications, companies }: AnalyticsViewProps) {
  const total = applications.length;

  const leads = applications.filter((a) => a.status === 'LEAD').length;
  const applied = applications.filter((a) => a.status === 'APPLIED').length;
  const screening = applications.filter((a) => a.status === 'SCREENING').length;
  const interviewing = applications.filter((a) => a.status === 'INTERVIEWING').length;
  const inPipeline = screening + interviewing;
  const offers = applications.filter((a) => a.status === 'OFFER' || a.status === 'ACCEPTED').length;
  const rejected = applications.filter((a) => a.status === 'REJECTED' || a.status === 'WITHDRAWN').length;

  const submittedTotal = total - leads;
  const interviewRate = submittedTotal > 0 ? Math.round(((inPipeline + offers) / submittedTotal) * 100) : 0;
  const offerRate = submittedTotal > 0 ? Math.round((offers / submittedTotal) * 100) : 0;

  // Work model counts
  const remoteCount = applications.filter((a) => a.work_model === 'REMOTE').length;
  const hybridCount = applications.filter((a) => a.work_model === 'HYBRID').length;
  const onSiteCount = applications.filter((a) => a.work_model === 'ON_SITE').length;

  // Priority counts
  const dreamCount = applications.filter((a) => a.priority === 'DREAM').length;
  const highCount = applications.filter((a) => a.priority === 'HIGH').length;
  const mediumCount = applications.filter((a) => a.priority === 'MEDIUM').length;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div>
        <h2 className="text-base font-bold text-[#4A3E44] flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#FF7AB3]" />
          <span>Job Hunt Pipeline Analytics</span>
        </h2>
        <p className="text-xs text-[#736A6D]">
          Track your conversion funnel, application velocity, and pipeline health
        </p>
      </div>

      {/* Top Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="bg-white p-4.5 rounded-2xl border border-[#F1DDE9] shadow-2xs">
          <div className="flex items-center justify-between text-stone-400 mb-2">
            <span className="text-xs font-semibold text-[#736A6D] uppercase tracking-wider">
              Total Tracked
            </span>
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <Briefcase className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-[#4A3E44]">{total}</div>
          <span className="text-[11px] text-[#736A6D] mt-0.5 block">
            {leads} wishlisted leads
          </span>
        </div>

        <div className="bg-white p-4.5 rounded-2xl border border-[#F1DDE9] shadow-2xs">
          <div className="flex items-center justify-between text-stone-400 mb-2">
            <span className="text-xs font-semibold text-[#736A6D] uppercase tracking-wider">
              Submitted
            </span>
            <div className="w-8 h-8 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
              <Send className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-[#4A3E44]">{submittedTotal}</div>
          <span className="text-[11px] text-[#736A6D] mt-0.5 block">
            Applications sent
          </span>
        </div>

        <div className="bg-white p-4.5 rounded-2xl border border-[#F1DDE9] shadow-2xs">
          <div className="flex items-center justify-between text-stone-400 mb-2">
            <span className="text-xs font-semibold text-[#736A6D] uppercase tracking-wider">
              In Interviews
            </span>
            <div className="w-8 h-8 rounded-xl bg-[#FCE7F3] text-[#9D3C5E] flex items-center justify-center">
              <UserCheck className="w-4 h-4 text-[#FF7AB3]" />
            </div>
          </div>
          <div className="text-2xl font-bold text-[#9D3C5E]">{inPipeline}</div>
          <span className="text-[11px] text-[#736A6D] mt-0.5 block">
            Screening & technical rounds
          </span>
        </div>

        <div className="bg-white p-4.5 rounded-2xl border border-emerald-200 shadow-2xs bg-gradient-to-br from-white to-emerald-50/40">
          <div className="flex items-center justify-between text-stone-400 mb-2">
            <span className="text-xs font-semibold text-emerald-800 uppercase tracking-wider">
              Offers 🎉
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <Trophy className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-emerald-900">{offers}</div>
          <span className="text-[11px] text-emerald-700 mt-0.5 block">
            {offerRate}% offer conversion
          </span>
        </div>
      </div>

      {/* Funnel Progress Section */}
      <div className="bg-white p-6 rounded-2xl border border-[#F1DDE9] shadow-2xs space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-[#4A3E44] uppercase tracking-wider flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-[#FF7AB3]" />
            <span>Conversion Funnel</span>
          </h3>
          <span className="text-xs font-semibold text-[#9D3C5E] bg-[#FFF0F6] px-2.5 py-1 rounded-full border border-[#F1DDE9]">
            {interviewRate}% Interview Rate
          </span>
        </div>

        <div className="space-y-3 pt-1">
          {/* Funnel bars */}
          <div>
            <div className="flex justify-between text-xs font-medium text-[#736A6D] mb-1">
              <span>Applications Sent</span>
              <span className="text-[#4A3E44] font-semibold">{submittedTotal}</span>
            </div>
            <div className="w-full h-2.5 rounded-full bg-stone-100 overflow-hidden">
              <div
                className="h-full bg-sky-400 rounded-full transition-all duration-500"
                style={{ width: `${total > 0 ? (submittedTotal / total) * 100 : 0}%` }}
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between text-xs font-medium text-[#736A6D] mb-1">
              <span>Recruiter Screening</span>
              <span className="text-[#4A3E44] font-semibold">{screening}</span>
            </div>
            <div className="w-full h-2.5 rounded-full bg-stone-100 overflow-hidden">
              <div
                className="h-full bg-amber-400 rounded-full transition-all duration-500"
                style={{ width: `${submittedTotal > 0 ? (screening / submittedTotal) * 100 : 0}%` }}
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between text-xs font-medium text-[#736A6D] mb-1">
              <span>Team & Technical Interviews</span>
              <span className="text-[#4A3E44] font-semibold">{interviewing}</span>
            </div>
            <div className="w-full h-2.5 rounded-full bg-stone-100 overflow-hidden">
              <div
                className="h-full bg-[#FF7AB3] rounded-full transition-all duration-500"
                style={{ width: `${submittedTotal > 0 ? (interviewing / submittedTotal) * 100 : 0}%` }}
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between text-xs font-medium text-[#736A6D] mb-1">
              <span>Offers Received</span>
              <span className="text-emerald-700 font-semibold">{offers}</span>
            </div>
            <div className="w-full h-2.5 rounded-full bg-stone-100 overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                style={{ width: `${submittedTotal > 0 ? (offers / submittedTotal) * 100 : 0}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Two Column Grid: Work Model & Priority */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Work Model Breakdown */}
        <div className="bg-white p-5 rounded-2xl border border-[#F1DDE9] shadow-2xs space-y-3">
          <h3 className="text-xs font-bold text-[#4A3E44] uppercase tracking-wider flex items-center gap-1.5">
            <PieChart className="w-3.5 h-3.5 text-[#FF7AB3]" />
            <span>Workplace Preferences</span>
          </h3>
          <div className="space-y-2.5 pt-1 text-xs text-[#736A6D]">
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#FAF7F9]">
              <span className="font-medium text-[#4A3E44]">🏡 Remote (Worldwide / Local)</span>
              <span className="font-bold text-[#9D3C5E]">{remoteCount}</span>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#FAF7F9]">
              <span className="font-medium text-[#4A3E44]">🏢 Hybrid Office</span>
              <span className="font-bold text-[#4A3E44]">{hybridCount}</span>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#FAF7F9]">
              <span className="font-medium text-[#4A3E44]">📍 On-site</span>
              <span className="font-bold text-[#4A3E44]">{onSiteCount}</span>
            </div>
          </div>
        </div>

        {/* Priority Breakdown */}
        <div className="bg-white p-5 rounded-2xl border border-[#F1DDE9] shadow-2xs space-y-3">
          <h3 className="text-xs font-bold text-[#4A3E44] uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Target Opportunities</span>
          </h3>
          <div className="space-y-2.5 pt-1 text-xs text-[#736A6D]">
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-pink-50/60 border border-[#F1DDE9]">
              <span className="font-medium text-[#9D3C5E]">⭐ Dream Jobs</span>
              <span className="font-bold text-[#9D3C5E]">{dreamCount}</span>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-amber-50/60 border border-amber-200">
              <span className="font-medium text-amber-900">🌟 High Priority</span>
              <span className="font-bold text-amber-900">{highCount}</span>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-stone-50 border border-stone-200">
              <span className="font-medium text-stone-700">💼 Standard Opportunities</span>
              <span className="font-bold text-stone-700">{mediumCount}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

