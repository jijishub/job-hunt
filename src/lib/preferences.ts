import { JobType, WorkModel } from '@/types/job';
export interface PersonalPreferences {
  target_companies: string[];
  target_roles: string[];
  preferred_locations: string[];
  work_models: WorkModel[];
  job_types: JobType[];
  salary_min?: number;
  salary_currency: string;
  dealbreakers: string;
  portfolio_summary: string;
}
export const EMPTY_PREFERENCES: PersonalPreferences = { target_companies: [], target_roles: [], preferred_locations: [], work_models: [], job_types: [], salary_currency: 'PHP', dealbreakers: '', portfolio_summary: '' };
export function validatePreferences(raw: unknown): PersonalPreferences {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Preferences must be an object.');
  const value = raw as Record<string, unknown>;
  const list = (key: string) => {
    const entries = value[key] ?? [];
    if (!Array.isArray(entries) || entries.length > 50 || !entries.every(item => typeof item === 'string' && item.length <= 200)) throw new Error(`${key} must have at most 50 short text entries.`);
    return [...new Set(entries.map(item => item.trim()).filter(Boolean))];
  };
  const work = list('work_models'); const jobs = list('job_types');
  if (!work.every(model => ['ON_SITE', 'HYBRID', 'REMOTE'].includes(model))) throw new Error('Choose valid work models.');
  if (!jobs.every(type => ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP'].includes(type))) throw new Error('Choose valid job types.');
  if (value.salary_min != null && (typeof value.salary_min !== 'number' || !Number.isFinite(value.salary_min) || value.salary_min < 0)) throw new Error('Minimum salary must be a nonnegative number.');
  const currency = value.salary_currency ?? 'PHP'; if (typeof currency !== 'string' || !/^[a-z]{3}$/i.test(currency)) throw new Error('Use a three-letter currency such as PHP.');
  for (const key of ['dealbreakers', 'portfolio_summary']) if (value[key] != null && (typeof value[key] !== 'string' || (value[key] as string).length > 12000)) throw new Error(`${key} must be text under 12,000 characters.`);
  return { target_companies: list('target_companies'), target_roles: list('target_roles'), preferred_locations: list('preferred_locations'), work_models: work as WorkModel[], job_types: jobs as JobType[], salary_min: value.salary_min as number | undefined, salary_currency: currency.toUpperCase(), dealbreakers: (value.dealbreakers as string || '').trim(), portfolio_summary: (value.portfolio_summary as string || '').trim() };
}
