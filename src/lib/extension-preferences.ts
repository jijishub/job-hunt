import { getCandidatePreferences } from './db';
import { EMPTY_PREFERENCES, validatePreferences } from './preferences';
import { captureHash } from './capture-validation';
import type { UserAccount } from '@/types/job';

// Hash the JSON that crosses the wire, omitting optional undefined properties.
const digest = (value: unknown) => captureHash(JSON.parse(JSON.stringify(value)));

export async function extensionPreferenceSnapshot(user: Pick<UserAccount, 'id' | 'email'>) {
  // This read selects only preferences; never fetch the server resume.
  const preferences = validatePreferences({ ...EMPTY_PREFERENCES, ...await getCandidatePreferences(user.id) });
  const assessment_preferences = {
    target_companies: preferences.target_companies, target_roles: preferences.target_roles,
    preferred_locations: preferences.preferred_locations, work_models: preferences.work_models,
    job_types: preferences.job_types, salary_min: preferences.salary_min ?? null,
    salary_currency: preferences.salary_currency, dealbreakers: preferences.dealbreakers,
    portfolio_summary: preferences.portfolio_summary,
  };
  return { schema_version: 1, account: { id: user.id, email: user.email },
    revision: digest(preferences), preferences, assessment_preferences,
    preferences_hash: digest(assessment_preferences) };
}
