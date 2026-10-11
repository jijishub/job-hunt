import type { JobApplication } from '@/types/job';
export const ANALYTICS_STAGES = ['NOT_SUBMITTED', 'SUBMITTED', 'SCREENING', 'INTERVIEW', 'FINAL', 'OFFER'] as const;
export type AnalyticsStage = typeof ANALYTICS_STAGES[number];
export const STAGE_LABELS: Record<AnalyticsStage, string> = { NOT_SUBMITTED: 'Not submitted', SUBMITTED: 'Submitted', SCREENING: 'Screening', INTERVIEW: 'Interview', FINAL: 'Final interview', OFFER: 'Acceptance / offer' };
export const DEFAULT_STATUS_STAGES: Record<string, AnalyticsStage> = {
  'not started': 'NOT_SUBMITTED', inquiry: 'NOT_SUBMITTED', repeated: 'NOT_SUBMITTED', 'not accepting interns': 'NOT_SUBMITTED',
  'applied - with moa': 'SUBMITTED', 'applied - no moa': 'SUBMITTED', applied: 'SUBMITTED',
  'initial interview': 'INTERVIEW', 'technical interview': 'INTERVIEW', 'interview task': 'INTERVIEW',
  'final interview': 'FINAL', 'interview - not accepted': 'INTERVIEW',
  accepted: 'OFFER', 'accepted - not proceeding': 'OFFER', 'job offer': 'OFFER',
  'not accepted': 'SUBMITTED', 'do not proceed': 'SUBMITTED', 'not proceeding': 'SUBMITTED',
};
export function stageForStatus(status: string, category?: string, mapping: Record<string, AnalyticsStage> = {}) {
  const key = status.trim().toLowerCase();
  if (Object.hasOwn(mapping, key)) return mapping[key];
  if (Object.hasOwn(DEFAULT_STATUS_STAGES, key)) return DEFAULT_STATUS_STAGES[key];
  return ({ LEAD: 'NOT_SUBMITTED', APPLIED: 'SUBMITTED', SCREENING: 'SCREENING', INTERVIEWING: 'INTERVIEW', OFFER: 'OFFER', ACCEPTED: 'OFFER', REJECTED: 'SUBMITTED', WITHDRAWN: 'SUBMITTED' } as Record<string, AnalyticsStage>)[category || ''] || 'NOT_SUBMITTED';
}
export function reachedStage(app: JobApplication, mapping: Record<string, AnalyticsStage> = {}) {
  const recorded = [{ status: app.status, notion_status: app.notion_status }, ...(app.stage_history || [])].map(stage => stageForStatus(stage.notion_status || stage.status, stage.status, mapping));
  if (app.analytics_stage) recorded.push(app.analytics_stage);
  return Math.max(...recorded.map(stage => ANALYTICS_STAGES.indexOf(stage)));
}
