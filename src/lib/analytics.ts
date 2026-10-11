import { reachedStage, AnalyticsStage } from './analytics-stages';
import { JobApplication } from '@/types/job';
import { ROLE_FITS } from './role-fit';

export function isInternship(app: JobApplication) {
  return app.job_type ? app.job_type === 'INTERNSHIP' : /\bintern(?:ship)?\b/i.test(app.role_title);
}
export function isSubmitted(app: JobApplication) {
  if (app.status === 'LEAD') return false;
  if (/^(not accepting interns|repeated)$/i.test(app.notion_status?.trim() || '')) {
    return (app.stage_history || []).some(stage => ['APPLIED', 'SCREENING', 'INTERVIEWING', 'OFFER', 'ACCEPTED'].includes(stage.status));
  }
  return true;
}
export function pipelineAnalytics(applications: JobApplication[], mapping: Record<string, AnalyticsStage> = {}) {
  const rank = (app: JobApplication) => reachedStage(app, mapping);
  const submitted = applications.filter(app => rank(app) >= 1);
  const progressed = (app: JobApplication) => rank(app) >= 2;
  const interviewed = (app: JobApplication) => rank(app) >= 3;
  const finalRound = (app: JobApplication) => rank(app) >= 4;
  const offered = (app: JobApplication) => rank(app) >= 5;
  const rate = (count: number, denominator: number) => denominator ? Math.round(count / denominator * 100) : null;
  const fits = ROLE_FITS.map(fit => {
    const tracked = applications.filter(app => app.role_fit === fit.value);
    const sent = tracked.filter(app => rank(app) >= 1);
    const responses = sent.filter(progressed).length;
    const offers = sent.filter(offered).length;
    return { ...fit, total: tracked.length, submitted: sent.length, progressed: responses, offers, progressionRate: rate(responses, sent.length), offerRate: rate(offers, sent.length) };
  });
  const funnel = [
    { label: 'Submitted', count: submitted.length },
    { label: 'Screening', count: submitted.filter(progressed).length },
    { label: 'Interview', count: submitted.filter(interviewed).length },
    { label: 'Final interview', count: submitted.filter(finalRound).length },
    { label: 'Acceptance / offer', count: submitted.filter(offered).length },
  ];
  const preferenceAlignment = ['ALIGNED', 'MIXED', 'MISALIGNED', 'UNKNOWN'].map(value => ({ label: value, count: applications.filter(app => (app.role_fit_analysis?.preference_alignment || 'UNKNOWN') === value).length }));
  const assessed = applications.filter(app => app.role_fit).length;
  const recent = submitted.filter(app => app.date_applied && new Date(app.date_applied).getTime() >= Date.now() - 30 * 86400000 && new Date(app.date_applied).getTime() <= Date.now()).length;
  const recommendations: string[] = [];
  if (!submitted.length) recommendations.push('Start with roles that match your experience, then track each application and its outcome.');
  else if (!funnel[1].count) recommendations.push('No screening progress is recorded yet. Review targeting and resume relevance; response timing and hiring conditions may also contribute.');
  else if (funnel[2].count) recommendations.push('Your applications have reached interviews. Use interview feedback to prepare specific technical and experience examples.');
  else recommendations.push('Screening progress is recorded. Review your introduction, salary expectations, and transferable skills before the next round.');
  if (assessed < applications.length) recommendations.push(`Assess the ${applications.length - assessed} unrated roles before comparing fit-based conversion.`);
  if (fits.some(fit => fit.submitted > 0 && fit.submitted < 5)) recommendations.push('Fit groups have small samples. Treat their conversion rates as observations, not predictions.');
  return { preferenceAlignment, total: applications.length, submitted: submitted.length, leads: applications.length - submitted.length, assessed, unassessed: applications.length - assessed, coverage: rate(assessed, applications.length), recent, funnel, fits, recommendations, progressionRate: rate(funnel[1].count, submitted.length), offerRate: rate(funnel[4].count, submitted.length) };
}
