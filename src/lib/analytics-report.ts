import type { JobApplication } from '@/types/job';
import { applicationDay, currentOutcome, isInternship, uniqueApplications, type PipelineStats } from './analytics';
import { reachedStage, DEFAULT_REJECTION_STATUSES, type AnalyticsStage } from './analytics-stages';
import { savedRoleFit } from './role-fit';

export const REPORT_OUTCOMES = [
  { key: 'ACTIVE', label: 'Active', color: '#A8CCF0' },
  { key: 'OFFER', label: 'Offer / accepted', color: '#A6DCC7' },
  { key: 'REJECTED', label: 'Rejected', color: '#F6B4C4' },
  { key: 'CLOSED', label: 'Other closed', color: '#C8BCE8' },
] as const;
export function analyticsReportData(applications: JobApplication[], stats: PipelineStats,
  mapping: Record<string, AnalyticsStage> = {}, rejectionStatuses: readonly string[] = DEFAULT_REJECTION_STATUSES) {
  const fits = stats.fits.filter(fit => fit.submitted > 0).map(fit => ({
    label: fit.label, value: fit.value, submitted: fit.submitted,
    outcomes: REPORT_OUTCOMES.map(outcome => ({ ...outcome, count: 0 })),
  }));
  const callbackBins = [
    { label: '0–7 days', min: 0, max: 7, count: 0 }, { label: '8–14 days', min: 8, max: 14, count: 0 },
    { label: '15–30 days', min: 15, max: 30, count: 0 }, { label: '31+ days', min: 31, max: null, count: 0 },
  ];
  const cohorts = new Map<string, { month: string; submitted: number; responses: number; counts: number[] }>();
  const types = [
    { label: 'Internships', submitted: 0, progressed: 0, offers: 0 },
    { label: 'Non-internships', submitted: 0, progressed: 0, offers: 0 },
  ];
  for (const app of uniqueApplications(applications)) {
    const rank = reachedStage(app, mapping);
    if (rank < 1) continue;
    const type = types[isInternship(app) ? 0 : 1];
    type.submitted++; if (rank >= 2) type.progressed++; if (rank >= 5) type.offers++;
    const fit = fits.find(row => row.value === (savedRoleFit(app) || 'UNASSESSED'));
    const outcome = currentOutcome(app, mapping, rejectionStatuses);
    if (fit) fit.outcomes.find(row => row.key === (['ACTIVE', 'OFFER', 'REJECTED'].includes(outcome) ? outcome : 'CLOSED'))!.count++;
    const sent = applicationDay(app.date_applied), response = applicationDay(app.first_response_at || undefined);
    if (!sent || sent > stats.asOf) continue;
    const month = sent.slice(0, 7);
    if (!cohorts.has(month)) cohorts.set(month, { month, submitted: 0, responses: 0, counts: [0, 0, 0, 0] });
    const cohort = cohorts.get(month)!; cohort.submitted++;
    if (!response || response < sent || response > stats.asOf) continue;
    const latency = (Date.parse(response) - Date.parse(sent)) / 86400000;
    const index = callbackBins.findIndex(bin => bin.max === null || latency <= bin.max);
    callbackBins[index].count++; cohort.counts[index]++; cohort.responses++;
  }
  const rates = <T extends { submitted: number; progressed: number; offers: number }>(row: T) => ({ ...row,
    progressionRate: row.submitted ? Math.round(row.progressed / row.submitted * 100) : null,
    offerRate: row.submitted ? Math.round(row.offers / row.submitted * 100) : null,
  });
  const keywords = stats.dimensions.keywords;
  const platforms = stats.dimensions.platforms.filter(row => row.submitted > 0).sort((a, b) => b.submitted - a.submitted || a.label.localeCompare(b.label));
  const seniority = stats.dimensions.seniority.filter(row => row.submitted > 0).sort((a, b) => b.submitted - a.submitted || a.label.localeCompare(b.label));
  const responseCount = callbackBins.reduce((sum, bin) => sum + bin.count, 0);
  const responseCohorts = [...cohorts.values()].sort((a, b) => a.month.localeCompare(b.month));
  const heatmapReady = responseCount >= 5 && responseCohorts.filter(row => row.responses > 0).length >= 2;
  const combinedTypes = types.every(row => row.submitted > 0);
  const topKeyword = keywords[0];
  const findings = [
    { title: 'Observed', text: topKeyword ? `${topKeyword.label} appears in ${topKeyword.submitted} of ${stats.submitted} submitted job titles. ${topKeyword.progressed} of those applications reached screening or later.` : stats.submitted ? 'No usable job-title keywords in this scope yet.' : 'No submitted applications in this scope yet.' },
    { title: 'Limits', text: combinedTypes ? 'Internship and non-internship records span different hiring contexts and observation periods. Compare their scopes separately.' : `${responseCount} of ${stats.submitted} submitted applications have usable response dates. Small groups and missing dates limit comparisons.` },
    { title: 'Suggested next step', text: stats.quality.missingDates ? `Complete ${stats.quality.missingDates} missing submission dates before comparing activity and waiting time.` : stats.timing.unknownResponseTiming ? 'Record actual first employer response dates when known; keep unavailable dates blank.' : stats.recommendations[0] || 'Review relevant application records before changing your targeting.' },
  ];
  return { keywords, platforms, seniority, fits, callbackBins, responseCohorts, responseCount, heatmapReady, types: types.filter(row => row.submitted).map(rates), findings };
}
export type AnalyticsReportData = ReturnType<typeof analyticsReportData>;
