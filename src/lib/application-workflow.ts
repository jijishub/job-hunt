import type { JobApplication } from '@/types/job';
import { ANALYTICS_STAGES, DEFAULT_REJECTION_STATUSES, reachedStage, stageForStatus, type AnalyticsStage } from './analytics-stages';
import { applicationStatusLabel, canonicalStatusName, isRejectionStatus, statusCategoryForLabel } from './statuses';

export function isArchivedApplication(app: Pick<JobApplication, 'status' | 'notion_status' | 'not_proceeding'>) {
  return app.not_proceeding === true || app.status === 'WITHDRAWN'
    || /not proceeding/i.test(canonicalStatusName(app.notion_status || ''));
}

export function displayApplicationStatus(app: Pick<JobApplication, 'status' | 'notion_status' | 'not_proceeding'>, mapping: Record<string, AnalyticsStage> = {}, rejectionStatuses: readonly string[] = DEFAULT_REJECTION_STATUSES) {
  if (isArchivedApplication(app)) return 'WITHDRAWN';
  const label = app.notion_status?.trim() || applicationStatusLabel(app.status);
  if (isRejectionStatus(label, rejectionStatuses)) return 'REJECTED';
  const status = statusCategoryForLabel(label, app.status);
  if (['REJECTED', 'ACCEPTED', 'OFFER'].includes(status)) return status;
  const stage = stageForStatus(label, status, mapping);
  return ({ NOT_SUBMITTED: 'LEAD', SUBMITTED: 'APPLIED', SCREENING: 'SCREENING', INTERVIEW: 'INTERVIEWING', FINAL: 'INTERVIEWING', OFFER: 'OFFER' } as const)[stage];
}

export function displayApplicationStatusLabel(app: Pick<JobApplication, 'status' | 'notion_status' | 'not_proceeding'>) {
  return isArchivedApplication(app) ? 'Not Proceeding' : canonicalStatusName(app.notion_status || '') || applicationStatusLabel(app.status);
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
  if (!withdrawing && !isArchivedApplication({ ...saved, ...next })) {
    const label = canonicalStatusName(next.notion_status ?? saved.notion_status ?? '');
    const category = statusCategoryForLabel(label, next.status || saved.status);
    if (next.notion_status !== undefined) next.notion_status = label;
    if (category !== (next.status || saved.status)) next.status = category;
  }
  const candidate = { ...saved, ...next, analytics_stage: saved.analytics_stage };
  next.analytics_stage = ANALYTICS_STAGES[Math.max(reachedStage(saved, mapping), reachedStage(candidate, mapping))];
  return next;
}
