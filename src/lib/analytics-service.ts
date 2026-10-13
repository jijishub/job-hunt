import { getAnalyticsApplications, getCandidatePreferences } from '@/lib/db';
import { isInternship, pipelineAnalytics } from './analytics';
import type { UserAccount } from '@/types/job';

export async function getAccountAnalytics(user: UserAccount, scope = 'ALL') {
  const [records, preferences] = await Promise.all([getAnalyticsApplications(user, scope), getCandidatePreferences(user.id)]);
  const applications = records.filter(app => scope === 'INTERNSHIP' ? isInternship(app) : scope === 'OTHER' ? !isInternship(app) : true);
  return { applications, preferences, stats: pipelineAnalytics(applications, preferences?.analytics_status_stages, preferences?.analytics_rejection_statuses, new Date(), preferences?.analytics_age_boundaries) };
}
