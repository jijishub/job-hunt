'use client';

import { CURRENCIES } from '@/lib/currencies';
import { ANALYTICS_STAGES, STAGE_LABELS, AnalyticsStage } from '@/lib/analytics-stages';
import CloseButton from './CloseButton';
import CurrencyInput from './CurrencyInput';
import { OFFER_PAY_PERIODS } from '@/lib/salary-offers';
import type { OfferPayPeriod } from '@/types/job';
import { ROLE_FITS } from '@/lib/role-fit';
import { parseJobImport, JOB_JSON_PROMPT } from '@/lib/job-import';
import type { RoleFit, RoleFitAnalysis } from '@/types/job';

import ImageDropzone from './ImageDropzone';

import React, { useState, useEffect } from 'react';
import { JobApplication, Company, ApplicationStatus, Priority, JobType, WorkModel, UserAccount } from '@/types/job';
import {
  X,
  Briefcase,
  Building2,
  Calendar,
  Globe,
  Sparkles,
  User,
  Plus,
  Upload,
} from 'lucide-react';
import { SEEDED_STATUS_OPTIONS, MEMBER_STATUS_OPTIONS, applicationStatusLabel, getStatusCategory, StatusOption, getStatusStyle } from '@/lib/statuses';

interface ApplicationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (appData: Partial<JobApplication> & { ensure_company?: boolean }) => Promise<void>;
  companies: Company[];
  initialData?: JobApplication | null;
  users?: UserAccount[];
  currentUserId?: string;
  isMember?: boolean;
}

function compressImage(file: File, callback: (base64: string) => void) {
  if (!file.type.startsWith('image/')) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const maxDim = 128;
      let width = img.width;
      let height = img.height;
      if (width > height) {
        if (width > maxDim) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        }
      } else {
        if (height > maxDim) {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/webp', 0.85);
        callback(dataUrl);
      }
    };
    img.src = e.target?.result as string;
  };
  reader.readAsDataURL(file);
}

const STATUS_OPTIONS: { value: ApplicationStatus; label: string }[] = [
  { value: 'LEAD', label: 'Lead / Wishlist' },
  { value: 'APPLIED', label: 'Applied' },
  { value: 'SCREENING', label: 'Screening' },
  { value: 'INTERVIEWING', label: 'Interviewing' },
  { value: 'OFFER', label: 'Offer Received' },
  { value: 'ACCEPTED', label: 'Accepted 🎉' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'WITHDRAWN', label: 'Withdrawn' },
];

const PRIORITY_OPTIONS: { value: Priority; label: string }[] = [
  { value: 'DREAM', label: '⭐ Dream Job' },
  { value: 'HIGH', label: '🌸 High' },
  { value: 'MEDIUM', label: '💮 Medium' },
  { value: 'LOW', label: '☕ Low' },
];

export default function ApplicationModal({
  isOpen,
  onClose,
  onSave,
  companies,
  initialData,
  users,
  currentUserId,
  isMember = false,
}: ApplicationModalProps) {
  const [roleTitle, setRoleTitle] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [roleFit, setRoleFit] = useState<RoleFit | null>(null);
  const [fitAnalysis, setFitAnalysis] = useState<RoleFitAnalysis | null>(null);
  const [useAiFit, setUseAiFit] = useState(false);
  const [fitError, setFitError] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importMessage, setImportMessage] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [customLogoUrl, setCustomLogoUrl] = useState('');
  const [status, setStatus] = useState<ApplicationStatus>('LEAD');
  const [priority, setPriority] = useState<Priority>('MEDIUM');
  const [jobType, setJobType] = useState<JobType>('FULL_TIME');
  const [workModel, setWorkModel] = useState<WorkModel>('ON_SITE');
  const [location, setLocation] = useState('');
  const [service, setService] = useState('');
  const [notionStatus, setNotionStatus] = useState('Not started');
  const [analyticsStage,setAnalyticsStage] = useState<AnalyticsStage>('NOT_SUBMITTED');
  const [notProceeding,setNotProceeding] = useState(false);
  const [salaryMin, setSalaryMin] = useState<string>('');
  const [salaryMax, setSalaryMax] = useState<string>('');
  const [salaryCurrency, setSalaryCurrency] = useState('PHP');
  const [offerAmount, setOfferAmount] = useState('');
  const [offerCurrency, setOfferCurrency] = useState('PHP');
  const [offerPayPeriod, setOfferPayPeriod] = useState<OfferPayPeriod>('MONTHLY');
  const [jobUrl, setJobUrl] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [dateApplied, setDateApplied] = useState('');
  const [notes, setNotes] = useState('');
  const [owner, setOwner] = useState<string>(currentUserId || users?.[0]?.id || 'admin');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [statusOptions, setStatusOptions] = useState<StatusOption[]>(isMember ? MEMBER_STATUS_OPTIONS : SEEDED_STATUS_OPTIONS);
  const [isAddingCustomStatus, setIsAddingCustomStatus] = useState(false);
  const [newStatusInput, setNewStatusInput] = useState('');
  const [isSavingStatus, setIsSavingStatus] = useState(false);

  const [showCompanyDropdown, setShowCompanyDropdown] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setStatusOptions(isMember ? MEMBER_STATUS_OPTIONS : SEEDED_STATUS_OPTIONS);
      fetch('/api/statuses')
        .then((r) => r.json())
        .then((d) => {
          if (d.success && Array.isArray(d.data)) {
            setStatusOptions(d.data);
          }
        })
        .catch(() => {});
    }
  }, [isOpen, isMember]);

  useEffect(() => {
    setJobDescription(initialData?.information || initialData?.job_description || '');
    setOfferAmount(initialData?.offer_amount != null ? String(initialData.offer_amount) : '');
    setOfferCurrency(initialData?.offer_currency || 'PHP');
    setOfferPayPeriod(initialData?.offer_pay_period || 'MONTHLY');
    setAnalyticsStage(initialData?.analytics_stage || 'NOT_SUBMITTED'); setNotProceeding(initialData?.not_proceeding || false);
    setRoleFit(initialData?.role_fit || initialData?.role_fit_analysis?.fit || null);
    setFitAnalysis(initialData?.role_fit_analysis || null);
    setUseAiFit(initialData?.role_fit_source === 'ai');
    setFitError(''); setImportOpen(false); setImportText(''); setImportMessage('');
    if (initialData) {
      setRoleTitle(initialData.role_title || '');
      setCompanyName(initialData.company_name || '');
      setCustomLogoUrl(initialData.company_logo || '');
      const resolvedNotionStatus =
        initialData.notion_status?.trim() || applicationStatusLabel(initialData.status);
      setNotionStatus(resolvedNotionStatus);
      setStatus(initialData.status || getStatusCategory(resolvedNotionStatus));
      setService(initialData.service || '');
      setPriority(initialData.priority || 'MEDIUM');
      setJobType(initialData.job_type || 'FULL_TIME');
      setWorkModel(initialData.work_model || 'ON_SITE');
      setLocation(initialData.location || '');
      setSalaryMin(initialData.salary_min != null ? String(initialData.salary_min) : '');
      setSalaryMax(initialData.salary_max != null ? String(initialData.salary_max) : '');
      setSalaryCurrency(initialData.salary_currency || 'PHP');
      setJobUrl(initialData.job_url || '');
      setContactName(initialData.contact_name || '');
      setContactEmail(initialData.contact_email || '');
      setDateApplied(initialData.date_applied ? initialData.date_applied.split('T')[0] : '');
      setNotes(initialData.notes || '');
      setOwner(initialData.owner || currentUserId || users?.[0]?.id || 'admin');
    } else {
      setRoleTitle('');
      setCompanyName('');
      setCustomLogoUrl('');
      setNotionStatus('Not started');
      setStatus('LEAD');
      setService('');
      setPriority('MEDIUM');
      setJobType('FULL_TIME');
      setWorkModel('ON_SITE');
      setLocation('');
      setSalaryMin('');
      setSalaryMax('');
      setSalaryCurrency('PHP');
      setJobUrl('');
      setContactName('');
      setContactEmail('');
      const today = new Date();
      setDateApplied(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`);
      setNotes('');
      setOwner(currentUserId || users?.[0]?.id || 'admin');
    }
  }, [initialData, isOpen, currentUserId, users, isMember]);

  if (!isOpen) return null;

  const handleSelectCompany = (comp: Company) => {
    setCompanyName(comp.name);
    setCustomLogoUrl(comp.logo_url || '');
    setShowCompanyDropdown(false);
  };

  const filteredCompanies = companies.filter((c) =>
    c.name.toLowerCase().includes(companyName.toLowerCase())
  );

  const applyJobJson = () => {
    try {
      const job = parseJobImport(importText);
      if (job.role_title) { if (job.role_title !== roleTitle && !job.job_description) setJobDescription(''); setRoleTitle(job.role_title); }
      if (job.company_name) setCompanyName(job.company_name);
      if (job.job_description) setJobDescription(job.job_description);
      if (job.location) setLocation(job.location);
      if (job.work_model) setWorkModel(job.work_model);
      if (job.job_type) setJobType(job.job_type);
      if (job.salary_min != null) setSalaryMin(String(job.salary_min));
      if (job.salary_max != null) setSalaryMax(String(job.salary_max));
      if (job.salary_currency) setSalaryCurrency(job.salary_currency);
      if (job.job_url) setJobUrl(job.job_url);
      setFitAnalysis(null); setRoleFit(null); setUseAiFit(false);
      setImportMessage('Job fields filled in the draft. Review them before saving. No application has been created yet.');
    } catch (error) { setImportMessage(error instanceof Error ? error.message : 'JSON import failed.'); }
  };

  const analyzeFit = async () => {
    const response = await fetch('/api/role-fit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ roleTitle, jobDescription, jobFacts: { company: companyName, location, work_model: workModel, job_type: jobType, salary_min: salaryMin ? Number(salaryMin) : undefined, salary_max: salaryMax ? Number(salaryMax) : undefined, salary_currency: salaryCurrency } }) });
    const result = await response.json();
    if (!response.ok || !result.success) throw new Error(result.error || 'Role fit analysis failed.');
    setRoleFit(result.data.fit); setFitAnalysis(result.data); setUseAiFit(true); setFitError('');
    return result.data as RoleFitAnalysis;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleTitle.trim() || !companyName.trim()) return;

    setIsSubmitting(true);
    try {
      await onSave({
        ensure_company: true,
        job_description: jobDescription.trim(),
        role_fit: roleFit,
        role_fit_source: roleFit ? (useAiFit ? 'ai' : 'manual') : null,
        role_fit_analysis: roleFit && useAiFit ? fitAnalysis : null,
        role_title: roleTitle.trim(),
        company_name: companyName.trim(),
        company_logo: customLogoUrl || undefined,
        status,
        service: service.trim() || undefined,
        notion_status: notionStatus.trim() || undefined,
        information: jobDescription.trim(),
        analytics_stage: analyticsStage,
        not_proceeding: notProceeding,
        priority,
        job_type: jobType,
        work_model: workModel,
        location: location.trim() || undefined,
        salary_min: salaryMin ? Number(salaryMin) : undefined,
        salary_max: salaryMax ? Number(salaryMax) : undefined,
        salary_currency: salaryCurrency,
        offer_amount: offerAmount.trim() ? Number(offerAmount) : null,
        offer_currency: offerCurrency,
        offer_pay_period: offerPayPeriod,
        job_url: jobUrl.trim() || undefined,
        contact_name: contactName.trim() || undefined,
        contact_email: contactEmail.trim() || undefined,
        date_applied: dateApplied ? new Date(dateApplied).toISOString() : undefined,
        notes: notes.trim(),
        owner: currentUserId || owner || 'admin',
      });
      onClose();
    } catch (err) {
      setFitError(err instanceof Error ? err.message : 'Save failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl border border-[#F1DDE9] max-h-[92vh] flex flex-col overflow-hidden">
        <div className="h-16 bg-gradient-to-r from-[#FCE7F3] via-[#FFF0F6] to-[#FAF7F9] relative flex items-center justify-between px-6 border-b border-[#F1DDE9]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white border border-[#F1DDE9] shadow-xs flex items-center justify-center text-[#FF7AB3]">
              <Briefcase className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-[#4A3E44]">
                {initialData ? 'Edit Application' : 'New Application / Lead'}
              </h2>
              <p className="text-xs text-[#736A6D]">Track opportunities & sync with Notion</p>
            </div>
          </div>
          <CloseButton onClick={onClose} />
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5 text-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#736A6D] uppercase tracking-wider mb-1.5">
                Role / Job Title *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Senior Frontend Engineer"
                value={roleTitle}
                onChange={(e) => setRoleTitle(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#F1DDE9] focus:outline-none focus:border-[#FF7AB3] focus:ring-2 focus:ring-[#FF7AB3]/20 text-[#4A3E44] placeholder-stone-400 transition"
              />
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-[#736A6D] uppercase tracking-wider">
                      Status
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsAddingCustomStatus(!isAddingCustomStatus)}
                      className="text-[11px] font-semibold text-[#FF7AB3] hover:text-[#9D3C5E] transition"
                    >
                      {isAddingCustomStatus ? 'Cancel' : '+ Add Option'}
                    </button>
                  </div>

                  {!isAddingCustomStatus ? (
                    <select
                      aria-label="Application stage"
                      value={notionStatus || 'Not started'}
                      onChange={(e) => {
                        const chosen = e.target.value;
                        setNotionStatus(chosen);
                        setStatus(getStatusCategory(chosen));
                      }}
                      className="w-full px-3 py-2 rounded-xl border border-[#F1DDE9] focus:outline-none focus:border-[#FF7AB3] text-xs font-medium text-[#4A3E44] bg-white transition"
                    >
                      {notionStatus && !statusOptions.some(option => option.name === notionStatus) && (
                        <option value={notionStatus}>{notionStatus}</option>
                      )}
                      {statusOptions.map((opt) => (
                        <option key={opt.id || opt.name} value={opt.name}>
                          {opt.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        placeholder="New status..."
                        value={newStatusInput}
                        onChange={(e) => setNewStatusInput(e.target.value)}
                        className="flex-1 px-2.5 py-1.5 rounded-xl border border-[#FF7AB3] text-xs text-[#4A3E44] focus:outline-none bg-white min-w-0"
                      />
                      <button
                        type="button"
                        disabled={isSavingStatus || !newStatusInput.trim()}
                        onClick={async () => {
                          if (!newStatusInput.trim()) return;
                          setIsSavingStatus(true);
                          try {
                            const res = await fetch('/api/statuses', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ name: newStatusInput.trim() }),
                            });
                            const data = await res.json();
                            if (data.success && data.data) {
                              const newOpt = data.data;
                              setStatusOptions((prev) => [...prev, newOpt]);
                              setNotionStatus(newOpt.name);
                              setStatus(getStatusCategory(newOpt.name));
                              setNewStatusInput('');
                              setIsAddingCustomStatus(false);
                            }
                          } catch (err) {
                            console.error('Failed to save status:', err);
                          } finally {
                            setIsSavingStatus(false);
                          }
                        }}
                        className="px-2.5 py-1.5 rounded-xl bg-[#FF7AB3] text-white text-xs font-bold hover:bg-[#F06292] transition disabled:opacity-50 shrink-0"
                      >
                        {isSavingStatus ? '...' : 'Add'}
                      </button>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#736A6D] uppercase tracking-wider mb-1.5">
                    Priority
                  </label>
                  <select
                    aria-label="Priority"
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as Priority)}
                    className="w-full px-3 py-2 rounded-xl border border-[#F1DDE9] focus:outline-none focus:border-[#FF7AB3] text-xs font-medium text-[#4A3E44] bg-white transition"
                  >
                    {PRIORITY_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

              </div>
            </div>

            <div className="relative">
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-[#736A6D] uppercase tracking-wider">
                  Company (Reusable with Icon) *
                </label>
                <label
                  title="Upload logo photo (<20KB auto-compressed)"
                  className="cursor-pointer inline-flex items-center gap-1 text-[11px] font-semibold text-[#9D3C5E] hover:text-[#FF7AB3] transition"
                >
                  <Upload className="w-3 h-3 text-[#FF7AB3]" />
                  <span>Upload Logo</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) compressImage(file, (dataUrl) => setCustomLogoUrl(dataUrl));
                    }}
                  />
                </label>
              </div>
              <ImageDropzone onImage={file => compressImage(file, setCustomLogoUrl)} />
              <div className="relative">
                <input
                  type="text"
                  required
                  placeholder="Select or type new company..."
                  value={companyName}
                  onFocus={() => setShowCompanyDropdown(true)}
                  onChange={(e) => {
                    setCompanyName(e.target.value);
                    setShowCompanyDropdown(true);
                  }}
                  className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-[#F1DDE9] focus:outline-none focus:border-[#FF7AB3] focus:ring-2 focus:ring-[#FF7AB3]/20 text-[#4A3E44] placeholder-stone-400 transition"
                />
                <div className="absolute left-3 top-3 w-4 h-4 flex items-center justify-center pointer-events-none">
                  {customLogoUrl?.startsWith('emoji:') ? (
                    <span className="text-xs">{customLogoUrl.replace('emoji:', '')}</span>
                  ) : customLogoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={customLogoUrl} alt="" className="w-3.5 h-3.5 object-contain" />
                  ) : (
                    <Building2 className="w-4 h-4 text-stone-400" />
                  )}
                </div>
              </div>

              {showCompanyDropdown && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-[#F1DDE9] rounded-xl shadow-lg z-30 max-h-48 overflow-y-auto">
                  {filteredCompanies.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => handleSelectCompany(c)}
                      className="w-full px-3.5 py-2 text-left text-xs flex items-center gap-2 hover:bg-[#FAF7F9] transition"
                    >
                      <div className="w-5 h-5 rounded bg-stone-100 flex items-center justify-center shrink-0">
                        {c.logo_url?.startsWith('emoji:') ? (
                          <span className="text-xs">{c.logo_url.replace('emoji:', '')}</span>
                        ) : c.logo_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={c.logo_url} alt="" className="w-4 h-4 object-contain" />
                        ) : (
                          <Building2 className="w-3 h-3 text-stone-400" />
                        )}
                      </div>
                      <span className="font-medium text-[#4A3E44]">{c.name}</span>
                      {c.industry && (
                        <span className="text-[10px] text-[#736A6D] ml-auto">{c.industry}</span>
                      )}
                    </button>
                  ))}
                  {companyName.trim() &&
                    !companies.some(
                      (c) => c.name.toLowerCase() === companyName.toLowerCase().trim()
                    ) && (
                      <button
                        type="button"
                        onClick={() => setShowCompanyDropdown(false)}
                        className="w-full px-3.5 py-2 text-left text-xs text-[#9D3C5E] bg-[#FFF5F8] flex items-center gap-1.5 hover:bg-[#FCE7F3] transition"
                      >
                        <Plus className="w-3.5 h-3.5 text-[#FF7AB3]" />
                        <span>Create & save &quot;{companyName.trim()}&quot; as reusable company</span>
                      </button>
                    )}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#736A6D] uppercase tracking-wider mb-1.5">
                Work Model
              </label>
              <select
                aria-label="Work model"
                value={workModel}
                onChange={(e) => setWorkModel(e.target.value as WorkModel)}
                className="w-full px-3 py-2 rounded-xl border border-[#F1DDE9] focus:outline-none focus:border-[#FF7AB3] text-xs font-medium text-[#4A3E44] bg-white transition"
              >
                <option value="REMOTE">Remote</option>
                <option value="HYBRID">Hybrid</option>
                <option value="ON_SITE">On-site</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#736A6D] uppercase tracking-wider mb-1.5">
                Job Type
              </label>
              <select
                value={jobType}
                onChange={(e) => setJobType(e.target.value as JobType)}
                className="w-full px-3 py-2 rounded-xl border border-[#F1DDE9] focus:outline-none focus:border-[#FF7AB3] text-xs font-medium text-[#4A3E44] bg-white transition"
              >
                <option value="FULL_TIME">Full-time</option>
                <option value="CONTRACT">Contract</option>
                <option value="PART_TIME">Part-time</option>
                <option value="INTERNSHIP">Internship</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#736A6D] uppercase tracking-wider mb-1.5">
                Location
              </label>
              <input
                type="text"
                placeholder="e.g. Remote, San Francisco, Manila"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#F1DDE9] focus:outline-none focus:border-[#FF7AB3] text-xs text-[#4A3E44] transition"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#736A6D] uppercase tracking-wider mb-1.5">
                Monthly salary minimum
              </label>
              <div className="flex items-center gap-2">              <CurrencyInput
                placeholder="e.g. 120,000.00"
                aria-label="Monthly salary minimum"
                value={salaryMin}
                onValueChange={setSalaryMin}
                className="w-full px-3 py-2 rounded-xl border border-[#F1DDE9] focus:outline-none focus:border-[#FF7AB3] text-xs text-[#4A3E44] transition"
              /><select aria-label="Salary currency" value={salaryCurrency} onChange={e=>setSalaryCurrency(e.target.value)} className="rounded-lg border border-[#F1DDE9] bg-white p-2 text-xs">{CURRENCIES.map(c=><option key={c} value={c}>{c}</option>)}</select></div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#736A6D] uppercase tracking-wider mb-1.5">
                Max Salary ({salaryCurrency})
              </label>
              <CurrencyInput
                placeholder="e.g. 160,000.00"
                aria-label="Monthly salary maximum"
                value={salaryMax}
                onValueChange={setSalaryMax}
                className="w-full px-3 py-2 rounded-xl border border-[#F1DDE9] focus:outline-none focus:border-[#FF7AB3] text-xs text-[#4A3E44] transition"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#736A6D] uppercase tracking-wider mb-1.5">
                Job Posting URL
              </label>
              <div className="relative">
                <input
                  type="url"
                  placeholder="https://..."
                  value={jobUrl}
                  onChange={(e) => setJobUrl(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 rounded-xl border border-[#F1DDE9] focus:outline-none focus:border-[#FF7AB3] text-xs text-[#4A3E44] transition"
                />
                <Globe className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-2.5" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#736A6D] uppercase tracking-wider mb-1.5">
                Date Applied
              </label>
              <div className="relative">
                <input
                  type="date"
                  aria-label="Date Applied"
                  value={dateApplied}
                  onChange={(e) => setDateApplied(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 rounded-xl border border-[#F1DDE9] focus:outline-none focus:border-[#FF7AB3] text-xs text-[#4A3E44] transition"
                />
                <Calendar className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-2.5" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#736A6D] uppercase tracking-wider mb-1.5">
                Contact Person / Recruiter
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Name / Title"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 rounded-xl border border-[#F1DDE9] focus:outline-none focus:border-[#FF7AB3] text-xs text-[#4A3E44] transition"
                />
                <User className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-2.5" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#736A6D] uppercase tracking-wider mb-1.5">
                Contact Email
              </label>
              <input
                type="email"
                placeholder="recruiter@company.com"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#F1DDE9] focus:outline-none focus:border-[#FF7AB3] text-xs text-[#4A3E44] transition"
              />
            </div>
          </div>

          <section className="space-y-3 rounded-xl border border-[#F1DDE9] p-3 bg-[#FFF5F8]">
            <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold text-xs text-[#9D3C5E]">Job description (Information)</h3><button type="button" onClick={() => setImportOpen(!importOpen)} className="rounded-lg border border-[#F1DDE9] bg-white px-3 py-2 text-xs text-[#9D3C5E]">Import job JSON</button></div>
            {importOpen && <div className="space-y-2 rounded-xl border border-[#F1DDE9] bg-white p-3">
              <p className="text-xs text-[#736A6D]">Ask Gemini to extract the job posting, then paste its JSON here. This fills your draft for review.</p>
              <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(JOB_JSON_PROMPT); setImportMessage('Gemini prompt copied. Paste it with the job posting in Gemini.'); } catch { setImportMessage(JOB_JSON_PROMPT); } }} className="text-xs font-semibold text-[#9D3C5E]">Copy Gemini extraction prompt</button>
              <textarea aria-label="Job posting JSON" rows={5} className="w-full rounded-lg border border-[#F1DDE9] p-2 text-xs font-mono" value={importText} onChange={event => setImportText(event.target.value)} placeholder={'{"role_title":"Developer","company_name":"Example","description":"...","qualifications":["TypeScript"],"location":"Makati","work_model":"ON_SITE","job_type":"FULL_TIME","salary_currency":"PHP"}'} />
              <button type="button" onClick={applyJobJson} className="rounded-lg bg-[#9D3C5E] px-3 py-2 text-xs text-white">Fill draft from JSON</button>
              {importMessage && <p role="status" className="text-xs text-[#9D3C5E]">{importMessage}</p>}
            </div>}
            <label className="block text-xs font-semibold text-[#9D3C5E]">Job description
              <textarea aria-label="Job description" rows={4} value={jobDescription} onChange={event => setJobDescription(event.target.value)} placeholder="Paste the actual job description, required skills, and experience. A job title alone is not enough to assess fit." className="mt-1 w-full rounded-lg border border-[#F1DDE9] bg-white p-2 text-xs font-normal" />
            </label>
          </section>
          <div>
            <label className="block text-xs font-semibold text-[#736A6D] uppercase tracking-wider mb-1.5">Personal comments (Post Notes)</label>
            <textarea aria-label="Personal comments" rows={3} placeholder="Add key talking points, technical questions, salary negotiations, or links..." value={notes} onChange={event => setNotes(event.target.value)} className="w-full px-3.5 py-2.5 rounded-xl border border-[#F1DDE9] focus:outline-none focus:border-[#FF7AB3] text-xs text-[#4A3E44] placeholder-stone-400 transition" />
          </div>
          <section className="space-y-3 rounded-xl border border-[#F1DDE9] p-3">
            <h3 className="text-xs font-semibold text-[#9D3C5E]">Job offer</h3>
            <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr]">
              <label className="text-xs font-semibold">Offer amount<CurrencyInput aria-label="Offer amount" value={offerAmount} onValueChange={setOfferAmount} placeholder="Leave blank until offered" className="mt-1 w-full rounded-lg border border-[#F1DDE9] p-2 text-xs font-normal" /></label>
              <label className="text-xs font-semibold">Currency<select aria-label="Offer currency" value={offerCurrency} onChange={event => setOfferCurrency(event.target.value)} className="mt-1 w-full rounded-lg border border-[#F1DDE9] bg-white p-2 text-xs font-normal">{CURRENCIES.map(currency => <option key={currency} value={currency}>{currency}</option>)}</select></label>
              <label className="text-xs font-semibold">Pay period<select aria-label="Offer pay period" value={offerPayPeriod} onChange={event => setOfferPayPeriod(event.target.value as OfferPayPeriod)} className="mt-1 w-full rounded-lg border border-[#F1DDE9] bg-white p-2 text-xs font-normal">{OFFER_PAY_PERIODS.map(period => <option key={period.value} value={period.value}>{period.label}</option>)}</select></label>
            </div>
            <p className="text-[11px] text-[#736A6D]">Record the employer&apos;s actual base-pay offer, excluding bonuses and benefits.</p>
          </section>
          <section className="space-y-3 rounded-xl border border-[#F1DDE9] p-3 bg-[#FFF5F8]">
            <h3 className="font-semibold text-xs text-[#9D3C5E]">Role fit analysis</h3>
            <label className="block text-xs font-semibold">Role fit
              <select aria-label="Role fit" value={roleFit || 'UNASSESSED'} onChange={event => { setUseAiFit(false); setRoleFit(event.target.value === 'UNASSESSED' ? null : event.target.value as RoleFit); }} className="ml-2 rounded-lg border border-[#F1DDE9] bg-white p-2">
                <option value="UNASSESSED">Leave unassessed</option>{ROLE_FITS.map(fit => <option key={fit.value} value={fit.value}>{fit.label}</option>)}
              </select>
            </label>
            <p className="text-xs text-[#736A6D]">{useAiFit && roleFit ? 'Selected from the AI assessment. Choose another rating to set a manual fit.' : (ROLE_FITS.find(fit => fit.value === roleFit)?.description || 'Choose a rating manually, or click Reanalyze role fit to assess this role with AI. Saving does not run analysis.')}</p>
            {fitAnalysis && useAiFit && <p className="text-xs text-[#9D3C5E]">{ROLE_FITS.find(fit => fit.value === fitAnalysis.fit)?.label}: {fitAnalysis.explanation}{fitAnalysis.preference_notes ? ` Preferences: ${fitAnalysis.preference_notes}` : ''}</p>}
            <button type="button" disabled={isSubmitting || jobDescription.trim().length < 30} onClick={async () => { setIsSubmitting(true); setFitError(''); try { await analyzeFit(); } catch (error) { setFitError(error instanceof Error ? error.message : 'Analysis failed.'); } finally { setIsSubmitting(false); } }} className="rounded-lg border border-[#F1DDE9] bg-white px-3 py-2 text-xs text-[#9D3C5E] disabled:opacity-50">Reanalyze role fit</button>

            {fitError && <p role="alert" className="text-xs text-rose-700">{fitError} Select a manual fit or leave this role unassessed and retry.</p>}
          </section>

          <div className="grid gap-3 sm:grid-cols-2 rounded-xl border border-[#F1DDE9] p-3 text-xs">
            <label>Analytics phase reached<select aria-label="Analytics phase reached" value={analyticsStage} onChange={e=>setAnalyticsStage(e.target.value as AnalyticsStage)} className="mt-1 w-full rounded-lg border p-2">{ANALYTICS_STAGES.map(stage=><option key={stage} value={stage}>{STAGE_LABELS[stage]}</option>)}</select></label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={notProceeding} onChange={e=>setNotProceeding(e.target.checked)} />Not Proceeding</label>
            <p className="sm:col-span-2 text-[#736A6D]">Keep your status label. For ambiguous outcomes, record the phase reached; Not Proceeding does not erase your progress.</p>
          </div>
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#F1DDE9]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-[#736A6D] hover:bg-stone-100 rounded-xl transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !roleTitle.trim() || !companyName.trim()}
              className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-medium text-white bg-[#FF7AB3] hover:bg-[#F06292] rounded-xl shadow-xs transition disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5" />
              {isSubmitting
                ? 'Saving...'
                : initialData
                ? 'Save Changes'
                : 'Create Application'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

