import type { JobApplication } from '@/types/job';

// Deliberately retain complete history/timing/salary metadata: summaries support
// all-history analytics and filters, never analytics over just a displayed page.
export const SUMMARY_FIELDS = ['id', 'owner', 'company_id', 'company_name', 'role_title', 'status', 'notion_status', 'not_proceeding', 'priority', 'job_type', 'work_model', 'location', 'service', 'salary_min', 'salary_max', 'salary_currency', 'offer_amount', 'offer_currency', 'offer_pay_period', 'expected_salary_amount', 'expected_salary_currency', 'expected_salary_pay_period', 'date_applied', 'first_response_at', 'follow_up_date', 'created_at', 'updated_at', 'job_url', 'job_platform', 'source', 'role_fit', 'role_fit_source', 'seniority_level', 'seniority_level_source', 'analytics_stage', 'stage_history', 'notion_page_id', 'sync_status', 'last_synced_at'] as const;
export function logoReference(value: string | null | undefined, companyId?: string, applicationId?: string, version?: string) {
  if (!value?.startsWith('data:')) return value || undefined;
  if (!companyId && !applicationId) return undefined;
  const params = new URLSearchParams(companyId ? { company: companyId } : { application: applicationId! });
  if (version) params.set('v', version);
  return `/api/company-logo?${params}`;
}
export function applicationSummary(app: JobApplication): JobApplication {
  const value = Object.fromEntries(SUMMARY_FIELDS.filter(key => app[key] !== undefined).map(key => [key, app[key]]));
  return { ...value, summary_only: true, notes: app.notes?.slice(0, 240), information: app.information?.slice(0, 240), company_logo: logoReference(app.company_logo, undefined, app.id, app.updated_at), role_fit_analysis: app.role_fit_analysis ? { fit: app.role_fit_analysis.fit, preference_alignment: app.role_fit_analysis.preference_alignment } : undefined } as JobApplication;
}
export function matchesApplicationSearch(app: JobApplication, search: string) {
  const q = search.trim().toLowerCase();
  return !q || [app.role_title, app.company_name, app.notes, app.location, app.service, app.job_description, app.information, app.notion_status, app.status, app.not_proceeding ? 'Not Proceeding' : ''].some(value => value?.toLowerCase().includes(q));
}
