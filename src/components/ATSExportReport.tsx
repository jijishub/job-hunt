'use client';

import React from 'react';
import Image from 'next/image';
import { ResumeAnalysisResult } from '@/lib/ai';
import {
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Tag,
  FileText,
  MessageSquare,
  TrendingUp,
  Briefcase,
  Layers,
} from 'lucide-react';

interface ATSExportReportProps {
  result: ResumeAnalysisResult;
  jobTitle: string;
  companyName: string;
  candidateName?: string;
  reportRef: React.RefObject<HTMLDivElement | null>;
}

export default function ATSExportReport({
  result,
  jobTitle,
  companyName,
  candidateName = 'Candidate Profile',
  reportRef,
}: ATSExportReportProps) {
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-700 bg-emerald-50 border-emerald-300';
    if (score >= 65) return 'text-[#9D3C5E] bg-[#FFF0F6] border-[#F1DDE9]';
    return 'text-amber-700 bg-amber-50 border-amber-300';
  };

  const formattedDate = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div
      style={{
        position: 'fixed',
        left: '-9999px',
        top: '-9999px',
        zIndex: -100,
        opacity: 1,
        pointerEvents: 'none',
      }}
    >
      <div
        ref={reportRef}
        className="w-[840px] bg-[#FAF7F9] p-8 text-[#4A3E44] font-sans space-y-6"
        style={{
          boxSizing: 'border-box',
          backgroundColor: '#FAF7F9',
        }}
      >
        {/* Document Header */}
        <div className="bg-white rounded-2xl p-6 border border-[#F1DDE9] shadow-xs flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-white border border-[#F1DDE9] p-1 shadow-2xs flex items-center justify-center">
              <Image
                src="/job-hunt-facvicon.png"
                alt="Job Hunt"
                width={40}
                height={40}
                className="rounded-xl object-contain"
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-extrabold text-[#4A3E44] tracking-tight">
                  Job Hunt & Leads
                </h1>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#FFF0F6] text-[#9D3C5E] border border-[#F1DDE9]">
                  AI ATS Intelligence Report
                </span>
              </div>
              <p className="text-xs text-[#736A6D] mt-0.5 font-medium">
                Target Opportunity: <strong className="text-[#4A3E44]">{jobTitle || 'Target Role'}</strong> @ <strong className="text-[#9D3C5E]">{companyName || 'Target Company'}</strong>
              </p>
            </div>
          </div>

          <div className="text-right text-[11px] text-[#736A6D] space-y-0.5">
            <div>Candidate: <strong className="text-[#4A3E44]">{candidateName}</strong></div>
            <div>Analyzed: <strong className="text-[#4A3E44]">{formattedDate}</strong></div>
            <div>Model: <span className="font-semibold text-[#9D3C5E]">{result.modelUsed}</span></div>
          </div>
        </div>

        {/* ATS Scorecard & Executive Summary */}
        <div className="bg-white rounded-2xl p-6 border border-[#F1DDE9] shadow-xs">
          <div className="flex items-start gap-5">
            <div
              className={`w-24 h-24 rounded-2xl border-2 flex flex-col items-center justify-center shrink-0 shadow-xs ${getScoreColor(
                result.matchScore
              )}`}
            >
              <span className="text-3xl font-black">{result.matchScore}%</span>
              <span className="text-[10px] font-bold uppercase tracking-wider">ATS Score</span>
            </div>
            <div className="flex-1 space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-[#4A3E44]">{result.matchTier}</span>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Ready for Submission
                </span>
              </div>
              <p className="text-xs text-[#736A6D] leading-relaxed">
                {result.summary}
              </p>
            </div>
          </div>
        </div>

        {/* Strengths & Qualification Gaps Matrix */}
        <div className="grid grid-cols-2 gap-4">
          {/* Key Strengths */}
          <div className="bg-white rounded-2xl p-5 border border-[#F1DDE9] shadow-xs space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-700">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>KEY COMPETITIVE STRENGTHS</span>
            </div>
            <ul className="space-y-2 text-xs text-[#736A6D]">
              {result.strengths?.length > 0 ? (
                result.strengths.map((str, i) => (
                  <li key={i} className="flex items-start gap-2 bg-emerald-50/50 p-2.5 rounded-xl border border-emerald-100">
                    <span className="text-emerald-500 font-bold">•</span>
                    <span className="leading-relaxed">{str}</span>
                  </li>
                ))
              ) : (
                <li className="text-[11px] text-stone-400">No specific strengths flagged.</li>
              )}
            </ul>
          </div>

          {/* Qualification Gaps */}
          <div className="bg-white rounded-2xl p-5 border border-[#F1DDE9] shadow-xs space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-700">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>QUALIFICATION GAPS TO ADDRESS</span>
            </div>
            <ul className="space-y-2 text-xs text-[#736A6D]">
              {result.gaps?.length > 0 ? (
                result.gaps.map((gap, i) => (
                  <li key={i} className="flex items-start gap-2 bg-amber-50/50 p-2.5 rounded-xl border border-amber-100">
                    <span className="text-amber-500 font-bold">•</span>
                    <span className="leading-relaxed">{gap}</span>
                  </li>
                ))
              ) : (
                <li className="text-[11px] text-stone-400">No major gaps identified.</li>
              )}
            </ul>
          </div>
        </div>

        {/* ATS Keywords Breakdown */}
        <div className="bg-white rounded-2xl p-5 border border-[#F1DDE9] shadow-xs space-y-4">
          <div className="flex items-center gap-2 text-xs font-bold text-[#4A3E44]">
            <Tag className="w-4 h-4 text-[#FF7AB3]" />
            <span>ATS KEYWORDS & SKILLS MATCH MATRIX</span>
          </div>

          <div className="space-y-3">
            {/* Matched Keywords */}
            <div>
              <p className="text-[11px] font-bold text-emerald-700 mb-1.5 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Found in Resume ({result.matchingSkills?.length || 0}):</span>
              </p>
              <div className="flex flex-wrap gap-1.5">
                {result.matchingSkills?.map((skill, i) => (
                  <span
                    key={i}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200"
                  >
                    ✓ {skill}
                  </span>
                ))}
              </div>
            </div>

            {/* Missing Keywords */}
            <div>
              <p className="text-[11px] font-bold text-rose-700 mb-1.5 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                <span>Missing ATS Keywords & Gaps ({result.missingKeywords?.length || 0}):</span>
              </p>
              <div className="flex flex-wrap gap-1.5">
                {result.missingKeywords?.map((keyword, i) => (
                  <span
                    key={i}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200"
                  >
                    + {keyword}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Bullet Rewrites (Google XYZ Formula) */}
        {result.bulletRewrites?.length > 0 && (
          <div className="bg-white rounded-2xl p-5 border border-[#F1DDE9] shadow-xs space-y-3.5">
            <div className="flex items-center gap-2 text-xs font-bold text-[#4A3E44]">
              <FileText className="w-4 h-4 text-[#FF7AB3]" />
              <span>OPTIMIZED RESUME BULLETS (GOOGLE XYZ FORMULA)</span>
            </div>

            <div className="space-y-3">
              {result.bulletRewrites.map((bullet, i) => (
                <div key={i} className="p-3.5 rounded-xl border border-[#F1DDE9] bg-[#FAF7F9]/50 space-y-2">
                  <div className="text-[11px] text-stone-500">
                    <span className="font-bold text-stone-600">Original:</span> {bullet.original}
                  </div>
                  <div className="text-xs font-semibold text-[#4A3E44] bg-white p-2.5 rounded-lg border border-[#F1DDE9]">
                    <span className="text-[#9D3C5E] font-bold">✨ Optimized:</span> {bullet.improved}
                  </div>
                  {bullet.reason && (
                    <div className="text-[11px] text-[#736A6D] italic">
                      <strong className="text-[#9D3C5E] not-italic">Rationale:</strong> {bullet.reason}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tailored Cover Pitch */}
        {result.tailoredPitch && (
          <div className="bg-white rounded-2xl p-5 border border-[#F1DDE9] shadow-xs space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-bold text-[#4A3E44]">
              <MessageSquare className="w-4 h-4 text-[#FF7AB3]" />
              <span>TAILORED APPLICATION PITCH & COVER NOTE</span>
            </div>
            <div className="bg-[#FAF7F9] p-4 rounded-xl border border-[#F1DDE9] text-xs text-[#4A3E44] leading-relaxed whitespace-pre-wrap font-sans">
              {result.tailoredPitch}
            </div>
          </div>
        )}

        {/* Report Footer */}
        <div className="pt-2 border-t border-[#F1DDE9] flex items-center justify-between text-[10px] text-[#736A6D]">
          <span>Job Hunt & Leads • High-Precision Career Command Center</span>
          <span>Live at https://jobhunt.jizellecasia.site • Private & Confidential</span>
        </div>
      </div>
    </div>
  );
}
