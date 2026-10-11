import { reachedStage, recordedStages, stageForStatus, AnalyticsStage, ANALYTICS_STAGES, DEFAULT_REJECTION_STATUSES } from './analytics-stages';
import { applicationStatusLabel, canonicalStatusName } from './statuses';
import { JobApplication } from '@/types/job';
import { ROLE_FITS, validRoleFit } from './role-fit';

export function isInternship(app: JobApplication) {
  return app.job_type ? app.job_type === 'INTERNSHIP' : /\bintern(?:ship)?\b/i.test(app.role_title);
}
export function isSubmitted(app: JobApplication) { return reachedStage(app) >= 1; }
export function isRejection(app: JobApplication, rejectionStatuses: readonly string[] = DEFAULT_REJECTION_STATUSES) {
  const label = canonicalStatusName(app.notion_status?.trim() || applicationStatusLabel(app.status)).toLowerCase();
  return rejectionStatuses.some(status => canonicalStatusName(status).toLowerCase() === label);
}
export function uniqueApplications(applications: JobApplication[]) {
  const byId = new Map<string, JobApplication>();
  for (const app of applications) {
    const previous = byId.get(app.id);
    if (!previous || (Date.parse(app.updated_at) || 0) > (Date.parse(previous.updated_at) || 0)) byId.set(app.id, app);
  }
  return [...byId.values()];
}
export function currentOutcome(app: JobApplication, mapping: Record<string, AnalyticsStage> = {}, rejectionStatuses: readonly string[] = DEFAULT_REJECTION_STATUSES) {
  if (reachedStage(app, mapping) < 1) return 'NOT_SUBMITTED';
  if (isRejection(app, rejectionStatuses)) return 'REJECTED';
  if (app.not_proceeding || app.status === 'WITHDRAWN' || /not proceeding/i.test(canonicalStatusName(app.notion_status || ''))) return 'NOT_PROCEEDING';
  if (['ACCEPTED', 'OFFER'].includes(app.status) || stageForStatus(app.notion_status || app.status, app.status, mapping) === 'OFFER') return 'OFFER';
  if (app.status === 'REJECTED') return 'OTHER_CLOSED';
  return 'ACTIVE';
}
// Calendar dates stay as entered; timestamps use the project's reporting timezone.
export function applicationDay(value?: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return date.toISOString().slice(0, 10) === value ? value : null;
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}
export function pipelineAnalytics(input: JobApplication[], mapping: Record<string, AnalyticsStage> = {}, rejectionStatuses: readonly string[] = DEFAULT_REJECTION_STATUSES, now = new Date()) {
  const applications = uniqueApplications(input);
  const rank = (app: JobApplication) => reachedStage(app, mapping);
  const submitted = applications.filter(app => rank(app) >= 1);
  const rejected = (app: JobApplication) => isRejection(app, rejectionStatuses);
  const rejections = submitted.filter(rejected).length;
  const rate = (count: number, denominator: number) => denominator ? Math.round(count / denominator * 100) : null;
  const fitGroups = [...ROLE_FITS, { value: 'UNASSESSED', label: 'Unassessed', description: 'No saved experience-fit rating.' }];
  const fits = fitGroups.map(fit => {
    const tracked = applications.filter(app => fit.value === 'UNASSESSED' ? !validRoleFit(app.role_fit) : app.role_fit === fit.value);
    const sent = tracked.filter(app => rank(app) >= 1);
    const progressed = sent.filter(app => rank(app) >= 2).length;
    const offers = sent.filter(app => rank(app) >= 5).length;
    const rejections = sent.filter(rejected).length;
    return { ...fit, total: tracked.length, submitted: sent.length, progressed, offers, rejections,
      progressionRate: rate(progressed, sent.length), offerRate: rate(offers, sent.length), rejectionRate: rate(rejections, sent.length) };
  });
  const labels = ['Submitted', 'Screening', 'Interview', 'Final interview', 'Acceptance / offer'];
  const funnel = labels.map((label, index) => {
    const phase = ANALYTICS_STAGES[index + 1];
    const reached = submitted.filter(app => rank(app) >= index + 1);
    // A later offer implies progress, but is not evidence of a final interview.
    const recorded = index === 0 ? reached.length : reached.filter(app => recordedStages(app, mapping).includes(phase)).length;
    return { label, phase, count: reached.length, recorded, inferred: reached.length - recorded };
  });
  const preferenceAlignment = ['ALIGNED', 'MIXED', 'MISALIGNED', 'UNKNOWN'].map(value => ({ label: value,
    count: applications.filter(app => (['ALIGNED', 'MIXED', 'MISALIGNED'].includes(app.role_fit_analysis?.preference_alignment || '') ? app.role_fit_analysis?.preference_alignment : 'UNKNOWN') === value).length }));
  const assessed = applications.filter(app => validRoleFit(app.role_fit)).length;
  const today = applicationDay(now.toISOString())!;
  const todayTime = Date.parse(today);
  const dated = submitted.map(app => ({ app, day: applicationDay(app.date_applied) }));
  const validDated = dated.filter((row): row is { app: JobApplication; day: string } => Boolean(row.day && row.day <= today));
  const recent = validDated.filter(row => Date.parse(row.day) >= todayTime - 29 * 86400000).length;
  const [year, month] = today.split('-').map(Number);
  const activity = Array.from({ length: 12 }, (_, index) => {
    const date = new Date(Date.UTC(year, month - 1 - (11 - index), 1));
    const key = date.toISOString().slice(0, 7);
    return { month: key, label: date.toLocaleDateString('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' }), count: validDated.filter(row => row.day.startsWith(key)).length };
  });
  const outcomes = [
    { key: 'NOT_SUBMITTED', label: 'Not submitted', color: '#CBD5E1', count: 0 },
    { key: 'ACTIVE', label: 'Active', color: '#A8CCF0', count: 0 },
    { key: 'OFFER', label: 'Offer / accepted', color: '#A6DCC7', count: 0 },
    { key: 'REJECTED', label: 'Rejected', color: '#F6B4C4', count: 0 },
    { key: 'OTHER_CLOSED', label: 'Other closed', color: '#F3CAA8', count: 0 },
    { key: 'NOT_PROCEEDING', label: 'Not proceeding', color: '#C8BCE8', count: 0 },
  ];
  for (const app of applications) {
    const key = currentOutcome(app, mapping, rejectionStatuses);
    outcomes.find(item => item.key === key)!.count++;
  }
  const uncertainPhases = submitted.filter(app => rank(app) === 1 && app.analytics_stage !== 'SUBMITTED' && ['REJECTED', 'WITHDRAWN'].includes(app.status)).length;
  const quality = {
    duplicateRecords: input.length - applications.length,
    missingDates: dated.filter(row => !row.app.date_applied).length,
    invalidDates: dated.filter(row => row.app.date_applied && !row.day).length,
    futureDates: dated.filter(row => row.day && row.day > today).length,
    datedApplications: validDated.length, uncertainPhases,
    inferredFinalInterviews: funnel[3].inferred,
    smallFitGroups: fits.filter(fit => fit.submitted > 0 && fit.submitted < 5).length,
  };
  const recommendations: string[] = [];
  if (!submitted.length) recommendations.push('Track your first submitted application.');
  else if (!funnel[1].count) recommendations.push('Review targeting and resume relevance while waiting for responses.');
  else if (funnel[2].recorded) recommendations.push('Use recorded interview feedback to prepare your next interview.');
  if (quality.uncertainPhases) recommendations.push(`Review the phase reached for ${quality.uncertainPhases} closed applications.`);
  if (assessed < applications.length) recommendations.push('Assess relevant unassessed roles individually.');
  return { asOf: today, preferenceAlignment, total: applications.length, submitted: submitted.length,
    leads: applications.length - submitted.length, assessed, unassessed: applications.length - assessed,
    coverage: rate(assessed, applications.length), recent, funnel, fits, activity, outcomes, quality, recommendations,
    rejections, rejectionRate: rate(rejections, submitted.length), progressionRate: rate(funnel[1].count, submitted.length), offerRate: rate(funnel[4].count, submitted.length) };
}
export type PipelineStats = ReturnType<typeof pipelineAnalytics>;
