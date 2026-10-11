export const APPLICATION_STATUSES = ['LEAD', 'APPLIED', 'SCREENING', 'INTERVIEWING', 'OFFER', 'ACCEPTED', 'REJECTED', 'WITHDRAWN'] as const;

export function applicationValidationError(body: Record<string, unknown>) {
  const options: Record<string, readonly string[]> = {
    status: APPLICATION_STATUSES, priority: ['LOW', 'MEDIUM', 'HIGH', 'DREAM'],
    job_type: ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP'], work_model: ['REMOTE', 'HYBRID', 'ON_SITE'],
  };
  for (const [field, values] of Object.entries(options)) {
    if (body[field] != null && !values.includes(body[field] as string)) return `Invalid ${field.replaceAll('_', ' ')}.`;
  }
  for (const field of ['role_title', 'company_name', 'information', 'job_description', 'notes', 'notion_status']) {
    if (body[field] != null && typeof body[field] !== 'string') return `${field.replaceAll('_', ' ')} must be text.`;
  }
  if (body.job_url && (typeof body.job_url !== 'string' || !/^https?:\/\//i.test(body.job_url))) return 'Use an http or https job posting URL.';
  for (const field of ['salary_min', 'salary_max']) {
    if (body[field] != null && body[field] !== '' && (!Number.isFinite(Number(body[field])) || Number(body[field]) < 0)) return 'Salary must be a nonnegative amount.';
  }
  if (body.salary_min != null && body.salary_max != null && body.salary_max !== '' && Number(body.salary_min) > Number(body.salary_max)) return 'Maximum salary must be at least the minimum.';
  return null;
}
