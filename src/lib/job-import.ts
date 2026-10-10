import { JobApplication, JobType, WorkModel } from '@/types/job';

export const JOB_JSON_PROMPT = `Extract this job posting into ONE JSON object with these keys: role_title, company_name, description, qualifications (array of strings), location, work_model (ON_SITE, HYBRID, or REMOTE), job_type (FULL_TIME, PART_TIME, CONTRACT, or INTERNSHIP), salary_min, salary_max, salary_currency, job_url. Use numeric salary values and a three-letter currency. Omit unknown fields. Do not invent information or include candidate data. Return JSON only.`;
export function parseJobImport(raw: string): Partial<JobApplication> {
  let data: unknown;
  try { data = JSON.parse(raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')); }
  catch { throw new Error('Paste one valid JSON object. You can include Gemini’s JSON code fence.'); }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Expected one job object.');
  let job = data as Record<string, unknown>;
  if (job.job != null) {
    if (typeof job.job !== 'object' || Array.isArray(job.job)) throw new Error('The job field must contain one object.');
    job = job.job as Record<string, unknown>;
  }
  const text = (value: unknown, field: string) => {
    if (value == null) return undefined;
    if (typeof value !== 'string') throw new Error(`${field} must be text.`);
    return value.trim();
  };
  const result: Partial<JobApplication> = {};
  const title = text(job.role_title ?? job.job_title ?? job.title, 'Role title');
  const company = text(job.company_name ?? (typeof job.company === 'object' && job.company ? (job.company as Record<string, unknown>).name : job.company), 'Company');
  const description = text(job.description ?? job.job_description, 'Description');
  const qualifications = job.qualifications ?? job.requirements;
  if (qualifications != null && (!Array.isArray(qualifications) || !qualifications.every(item => typeof item === 'string'))) throw new Error('Qualifications must be an array of text items.');
  const requirements = (qualifications as string[] | undefined)?.map(item => item.trim()).filter(Boolean) || [];
  if (title) result.role_title = title;
  if (company) result.company_name = company;
  if (description || requirements.length) result.job_description = [description, requirements.length ? `Qualifications:\n${requirements.map(item => `- ${item}`).join('\n')}` : ''].filter(Boolean).join('\n\n');
  const location = text(job.location, 'Location'); if (location) result.location = location;
  const models: Record<string, WorkModel> = { onsite: 'ON_SITE', hybrid: 'HYBRID', remote: 'REMOTE' };
  const types: Record<string, JobType> = { fulltime: 'FULL_TIME', parttime: 'PART_TIME', contract: 'CONTRACT', internship: 'INTERNSHIP', intern: 'INTERNSHIP' };
  const model = text(job.work_model ?? job.workModel, 'Work model');
  if (model) { const value = models[model.toLowerCase().replace(/[\s_-]/g, '')]; if (!value) throw new Error('Work model must be ON_SITE, HYBRID, or REMOTE.'); result.work_model = value; }
  const type = text(job.job_type ?? job.employment_type, 'Job type');
  if (type) { const value = types[type.toLowerCase().replace(/[\s_-]/g, '')]; if (!value) throw new Error('Job type must be FULL_TIME, PART_TIME, CONTRACT, or INTERNSHIP.'); result.job_type = value; }
  const salary = job.salary && typeof job.salary === 'object' ? job.salary as Record<string, unknown> : {};
  for (const [key, value] of [['salary_min', job.salary_min ?? salary.min], ['salary_max', job.salary_max ?? salary.max]] as const) {
    if (value == null) continue;
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw new Error(`${key} must be a nonnegative number.`);
    result[key] = value;
  }
  if (result.salary_min != null && result.salary_max != null && result.salary_max < result.salary_min) throw new Error('Maximum salary must be at least the minimum salary.');
  const currency = text(job.salary_currency ?? salary.currency, 'Currency');
  if (currency) { if (!/^[a-z]{3}$/i.test(currency)) throw new Error('Currency must be a three-letter code such as PHP.'); result.salary_currency = currency.toUpperCase(); }
  const url = text(job.job_url ?? job.url, 'Job URL');
  if (url) { let parsed: URL; try { parsed = new URL(url); } catch { throw new Error('Job URL must be a valid https:// or http:// link.'); } if (!['https:', 'http:'].includes(parsed.protocol)) throw new Error('Job URL must use https:// or http://.'); result.job_url = url; }
  if (!title && !description && !requirements.length) throw new Error('No job title, description, or qualifications found. Candidate/profile JSON cannot be imported as a job.');
  return result;
}
