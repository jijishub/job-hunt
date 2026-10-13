import type { JobApplication } from '@/types/job';
import { reachedStage, type AnalyticsStage } from './analytics-stages';
import { savedRoleFit } from './role-fit';
import { effectiveSeniority, SENIORITY_LEVELS } from './application-analytics-fields';
import { jobTitleKeywords, KEYWORD_MIN_APPLICATIONS } from './job-title-keywords';

export function firstRecordedResponse(app: JobApplication) {
  // History timestamps record database writes, not employer events.
  return app.first_response_at && Number.isFinite(Date.parse(app.first_response_at)) ? app.first_response_at : undefined;
}
export function dimensionAnalytics(apps: JobApplication[], mapping: Record<string, AnalyticsStage>,
  day: (value?: string) => string | null, asOf: string) {
  const rate = (n: number, d: number) => d ? Math.round(n / d * 100) : null;
  type Group = { label: string; total: number; submitted: number; progressed: number; offers: number; responses: number; latencyDays: number[] };
  const keywords = new Map<string, Group>(), levels = new Map<string, Group>(), platforms = new Map<string, Group>(), cohorts = new Map<string, Group>(), alignment = new Map<string, Group>();
  const keywordLabels = new Map<string, string>();
  const group = (map: Map<string, Group>, label: string) => {
    if (!map.has(label)) map.set(label, { label, total: 0, submitted: 0, progressed: 0, offers: 0, responses: 0, latencyDays: [] });
    return map.get(label)!;
  };
  let missingResponseDates = 0;
  for (const app of apps) {
    const rank = reachedStage(app, mapping), submitted = rank >= 1;
    const sent = day(app.date_applied), response = day(firstRecordedResponse(app));
    const validSent = sent && sent <= asOf ? sent : null;
    const validResponse = response && response <= asOf && (!validSent || response >= validSent);
    const latency = validSent && response && response >= validSent && response <= asOf ? (Date.parse(response) - Date.parse(validSent)) / 86400000 : null;
    if (submitted && latency === null) missingResponseDates++;
    const savedFit = savedRoleFit(app);
    const groups = [group(levels, SENIORITY_LEVELS.find(item => item.value === effectiveSeniority(app))!.label),
      group(platforms, app.job_platform?.trim().toUpperCase() || app.source?.trim().toUpperCase() || 'UNKNOWN'),
      group(alignment, savedFit && ['STRONG', 'POSSIBLE', 'WEAK'].includes(savedFit) ? savedFit : 'UNASSESSED')];
    if (submitted) groups.push(group(cohorts, validSent?.slice(0, 7) || 'Unknown'));
    if (submitted) for (const keyword of jobTitleKeywords(app.role_title)) {
      const item = group(keywords, keyword.key);
      const previousLabel = keywordLabels.get(keyword.key);
      if (!previousLabel || keyword.label < previousLabel) keywordLabels.set(keyword.key, keyword.label);
      groups.push(item);
    }
    for (const item of groups) {
      item.total++; if (submitted) item.submitted++; if (rank >= 2) item.progressed++; if (rank >= 5) item.offers++;
      if (submitted && validResponse) item.responses++;
      if (submitted && latency !== null) item.latencyDays.push(latency);
    }
  }
  const finish = (map: Map<string, Group>) => [...map.values()].sort((a, b) => a.label.localeCompare(b.label)).map(({ latencyDays, ...item }) => {
    latencyDays.sort((a, b) => a - b); const middle = Math.floor(latencyDays.length / 2);
    return { ...item, progressionRate: rate(item.progressed, item.submitted), offerRate: rate(item.offers, item.submitted),
      responseRate: rate(item.responses, item.submitted), medianCallbackDays: latencyDays.length ? (latencyDays[middle] + latencyDays[Math.floor((latencyDays.length - 1) / 2)]) / 2 : null };
  });
  const keywordRows = finish(keywords).map(row => ({ ...row, key: row.label, label: keywordLabels.get(row.label)!,
    progressionRate: row.submitted >= KEYWORD_MIN_APPLICATIONS ? row.progressionRate : null,
    offerRate: row.submitted >= KEYWORD_MIN_APPLICATIONS ? row.offerRate : null,
  })).sort((a, b) => b.submitted - a.submitted || a.key.split(' ').length - b.key.split(' ').length || a.key.localeCompare(b.key));
  return { keywords: keywordRows, seniority: finish(levels), platforms: finish(platforms), cohorts: finish(cohorts), qualifications: finish(alignment), missingResponseDates };
}
