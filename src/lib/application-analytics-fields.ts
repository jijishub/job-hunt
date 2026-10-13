import type { JobApplication, SeniorityLevel } from '@/types/job';

export const SENIORITY_LEVELS: { value: SeniorityLevel; label: string }[] = [
  { value: 'INTERNSHIP_TRAINEE', label: 'Internship / Trainee' },
  { value: 'GRADUATE_ENTRY_LEVEL', label: 'Graduate / Entry-level' },
  { value: 'JUNIOR', label: 'Junior' }, { value: 'ASSOCIATE', label: 'Associate' },
  { value: 'MID_LEVEL', label: 'Mid-level' }, { value: 'SENIOR', label: 'Senior' },
  { value: 'LEAD_PRINCIPAL', label: 'Lead / Principal' }, { value: 'UNSPECIFIED', label: 'Unspecified' },
];
export const JOB_PLATFORMS = ['LINKEDIN', 'JOBSTREET', 'INDEED', 'GOOGLE', 'DIRECT', 'REFERRAL', 'WALK_IN', 'OTHER', 'UNKNOWN'] as const;
export function seniorityLevel(title = ''): SeniorityLevel {
  // Longer explicit phrases win before the single-word rules.
  if (/\b(intern(?:ship)?|trainee|apprentice)\b/i.test(title)) return 'INTERNSHIP_TRAINEE';
  if (/\b(graduate|entry[ -]level|fresh[ -]grad(?:uate)?)\b/i.test(title)) return 'GRADUATE_ENTRY_LEVEL';
  if (/\b(lead|principal|staff)\b/i.test(title)) return 'LEAD_PRINCIPAL';
  if (/\b(senior|sr)\b/i.test(title)) return 'SENIOR';
  if (/\b(junior|jr)\b/i.test(title)) return 'JUNIOR';
  if (/\bassociate\b/i.test(title)) return 'ASSOCIATE';
  if (/\b(mid[ -]level|intermediate)\b/i.test(title)) return 'MID_LEVEL';
  return 'UNSPECIFIED';
}
export function effectiveSeniority(app: Partial<JobApplication>) {
  return SENIORITY_LEVELS.some(item => item.value === app.seniority_level) ? app.seniority_level! : seniorityLevel(app.role_title);
}
export function analyticsFieldUpdates(saved: Partial<JobApplication> | null, updates: Partial<JobApplication>): Partial<JobApplication> {
  const result: Partial<JobApplication> = {};
  const title = updates.role_title ?? saved?.role_title ?? '';
  const titleChanged = title !== saved?.role_title;
  for (const field of ['seniority_level'] as const) {
    const source = `${field}_source` as const;
    const explicit = Object.hasOwn(updates, field) || Object.hasOwn(updates, source);
    const value = updates[field];
    const manual = explicit ? Boolean(value && updates[source] !== 'derived') : Boolean(saved?.[field] && saved[source] !== 'derived');
    if (explicit && manual) {
      Object.assign(result, { [field]: typeof value === 'string' ? value.trim() : value, [source]: 'manual' });
    } else if (explicit || !saved?.[field] || (!manual && titleChanged)) {
      Object.assign(result, { [field]: seniorityLevel(title), [source]: 'derived' });
    }
  }
  if (Object.hasOwn(updates, 'job_platform')) result.job_platform = updates.job_platform?.trim() || null;
  else if (!saved?.job_platform && updates.source) result.job_platform = updates.source;
  if (Object.hasOwn(updates, 'first_response_at')) result.first_response_at = updates.first_response_at ? new Date(updates.first_response_at).toISOString() : null;
  return result;
}
