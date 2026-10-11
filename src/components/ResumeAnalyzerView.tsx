'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import jsPDF from 'jspdf';
import ATSExportReport from './ATSExportReport';
import { getReportPageCuts } from '@/lib/report-pagination';
import { captureReport } from '@/lib/report-capture';
import { JobApplication } from '@/types/job';
import { AIModelId, AVAILABLE_AI_MODELS, ResumeAnalysisResult } from '@/lib/ai-types';
import {
  Sparkles,
  FileText,
  RefreshCw,
  Briefcase,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Zap,
  Brain,
  Crown,
  TrendingUp,
  Tag,
  MessageSquare,
  HelpCircle,
  Download,
} from 'lucide-react';

interface ResumeAnalyzerViewProps {
  applications: JobApplication[];
  initialSelectedAppId?: string | null;
  preferenceVersion?: number;
  onOpenPreferences: () => void;
}

export default function ResumeAnalyzerView({
  applications,
  initialSelectedAppId,
  preferenceVersion = 0,
  onOpenPreferences,
}: ResumeAnalyzerViewProps) {
  const { data: session } = useSession();
  const isAdmin = (session?.user as any)?.role === 'admin';

  // Model selection
  const [selectedModel, setSelectedModel] = useState<AIModelId>('luna');

  // Input states
  const [resumeText, setResumeText] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [selectedAppId, setSelectedAppId] = useState<string>(initialSelectedAppId || '');

  // Loading & Result states
  const [isLoading, setIsLoading] = useState(false);
  const [isPortfolioImporting, setIsPortfolioImporting] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);
  const [result, setResult] = useState<ResumeAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Client-side export states (Zero DB writes!)
  const reportRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccessMsg, setExportSuccessMsg] = useState<string | null>(null);

  // Copy feedback states
  const [copiedPitch, setCopiedPitch] = useState(false);
  const [copiedBulletIdx, setCopiedBulletIdx] = useState<number | null>(null);

  // Active sub-tab in results
  const [activeResultTab, setActiveResultTab] = useState<'overview' | 'keywords' | 'bullets' | 'pitch'>('overview');

  useEffect(() => {
    const controller = new AbortController();
    setProfileLoading(true); setResult(null);
    fetch('/api/profile', { signal: controller.signal }).then(r => r.json()).then(data => {
      if (!data.success) throw new Error(data.error);
      setResumeText(data.resumeText || '');
    }).catch(err => { if (err.name !== 'AbortError') setError(err.message); })
      .finally(() => { if (!controller.signal.aborted) setProfileLoading(false); });
    return () => controller.abort();
  }, [preferenceVersion]);

  const analysisVersion = useRef(0);
  useEffect(() => { analysisVersion.current++; setResult(null); }, [resumeText, jobTitle, companyName, jobDescription, selectedModel, preferenceVersion]);

  // Pre-load from selected app if provided
  useEffect(() => {
    if (selectedAppId) {
      const app = applications.find((a) => a.id === selectedAppId);
      if (app) {
        setJobTitle(app.role_title || '');
        setCompanyName(app.company_name || '');
        setJobDescription(app.information || app.job_description || '');
        setResult(null);
      }
    }
  }, [selectedAppId, applications]);

  // Auto-import candidate portfolio/bio from jizellecasia.vercel.app
  const handleAutoImportPortfolio = async () => {
    setIsPortfolioImporting(true);
    setError(null);
    try {
      const res = await fetch('/api/portfolio');
      const data = await res.json();
      const p = data.profile || data.data;

      if (data.success && p) {
        setResumeText(JSON.stringify(p, null, 2));
        setResult(null);
      } else {
        throw new Error('Failed to retrieve portfolio profile data');
      }
    } catch (err: any) {
      setError(`Could not auto-import portfolio: ${err.message}. You can manually paste your resume text or import a PDF.`);
    } finally {
      setIsPortfolioImporting(false);
    }
  };

  const handleAnalyze = async () => {
    if (!resumeText.trim()) {
      setError('Save your master resume in My preferences before analyzing.');
      return;
    }
    if (jobDescription.trim().length < 30) {
      setError('Add the actual job requirements (at least 30 characters).');
      return;
    }

    const version = analysisVersion.current;
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resumeText: isAdmin ? resumeText : undefined,
          applicationId: selectedAppId || undefined,
          jobTitle,
          companyName,
          jobDescription,
          model: selectedModel,
        }),
      });

      const json = await res.json();
      if (version !== analysisVersion.current) return;
      if (json.success && json.data) {
        setResult(json.data);
        setActiveResultTab('overview');
      } else {
        throw new Error(json.error || 'Analysis failed. Please check the AI engine.');
      }
    } catch (err: any) {
      console.error(err);
      if (version === analysisVersion.current) setError(err.message || 'An unexpected error occurred during AI resume analysis.');
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (text: string, isPitch: boolean, bulletIdx?: number) => {
    navigator.clipboard.writeText(text);
    if (isPitch) {
      setCopiedPitch(true);
      setTimeout(() => setCopiedPitch(false), 2000);
    }
    if (bulletIdx !== undefined) {
      setCopiedBulletIdx(bulletIdx);
      setTimeout(() => setCopiedBulletIdx(null), 2000);
    }
  };

  // Client-Side 1-Click Export (Zero DB writes to prevent DB population)
  const handleExport = async () => {
    if (!reportRef.current || !result) return;
    setIsExporting(true);
    setError(null);
    setExportSuccessMsg(null);

    try {
      const report = reportRef.current;
      if (!report) throw new Error('Report is unavailable');
      const canvas = await captureReport(report);

      const width = canvas.width;

      const cleanCompany = (companyName || 'Job').replace(/[^a-zA-Z0-9_-]/g, '_');
      const cleanRole = (jobTitle || 'Role').replace(/[^a-zA-Z0-9_-]/g, '_');
      const baseFilename = `ATS_Report_${cleanCompany}_${cleanRole}_${result.matchScore}pct`;

      const cuts = getReportPageCuts(report, report.offsetWidth * (273 / 190));
      const pdf = new jsPDF({
        orientation: 'portrait', unit: 'mm', format: 'a4',
      });
      const ratio = canvas.height / report.scrollHeight;
      for (let index = 0; index < cuts.length - 1; index++) {
        if (index > 0) pdf.addPage();
        const top = Math.round(cuts[index] * ratio);
        const bottom = Math.round(cuts[index + 1] * ratio);
        const pageCanvas = document.createElement('canvas');
        pageCanvas.width = width;
        pageCanvas.height = bottom - top;
        const context = pageCanvas.getContext('2d');
        if (!context) throw new Error('Could not create PDF page');
        context.drawImage(canvas, 0, top, width, bottom - top, 0, 0, width, bottom - top);
        pdf.addImage(pageCanvas.toDataURL('image/png'), 'PNG', 10, 10, 190,
          pageCanvas.height * 190 / width);
        pdf.setFontSize(8);
        pdf.setTextColor(115, 106, 109);
        pdf.text(`Page ${index + 1} of ${cuts.length - 1}`, 200, 290, { align: 'right' });
      }
      pdf.save(`${baseFilename}.pdf`);
      setExportSuccessMsg('PDF report downloaded successfully!');
      setTimeout(() => setExportSuccessMsg(null), 3000);
    } catch (err: any) {
      console.error('Export failed:', err);
      setError(`Export failed: ${err.message || 'Please try again'}`);
    } finally {
      setIsExporting(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-600 bg-emerald-50 border-emerald-200';
    if (score >= 65) return 'text-[#9D3C5E] bg-[#FFF0F6] border-[#F1DDE9]';
    return 'text-amber-600 bg-amber-50 border-amber-200';
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Banner */}
      <div className="bg-white rounded-2xl p-6 border border-[#F1DDE9] shadow-xs relative overflow-hidden">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-gradient-to-br from-[#FFF0F6] via-[#FCE7F3] to-transparent rounded-full opacity-60 pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-[#4A3E44]">AI Resume & ATS Matcher</h1>
              <p className="text-[11px] text-[#736A6D]">Scores are AI estimates, separate from employer ATS results and application outcomes.</p>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#FFF0F6] text-[#9D3C5E] border border-[#F1DDE9]">
                  AI Powered
                </span>
              </div>
              <p className="text-xs text-[#736A6D] mt-1 max-w-2xl">
                Scan your candidate credentials against job requirements. Discover missing ATS keywords, optimize bullet points with high-impact metrics, and generate tailored application pitches in seconds.
              </p>
            </div>

            {/* Model Selector Pill */}
          <div className="flex items-center gap-2 bg-[#FAF7F9] p-1.5 rounded-xl border border-[#F1DDE9]">
            <span className="text-[11px] font-semibold text-[#736A6D] pl-2 flex items-center gap-1">
              Model:
            </span>
            <div className="flex items-center gap-1">
              {AVAILABLE_AI_MODELS.map((m) => {
                const isSelected = selectedModel === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setSelectedModel(m.id)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1 ${
                      isSelected
                        ? 'bg-[#FF7AB3] text-white shadow-2xs'
                        : 'text-[#4A3E44] hover:bg-white'
                    }`}
                    title={m.description}
                  >
                    {m.id === 'gemini-web-flash' && <Zap className="w-3 h-3" />}
                    {m.id === 'gemini-web-thinking' && <Brain className="w-3 h-3" />}
                    {m.id === 'gemini-web-pro' && <Crown className="w-3 h-3" />}
                    <span>{m.name.replace('Gemini ', '')}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => setError(null)}
            className="text-xs font-bold text-rose-600 hover:text-rose-800"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Grid: Inputs vs Results */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Form Inputs (5 cols) */}
        <div className="lg:col-span-5 space-y-5">
          <div className="bg-white rounded-2xl p-5 border border-[#F1DDE9] space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-bold text-[#4A3E44]">Master resume</h2>
              <button type="button" onClick={onOpenPreferences} className="rounded-xl px-3 py-2 text-xs font-semibold bg-[#FFF0F6] text-[#9D3C5E]">My preferences</button>
            </div>
            <p className="text-xs text-[#736A6D]">{profileLoading ? 'Loading your saved resume?' : resumeText ? 'Uses the resume saved in My preferences.' : 'Save your resume in My preferences to begin.'}</p>
            <textarea aria-label="ATS resume" rows={8} value={resumeText} readOnly={!isAdmin} onChange={e => { setResumeText(e.target.value); setResult(null); }} className="w-full p-3 rounded-xl border border-[#F1DDE9] text-xs text-[#4A3E44]" />
            {isAdmin && <button type="button" disabled={isPortfolioImporting} onClick={handleAutoImportPortfolio} className="rounded-xl px-3 py-2 text-xs font-semibold border border-[#F1DDE9] text-[#9D3C5E]">{isPortfolioImporting ? 'Loading portfolio?' : 'Use live portfolio for this match'}</button>}
          </div>

          {/* Target Job Card */}
          <div className="bg-white rounded-2xl p-5 border border-[#F1DDE9] shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-[#4A3E44] uppercase tracking-wider flex items-center gap-1.5">
                <Briefcase className="w-4 h-4 text-[#FF7AB3]" />
                <span>Target Job Opportunity *</span>
              </label>
            </div>

            {/* Quick Picker from Applications */}
            {applications.length > 0 && (
              <div>
                <label className="block text-[11px] font-semibold text-[#736A6D] mb-1">
                  Select from Tracked Opportunities:
                </label>
                <select
                  aria-label="ATS tracked opportunity"
                  value={selectedAppId}
                  onChange={(e) => setSelectedAppId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#F1DDE9] focus:outline-none focus:border-[#FF7AB3] text-xs font-medium text-[#4A3E44] bg-[#FAF7F9] transition"
                >
                  <option value="">-- Or enter custom job details below --</option>
                  {applications.map((app) => (
                    <option key={app.id} value={app.id}>
                      {app.role_title} @ {app.company_name} ({app.status})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-[#736A6D] mb-1">Role Title</label>
                <input
                  type="text"
                  placeholder="e.g. AI / Frontend Intern"
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#F1DDE9] focus:outline-none focus:border-[#FF7AB3] text-xs text-[#4A3E44]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[#736A6D] mb-1">Company Name</label>
                <input
                  type="text"
                  placeholder="e.g. Canva, Notion, Google"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#F1DDE9] focus:outline-none focus:border-[#FF7AB3] text-xs text-[#4A3E44]"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[#736A6D] mb-1">
                Job Description & Requirements *
              </label>
              <textarea
                aria-label="ATS job requirements"
                rows={6}
                value={jobDescription}
                onChange={(e) => { setJobDescription(e.target.value); setSelectedAppId(''); setResult(null); }}
                placeholder="Paste key responsibilities, required qualifications, and tech stack from the job post..."
                className="w-full p-3 rounded-xl border border-[#F1DDE9] focus:outline-none focus:border-[#FF7AB3] focus:ring-2 focus:ring-[#FF7AB3]/20 text-xs text-[#4A3E44] placeholder-stone-400 resize-y leading-relaxed"
              />
            </div>

            {/* Run Button */}
            <button
              type="button"
              onClick={handleAnalyze}
              disabled={isLoading}
              className="w-full py-3 px-4 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-[#FF7AB3] to-[#9D3C5E] hover:from-[#ff6aa8] hover:to-[#8c3553] shadow-md shadow-[#FF7AB3]/25 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Sparkles className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              <span>
                {isLoading
                  ? `Analyzing with ${selectedModel.replace('gemini-web-', 'Gemini ')}...`
                  : '✨ Run AI ATS Match & Pitch'}
              </span>
            </button>
          </div>
        </div>

        {/* Right Column: AI Analysis Output (7 cols) */}
        <div className="lg:col-span-7">
          {!result && !isLoading && (
            <div className="bg-white rounded-2xl p-10 border border-[#F1DDE9] shadow-xs text-center flex flex-col items-center justify-center min-h-[460px]">
              <div className="w-16 h-16 rounded-2xl bg-[#FFF0F6] flex items-center justify-center text-[#FF7AB3] mb-4">
                <Sparkles className="w-8 h-8" />
              </div>
              <h3 className="text-base font-bold text-[#4A3E44]">Ready for AI Resume Analysis</h3>
              <p className="text-xs text-[#736A6D] max-w-md mt-1.5 leading-relaxed">
                Select a role with actual job requirements, then run a match when you want one. Manage your master resume in My preferences.
              </p>
              <button type="button" onClick={onOpenPreferences} className="mt-5 rounded-xl bg-[#FFF0F6] px-4 py-2 text-xs font-semibold text-[#9D3C5E]">Manage master resume</button>

            </div>
          )}

          {isLoading && (
            <div className="bg-white rounded-2xl p-12 border border-[#F1DDE9] shadow-xs text-center flex flex-col items-center justify-center min-h-[460px] animate-pulse">
              <div className="w-16 h-16 rounded-full bg-[#FFF0F6] border-2 border-[#FF7AB3] flex items-center justify-center text-[#FF7AB3] mb-4 animate-spin">
                <Sparkles className="w-8 h-8" />
              </div>
              <h3 className="text-base font-bold text-[#4A3E44]">
                Evaluating Fit with {selectedModel.replace('gemini-web-', 'Gemini ')}...
              </h3>
              <p className="text-xs text-[#736A6D] max-w-sm mt-1.5">
                Parsing keywords, calculating ATS score, and generating tailored recruiter pitches...
              </p>
            </div>
          )}

          {result && !isLoading && (
            <div className="space-y-4">
              {/* Score Header Card */}
              <div className="bg-white rounded-2xl p-6 border border-[#F1DDE9] shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#F1DDE9]">
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-20 h-20 rounded-2xl border-2 flex flex-col items-center justify-center shrink-0 shadow-xs ${getScoreColor(
                        result.matchScore
                      )}`}
                    >
                      <span className="text-2xl font-black">{result.matchScore}%</span>
                      <span className="text-[10px] font-bold uppercase tracking-wider">ATS Score</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-base font-bold text-[#4A3E44]">{result.matchTier}</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#FAF7F9] text-[#736A6D] border border-[#F1DDE9]">
                          {result.modelUsed}
                        </span>
                      </div>
                      <p className="text-xs text-[#736A6D] mt-1 leading-relaxed">{result.summary}</p>
                    </div>
                  </div>

                  {/* Export Report Action Dropdown (Client-Side, Zero DB writes) */}
                  <div className="shrink-0 self-start sm:self-center">
                    <div className="inline-flex rounded-xl shadow-2xs">
                      <button
                        type="button"
                        onClick={handleExport}
                        disabled={isExporting}
                        className="px-3.5 py-2 rounded-xl text-xs font-bold text-[#4A3E44] bg-[#FFF0F6] hover:bg-[#FCE7F3] border border-[#F1DDE9] transition flex items-center gap-2 cursor-pointer shadow-2xs hover:border-[#FF7AB3]"
                        title="Download the complete analysis as an A4 PDF"
                      >
                        {isExporting ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#FF7AB3]" />
                            <span>Exporting PDF...</span>
                          </>
                        ) : (
                          <>
                            <Download className="w-3.5 h-3.5 text-[#FF7AB3]" />
                            <span>Download PDF</span>
                          </>
                        )}
                      </button>
                    </div>

                  </div>
                </div>

                {exportSuccessMsg && (
                  <div className="mt-3 p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700 font-semibold flex items-center gap-2 animate-in fade-in">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>{exportSuccessMsg}</span>
                  </div>
                )}

                {/* Sub-nav Tabs */}
                <div className="flex items-center gap-1.5 pt-4 overflow-x-auto">
                  <button
                    type="button"
                    onClick={() => setActiveResultTab('overview')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 ${
                      activeResultTab === 'overview'
                        ? 'bg-[#FF7AB3] text-white shadow-2xs'
                        : 'text-[#736A6D] hover:bg-[#FAF7F9]'
                    }`}
                  >
                    <TrendingUp className="w-3.5 h-3.5" />
                    <span>Fit & Gaps</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveResultTab('keywords')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 ${
                      activeResultTab === 'keywords'
                        ? 'bg-[#FF7AB3] text-white shadow-2xs'
                        : 'text-[#736A6D] hover:bg-[#FAF7F9]'
                    }`}
                  >
                    <Tag className="w-3.5 h-3.5" />
                    <span>ATS Keywords ({result.missingKeywords.length} gaps)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveResultTab('bullets')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 ${
                      activeResultTab === 'bullets'
                        ? 'bg-[#FF7AB3] text-white shadow-2xs'
                        : 'text-[#736A6D] hover:bg-[#FAF7F9]'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Bullet Rewrites ({result.bulletRewrites.length})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveResultTab('pitch')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 ${
                      activeResultTab === 'pitch'
                        ? 'bg-[#FF7AB3] text-white shadow-2xs'
                        : 'text-[#736A6D] hover:bg-[#FAF7F9]'
                    }`}
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Tailored Pitch</span>
                  </button>
                </div>
              </div>

              {/* Tab 1: Overview (Strengths vs Gaps & Interview Prep) */}
              {activeResultTab === 'overview' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Strengths */}
                    <div className="bg-white rounded-2xl p-5 border border-[#F1DDE9] shadow-xs space-y-3">
                      <h4 className="text-xs font-bold text-[#4A3E44] uppercase tracking-wider flex items-center gap-1.5 text-emerald-700">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>Key Competitive Strengths</span>
                      </h4>
                      <ul className="space-y-2">
                        {result.strengths.map((s, i) => (
                          <li key={i} className="text-xs text-[#4A3E44] flex items-start gap-2 bg-emerald-50/50 p-2.5 rounded-xl border border-emerald-100">
                            <span className="text-emerald-600 font-bold">✓</span>
                            <span>{s}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Gaps */}
                    <div className="bg-white rounded-2xl p-5 border border-[#F1DDE9] shadow-xs space-y-3">
                      <h4 className="text-xs font-bold text-[#4A3E44] uppercase tracking-wider flex items-center gap-1.5 text-amber-700">
                        <AlertCircle className="w-4 h-4 text-amber-600" />
                        <span>Qualification Gaps to Address</span>
                      </h4>
                      <ul className="space-y-2">
                        {result.gaps.map((g, i) => (
                          <li key={i} className="text-xs text-[#4A3E44] flex items-start gap-2 bg-amber-50/50 p-2.5 rounded-xl border border-amber-100">
                            <span className="text-amber-600 font-bold">•</span>
                            <span>{g}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Interview Preparation Tips */}
                  {result.interviewTips.length > 0 && (
                    <div className="bg-white rounded-2xl p-5 border border-[#F1DDE9] shadow-xs space-y-2.5">
                      <h4 className="text-xs font-bold text-[#4A3E44] uppercase tracking-wider flex items-center gap-1.5">
                        <HelpCircle className="w-4 h-4 text-[#FF7AB3]" />
                        <span>Targeted Interview Prep & Discussion Points</span>
                      </h4>
                      <div className="grid grid-cols-1 gap-2">
                        {result.interviewTips.map((tip, i) => (
                          <div key={i} className="p-3 bg-[#FAF7F9] rounded-xl border border-[#F1DDE9] text-xs text-[#4A3E44] flex items-start gap-2">
                            <span className="text-[#FF7AB3] font-bold">Q{i + 1}.</span>
                            <span>{tip}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Tab 2: Keywords */}
              {activeResultTab === 'keywords' && (
                <div className="bg-white rounded-2xl p-6 border border-[#F1DDE9] shadow-xs space-y-5">
                  <div>
                    <h4 className="text-xs font-bold text-rose-700 uppercase tracking-wider flex items-center gap-1.5 mb-2.5">
                      <AlertCircle className="w-4 h-4 text-rose-500" />
                      <span>Missing ATS Keywords (Add to Resume)</span>
                    </h4>
                    <p className="text-xs text-[#736A6D] mb-3">
                      These keywords appear in the job requirements but are missing from your resume. Incorporating them helps pass automated ATS screeners:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {result.missingKeywords.map((kw, i) => (
                        <span
                          key={i}
                          className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-rose-50 border border-rose-200 text-rose-700 flex items-center gap-1.5"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                          <span>{kw}</span>
                        </span>
                      ))}
                      {result.missingKeywords.length === 0 && (
                        <span className="text-xs text-stone-500 italic">No critical missing keywords identified! Excellent keyword density.</span>
                      )}
                    </div>
                  </div>

                  <div className="pt-4 border-t border-[#F1DDE9]">
                    <h4 className="text-xs font-bold text-emerald-700 uppercase tracking-wider flex items-center gap-1.5 mb-2.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      <span>Matching Qualified Skills</span>
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {result.matchingSkills.map((kw, i) => (
                        <span
                          key={i}
                          className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center gap-1.5"
                        >
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span>{kw}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 3: Bullet Rewrites */}
              {activeResultTab === 'bullets' && (
                <div className="space-y-3">
                  {result.bulletRewrites.map((b, i) => (
                    <div key={i} className="bg-white rounded-2xl p-5 border border-[#F1DDE9] shadow-xs space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-[#9D3C5E] uppercase tracking-wider">
                          Bullet Suggestion #{i + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(b.improved, false, i)}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-[#736A6D] hover:text-[#FF7AB3] transition"
                        >
                          {copiedBulletIdx === i ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                              <span className="text-emerald-600">Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Copy Rewrite</span>
                            </>
                          )}
                        </button>
                      </div>

                      <div className="space-y-2">
                        <div className="p-3 rounded-xl bg-stone-50 border border-stone-200 text-xs text-stone-600">
                          <span className="font-bold text-stone-400 block text-[10px] uppercase mb-0.5">Original Mention:</span>
                          <span>{b.original}</span>
                        </div>

                        <div className="p-3 rounded-xl bg-[#FFF5F8] border border-[#F1DDE9] text-xs text-[#4A3E44]">
                          <span className="font-bold text-[#FF7AB3] block text-[10px] uppercase mb-0.5 flex items-center gap-1">
                            <Sparkles className="w-3 h-3" />
                            <span>ATS-Optimized Rewrite (Impact + Metrics):</span>
                          </span>
                          <span className="font-medium text-[#4A3E44] leading-relaxed">{b.improved}</span>
                        </div>
                      </div>

                      <p className="text-[11px] text-[#736A6D] italic">
                        <strong>Why this works:</strong> {b.reason}
                      </p>
                    </div>
                  ))}
                  {result.bulletRewrites.length === 0 && (
                    <div className="bg-white rounded-2xl p-8 border border-[#F1DDE9] text-center text-xs text-[#736A6D]">
                      No bullet point rewrites generated for this prompt.
                    </div>
                  )}
                </div>
              )}

              {/* Tab 4: Tailored Pitch / Cover Letter */}
              {activeResultTab === 'pitch' && (
                <div className="bg-white rounded-2xl p-6 border border-[#F1DDE9] shadow-xs space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-[#F1DDE9]">
                    <div>
                      <h4 className="text-sm font-bold text-[#4A3E44]">Tailored Recruiter Application Pitch</h4>
                      <p className="text-xs text-[#736A6D]">Personalized cover letter customized for {companyName || 'this role'}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(result.tailoredPitch, true)}
                      className="px-3.5 py-1.5 rounded-xl bg-[#FFF0F6] hover:bg-[#FCE7F3] border border-[#F1DDE9] text-xs font-bold text-[#9D3C5E] transition flex items-center gap-1.5 shadow-2xs"
                    >
                      {copiedPitch ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="text-emerald-600">Copied Pitch!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-[#FF7AB3]" />
                          <span>Copy Pitch</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="p-4 rounded-xl bg-[#FAF7F9] border border-[#F1DDE9] text-xs text-[#4A3E44] leading-relaxed whitespace-pre-wrap font-sans">
                    {result.tailoredPitch}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Full report layout for client-side PDF capture */}
      {result && (
        <ATSExportReport
          result={result}
          jobTitle={jobTitle}
          companyName={companyName}
          candidateName={session?.user?.name || 'Candidate Profile'}
          reportRef={reportRef}
        />
      )}
    </div>
  );
}
