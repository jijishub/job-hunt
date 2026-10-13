import type { JobApplication } from '@/types/job';
import { reachedStage, stageForStatus, type AnalyticsStage } from './analytics-stages';
import { firstRecordedResponse } from './analytics-dimensions';

export const DEFAULT_AGE_BOUNDARIES = [7, 14, 30] as const;
export function validAgeBoundaries(value: unknown): value is number[] {
  return Array.isArray(value) && value.length === 3 && value.every((n, i) => Number.isInteger(n) && n > 0 && n <= 3650 && (!i || n > value[i - 1]));
}
type Day = (value?: string) => string | null;
export function applicationAgeDays(app: JobApplication, day: Day, asOf: string) {
  const submitted = day(app.date_applied);
  return submitted && submitted <= asOf ? (Date.parse(asOf) - Date.parse(submitted)) / 86400000 : null;
}
export function awaitingEmployerResponse(app: JobApplication, mapping: Record<string, AnalyticsStage>, active: boolean) {
  return active && reachedStage(app, mapping) === 1 && !app.first_response_at
    && stageForStatus(app.notion_status || app.status, app.status, mapping) === 'SUBMITTED'
    && !['LEAD', 'SCREENING', 'INTERVIEWING', 'OFFER', 'ACCEPTED', 'REJECTED', 'WITHDRAWN'].includes(app.status);
}
export function timingAnalytics(apps: JobApplication[], mapping: Record<string, AnalyticsStage>, day: Day, asOf: string,
  isActive: (app: JobApplication) => boolean, boundaries: readonly number[] = DEFAULT_AGE_BOUNDARIES) {
  const limits = validAgeBoundaries(boundaries) ? boundaries : DEFAULT_AGE_BOUNDARIES;
  const buckets = [...limits, null].map((max, i) => ({ min: i ? limits[i - 1] + 1 : 0, max,
    label: max === null ? `${limits[limits.length - 1] + 1}+ days` : `${i ? limits[i - 1] + 1 : 0}–${max} days`, all: 0, pending: 0 }));
  const windows = [7, 14, 30].map(days => ({ days, mature: 0, eligible: 0, responded: 0, unknownTiming: 0, immature: 0 }));
  const callbackDays: number[] = [];
  let submitted = 0, pending = 0, unknownAges = 0, pendingUnknownAges = 0, missingSubmissionDates = 0, invalidSubmissionDates = 0, futureSubmissionDates = 0, unknownResponseTiming = 0;
  for (const app of apps) {
    const rank = reachedStage(app, mapping);
    if (rank < 1) continue;
    submitted++;
    const age = applicationAgeDays(app, day, asOf), sent = day(app.date_applied);
    const awaiting = awaitingEmployerResponse(app, mapping, isActive(app));
    if (awaiting) pending++;
    if (age === null) {
      unknownAges++; if (awaiting) pendingUnknownAges++;
      if (!app.date_applied) missingSubmissionDates++;
      else if (!sent) invalidSubmissionDates++;
      else futureSubmissionDates++;
    } else {
      const bucket = buckets.find(item => item.max === null || age <= item.max)!;
      bucket.all++; if (awaiting) bucket.pending++;
    }
    const response = day(firstRecordedResponse(app));
    const latency = sent && age !== null && response && response >= sent && response <= asOf ? (Date.parse(response) - Date.parse(sent)) / 86400000 : null;
    if (latency !== null) callbackDays.push(latency);
    const unknownTiming = latency === null && !awaiting;
    if (unknownTiming) unknownResponseTiming++;
    for (const window of windows) {
      if (age === null) continue;
      if (age < window.days) { window.immature++; continue; }
      window.mature++;
      if (unknownTiming) { window.unknownTiming++; continue; }
      window.eligible++;
      if (latency !== null && latency <= window.days) window.responded++;
    }
  }
  callbackDays.sort((a, b) => a - b);
  const median = callbackDays.length ? (callbackDays[Math.floor(callbackDays.length / 2)] + callbackDays[Math.floor((callbackDays.length - 1) / 2)]) / 2 : null;
  const average = callbackDays.length ? Math.round(callbackDays.reduce((sum, n) => sum + n, 0) / callbackDays.length * 10) / 10 : null;
  return { boundaries: [...limits], buckets, submitted, pending, unknownAges, pendingUnknownAges, missingSubmissionDates, invalidSubmissionDates, futureSubmissionDates, unknownResponseTiming,
    callbacks: { count: callbackDays.length, averageDays: average, medianDays: median },
    windows: windows.map(window => ({ ...window, responseRate: window.eligible ? Math.round(window.responded / window.eligible * 100) : null })) };
}
