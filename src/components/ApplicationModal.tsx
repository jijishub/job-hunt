'use client';

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
} from 'lucide-react';

interface ApplicationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (appData: Partial<JobApplication>) => Promise<void>;
  companies: Company[];
  initialData?: JobApplication | null;
  users?: UserAccount[];
  currentUserId?: string;
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
  { value: 'HIGH', label: 'High' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'LOW', label: 'Low' },
];

export default function ApplicationModal({
  isOpen,
  onClose,
  onSave,
  companies,
  initialData,
  users,
  currentUserId,
}: ApplicationModalProps) {
  const [roleTitle, setRoleTitle] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [customLogoUrl, setCustomLogoUrl] = useState('');
  const [status, setStatus] = useState<ApplicationStatus>('LEAD');
  const [priority, setPriority] = useState<Priority>('MEDIUM');
  const [jobType, setJobType] = useState<JobType>('FULL_TIME');
  const [workModel, setWorkModel] = useState<WorkModel>('REMOTE');
  const [location, setLocation] = useState('');
  const [salaryMin, setSalaryMin] = useState<string>('');
  const [salaryMax, setSalaryMax] = useState<string>('');
  const [salaryCurrency, setSalaryCurrency] = useState('USD');
  const [jobUrl, setJobUrl] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [dateApplied, setDateApplied] = useState('');
  const [notes, setNotes] = useState('');
  const [owner, setOwner] = useState<string>(currentUserId || 'user_ji');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [showCompanyDropdown, setShowCompanyDropdown] = useState(false);

  useEffect(() => {
    if (initialData) {
      setRoleTitle(initialData.role_title || '');
      setCompanyName(initialData.company_name || '');
      setCustomLogoUrl(initialData.company_logo || '');
      setStatus(initialData.status || 'LEAD');
      setPriority(initialData.priority || 'MEDIUM');
      setJobType(initialData.job_type || 'FULL_TIME');
      setWorkModel(initialData.work_model || 'REMOTE');
      setLocation(initialData.location || '');
      setSalaryMin(initialData.salary_min ? String(initialData.salary_min) : '');
      setSalaryMax(initialData.salary_max ? String(initialData.salary_max) : '');
      setSalaryCurrency(initialData.salary_currency || 'USD');
      setJobUrl(initialData.job_url || '');
      setContactName(initialData.contact_name || '');
      setContactEmail(initialData.contact_email || '');
      setDateApplied(initialData.date_applied ? initialData.date_applied.split('T')[0] : '');
      setNotes(initialData.notes || '');
      setOwner(initialData.owner || currentUserId || 'user_ji');
    } else {
      setRoleTitle('');
      setCompanyName('');
      setCustomLogoUrl('');
      setStatus('LEAD');
      setPriority('MEDIUM');
      setJobType('FULL_TIME');
      setWorkModel('REMOTE');
      setLocation('');
      setSalaryMin('');
      setSalaryMax('');
      setSalaryCurrency('USD');
      setJobUrl('');
      setContactName('');
      setContactEmail('');
      setDateApplied('');
      setNotes('');
      setOwner(currentUserId || 'user_ji');
    }
  }, [initialData, isOpen, currentUserId]);

  if (!isOpen) return null;

  const handleSelectCompany = (comp: Company) => {
    setCompanyName(comp.name);
    setCustomLogoUrl(comp.logo_url || '');
    setShowCompanyDropdown(false);
  };

  const filteredCompanies = companies.filter((c) =>
    c.name.toLowerCase().includes(companyName.toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleTitle.trim() || !companyName.trim()) return;

    setIsSubmitting(true);
    try {
      await onSave({
        role_title: roleTitle.trim(),
        company_name: companyName.trim(),
        company_logo: customLogoUrl || undefined,
        status,
        priority,
        job_type: jobType,
        work_model: workModel,
        location: location.trim() || undefined,
        salary_min: salaryMin ? Number(salaryMin) : undefined,
        salary_max: salaryMax ? Number(salaryMax) : undefined,
        salary_currency: salaryCurrency,
        job_url: jobUrl.trim() || undefined,
        contact_name: contactName.trim() || undefined,
        contact_email: contactEmail.trim() || undefined,
        date_applied: dateApplied ? new Date(dateApplied).toISOString() : undefined,
        notes: notes.trim() || undefined,
        owner,
      });
      onClose();
    } catch (err) {
      console.error(err);
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
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-white/80 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5 text-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Applicant Owner Selector */}
            <div>
              <label className="block text-xs font-semibold text-[#736A6D] uppercase tracking-wider mb-1.5">
                Target Pipeline / Applicant
              </label>
              <select
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#F1DDE9] text-xs font-semibold text-[#736A6D] focus:outline-none focus:border-[#FF7AB3] bg-white transition cursor-pointer"
              >
                {users && users.length > 0 ? (
                  users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.avatar || '👤'} {u.name} ({u.role.toUpperCase()} • {u.notion_enabled ? 'Notion Sync' : 'Cloud DB'})
                    </option>
                  ))
                ) : (
                  <>
                    <option value="user_ji">🌸 Ji (ADMIN • Notion Sync)</option>
                    <option value="user_denise">✨ Denise (MEMBER • Cloud DB)</option>
                  </>
                )}
              </select>
            </div>

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
            </div>

            <div className="relative">
              <label className="block text-xs font-semibold text-[#736A6D] uppercase tracking-wider mb-1.5">
                Company (Reusable with Icon) *
              </label>
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

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#736A6D] uppercase tracking-wider mb-1.5">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as ApplicationStatus)}
                className="w-full px-3 py-2 rounded-xl border border-[#F1DDE9] focus:outline-none focus:border-[#FF7AB3] text-xs font-medium text-[#4A3E44] bg-white transition"
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#736A6D] uppercase tracking-wider mb-1.5">
                Priority
              </label>
              <select
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

            <div>
              <label className="block text-xs font-semibold text-[#736A6D] uppercase tracking-wider mb-1.5">
                Work Model
              </label>
              <select
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
                Min Salary
              </label>
              <input
                type="number"
                placeholder="e.g. 120000"
                value={salaryMin}
                onChange={(e) => setSalaryMin(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#F1DDE9] focus:outline-none focus:border-[#FF7AB3] text-xs text-[#4A3E44] transition"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#736A6D] uppercase tracking-wider mb-1.5">
                Max Salary ({salaryCurrency})
              </label>
              <input
                type="number"
                placeholder="e.g. 160000"
                value={salaryMax}
                onChange={(e) => setSalaryMax(e.target.value)}
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

          <div>
            <label className="block text-xs font-semibold text-[#736A6D] uppercase tracking-wider mb-1.5">
              Notes & Interview Prep (Notion Page Content)
            </label>
            <textarea
              rows={3}
              placeholder="Add key talking points, technical questions, salary negotiations, or links..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#F1DDE9] focus:outline-none focus:border-[#FF7AB3] text-xs text-[#4A3E44] placeholder-stone-400 transition"
            />
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

