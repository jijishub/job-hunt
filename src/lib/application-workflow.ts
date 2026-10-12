import type { JobApplication } from '@/types/job';
import { ANALYTICS_STAGES, reachedStage, type AnalyticsStage } from './analytics-stages';
import { applicationStatusLabel, canonicalStatusName } from './statuses';

export function isArchivedApplication(app: Pick<JobApplication, 'status' | 'notion_status' | 'not_proceeding'>) {
  return app.not_proceeding === true || app.status === 'WITHDRAWN'
    || /not proceeding/i.test(canonicalStatusName(app.notion_status || ''));
}

export function displayApplicationStatus(app: Pick<JobApplication, 'status' | 'notion_status' | 'not_proceeding'>) {
  return isArchivedApplication(app) ? 'WITHDRAWN' : app.status;
}

export function displayApplicationStatusLabel(app: Pick<JobApplication, 'status' | 'notion_status' | 'not_proceeding'>) {
  return isArchivedApplication(app) ? 'Not Proceeding' : app.notion_status?.trim() || applicationStatusLabel(app.status);
}

export function applicationWorkflowUpdates(saved: JobApplication, updates: Partial<JobApplication>, mapping: Record<string, AnalyticsStage> = {}) {
  const next = { ...updates };
  const withdrawing = next.not_proceeding === true || (next.status === 'WITHDRAWN' && next.not_proceeding !== false);
  const restoring = next.not_proceeding === false && isArchivedApplication(saved);
  if (withdrawing) {
    next.not_proceeding = true;
    // Withdrawal is local: retain the actual recruitment status and its label.
    next.status = saved.status;
    next.notion_status = saved.notion_status;
  } else if (restoring) {
    next.not_proceeding = false;
    if (saved.status === 'WITHDRAWN' || /not proceeding/i.test(saved.notion_status || '')) {
      const previous = [...(saved.stage_history || [])].reverse().find(stage => !isArchivedApplication(stage));
      const fallback = ['LEAD', 'APPLIED', 'SCREENING', 'INTERVIEWING', 'INTERVIEWING', 'OFFER'] as const;
      next.status = previous?.status || (saved.status !== 'WITHDRAWN' ? saved.status : fallback[reachedStage(saved, mapping)]);
      next.notion_status = previous?.notion_status || applicationStatusLabel(next.status);
    }
  } else if (next.status && next.status !== saved.status && isArchivedApplication(saved)) {
    next.not_proceeding = false;
  }
  const candidate = { ...saved, ...next, analytics_stage: saved.analytics_stage };
  next.analytics_stage = ANALYTICS_STAGES[Math.max(reachedStage(saved, mapping), reachedStage(candidate, mapping))];
  return next;
}
