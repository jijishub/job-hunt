import type { JobApplication } from '@/types/job';
import { pipelineAnalytics, type PipelineStats } from './analytics';
import { analyticsReportData } from './analytics-report';
import { DEFAULT_REJECTION_STATUSES, type AnalyticsStage } from './analytics-stages';
import type { PersonalPreferences } from './preferences';
import { formatSalaryRange } from './currencies';
import { offerPeriodLabel } from './salary-offers';
import { loadAnalyticsLogo, analyticsLogoSize } from './analytics-branding';

type ReportTargets = Pick<PersonalPreferences, 'target_companies' | 'target_roles' | 'preferred_locations' | 'work_models' | 'job_types' | 'salary_min' | 'salary_currency' | 'dealbreakers' | 'analytics_age_boundaries'>;

export async function analyticsPdf(applications: JobApplication[], accountName: string, scope: string,
  mapping: Record<string, AnalyticsStage> = {},
  rejectionStatuses: readonly string[] = DEFAULT_REJECTION_STATUSES, targets?: ReportTargets, snapshot?: PipelineStats) {
  const { default: jsPDF } = await import('jspdf');
  const logo = await loadAnalyticsLogo();
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  const stats = snapshot || pipelineAnalytics(applications, mapping, rejectionStatuses, new Date(), targets?.analytics_age_boundaries);
  const report = analyticsReportData(applications, stats, mapping, rejectionStatuses);
  const colors = { rose: '#9D3C5E', ink: '#37343C', muted: '#736A6D', border: '#EAE4E9', pink: '#FFF0F6', recorded: '#E99ABA', inferred: '#C8BCE8', progression: '#A8CCF0', offer: '#A6DCC7', track: '#F3F1F5' };
  const clean = (value: string) => value.replace(/[–—−]/g, '-').replace(/[’‘]/g, "'").replace(/[“”]/g, '"').normalize('NFKD').replace(/[^\x20-\x7E\n]/g, '');
  const percent = (value: number | null) => value === null ? 'N/A' : `${value}%`;
  const count = (value: number) => value.toLocaleString('en-US');
  const applicationsLabel = (value: number) => `${count(value)} ${value === 1 ? 'application' : 'applications'}`;
  const label = (value: string, x: number, y: number, size = 9, color = colors.ink, bold = false, align: 'left' | 'right' | 'center' = 'left') => {
    size = Math.max(7.5, size);
    pdf.setFont('helvetica', bold ? 'bold' : 'normal'); pdf.setFontSize(size); pdf.setTextColor(color); pdf.text(clean(value), x, y, { align });
  };
  const lines = (value: string, width: number, size = 8): string[] => {
    size = Math.max(7.5, size);
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(size); return pdf.splitTextToSize(clean(value), width);
  };
  const wrap = (value: string, x: number, y: number, width: number, size = 8, maxLines = 3, color = colors.muted) => {
    size = Math.max(7.5, size);
    const all = lines(value, width, size), shown = all.slice(0, maxLines);
    if (all.length > maxLines) {
      let last = shown[maxLines - 1];
      while (pdf.getTextWidth(`${last}...`) > width) last = last.slice(0, -1);
      shown[maxLines - 1] = `${last}...`;
    }
    shown.forEach((line, i) => label(line, x, y + i * size * 0.43, size, color));
  };
  const panel = (x: number, y: number, width: number, height: number, fill = '#FFFFFF') => {
    pdf.setFillColor(fill); pdf.setDrawColor(colors.border); pdf.setLineWidth(0.2); pdf.roundedRect(x, y, width, height, 3, 3, 'FD');
  };
  const bar = (x: number, y: number, width: number, height: number, fraction: number, color: string) => {
    pdf.setFillColor(colors.track); pdf.rect(x, y, width, height, 'F');
    if (fraction > 0) { pdf.setFillColor(color); pdf.rect(x, y, width * Math.min(1, fraction), height, 'F'); }
  };
  const key = (name: string, x: number, y: number, color: string) => {
    pdf.setFillColor(color); pdf.rect(x, y - 2, 2.4, 2.4, 'F'); label(name, x + 4, y, 7, colors.muted);
  };
  const header = () => {
    pdf.addImage(logo, 'PNG', 16, 5, analyticsLogoSize.width, analyticsLogoSize.height, 'job-hunt-logo', 'FAST');
    const baseline = 17;
    label('PERSONAL ANALYTICS', 65, baseline, 8, colors.muted);
    wrap(scope, 110, baseline, 50, 8, 1);
    label(`As of ${stats.asOf}`, 194, baseline, 8, colors.muted, false, 'right');
    pdf.setDrawColor(colors.border); pdf.line(16, 30, 194, 30);
  };
  const title = (heading: string, subtitle: string) => { label(heading, 16, 43, 19, colors.ink, true); wrap(subtitle, 16, 51, 178, 9, 1); };
  const page = (heading: string, subtitle: string) => { pdf.addPage(); header(); title(heading, subtitle); };
  const metric = (x: number, y: number, width: number, name: string, value: string, detail: string, highlight = false) => {
    panel(x, y, width, 28, highlight ? colors.pink : '#FFFFFF'); label(name, x + 3, y + 6, 8, colors.muted);
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(17);
    const size = Math.min(17, 17 * (width - 6) / Math.max(width - 6, pdf.getTextWidth(clean(value))));
    label(value, x + 3, y + 17, size, colors.rose, true); wrap(detail, x + 3, y + 23, width - 6, 6.8, 1);
  };
  pdf.setProperties({ title: 'Job search analytics', subject: 'Pipeline, effectiveness, timing and career insights', author: accountName });

  header(); title('Application pipeline', accountName);
  const metrics = [
    ['Tracked', count(stats.total), `${count(stats.leads)} not submitted`],
    ['Submitted', count(stats.submitted), `${count(stats.recent)} in 30 days`],
    ['Progression', percent(stats.progressionRate), `${stats.funnel[1].count} / ${stats.submitted} submitted`],
    ['Offer stage', count(stats.funnel[4].count), `${percent(stats.offerRate)} of submitted`],
    ['Rejections', count(stats.rejections), `${percent(stats.rejectionRate)} of submitted`],
  ];
  metrics.forEach(([name, value, detail], i) => metric(16 + i * 36.4, 60, 32.4, name, value, detail, i === 0));
  label('Reached or passed', 16, 104, 12, colors.ink, true);
  key('Recorded', 121, 104, colors.recorded); key('Inferred', 158, 104, colors.inferred);
  stats.funnel.forEach((stage, i) => {
    const y = 117 + i * 16;
    label(stage.label, 16, y, 9); label(`${stage.count} / ${stats.submitted}`, 194, y, 8, colors.muted, false, 'right');
    bar(16, y + 3, 178, 5, stats.submitted ? stage.recorded / stats.submitted : 0, colors.recorded);
    if (stats.submitted && stage.inferred) { pdf.setFillColor(colors.inferred); pdf.rect(16 + 178 * stage.recorded / stats.submitted, y + 3, 178 * stage.inferred / stats.submitted, 5, 'F'); }
  });
  label(`${stats.funnel[4].recorded} recorded offer-stage phases; ${stats.funnel[4].inferred} inferred. ${stats.salaryOffers.count} recorded salary offers.`, 16, 198, 7.5, colors.muted);
  label('Monthly application submissions', 16, 213, 12, colors.ink, true); label('Last 12 months', 194, 213, 8, colors.muted, false, 'right');
  const activityMax = Math.max(1, ...stats.activity.map(item => item.count));
  pdf.setDrawColor(colors.border); pdf.line(16, 253, 194, 253);
  stats.activity.forEach((item, i) => {
    const x = 19 + i * 14.6, height = 29 * item.count / activityMax;
    if (height) { pdf.setFillColor(colors.progression); pdf.rect(x, 253 - height, 9, height, 'F'); }
    label(count(item.count), x + 4.5, 250 - height, 7, colors.ink, false, 'center'); label(item.label, x + 4.5, 260, 6.5, colors.muted, false, 'center');
  });
  wrap(`Dates excluded: ${stats.quality.missingDates} missing, ${stats.quality.invalidDates} invalid, ${stats.quality.futureDates} future. Inferred phases indicate later progress, not recorded interviews.`, 16, 270, 178, 7.5, 2);

  page('Application effectiveness', 'Application effectiveness comparisons · submitted applications only');
  panel(16, 59, 178, 100); label('Role families: volume and conversion', 21, 68, 11, colors.ink, true);
  key('Progression', 124, 68, colors.progression); key('Offer stage', 162, 68, colors.offer);
  const roles = report.roles.slice(0, 6), roleMax = Math.max(1, ...roles.map(row => row.submitted));
  label('Submitted', 96, 78, 7, colors.muted, false, 'center'); label('0%                          100%', 133, 78, 7, colors.muted);
  if (!roles.length) wrap('Submit an application to start comparing role families.', 21, 90, 168, 9);
  roles.forEach((row, i) => {
    const y = 88 + i * 10.5;
    wrap(row.label, 21, y, 49, 8, 2, colors.ink); label(String(row.submitted), 76, y + 1, 8, colors.muted, false, 'right');
    bar(80, y - 2, 37, 5, row.submitted / roleMax, colors.recorded);
    bar(128, y - 3, 40, 2.7, (row.progressionRate ?? 0) / 100, colors.progression);
    bar(128, y + 1, 40, 2.7, (row.offerRate ?? 0) / 100, colors.offer);
    label(`${row.progressionRate}% / ${row.offerRate}%`, 189, y + 1, 6.6, colors.muted, false, 'right');
  });
  wrap(`Top ${roles.length} of ${report.roles.length} families by submissions. Related automatic titles are grouped; manual families stay intact. Smaller groups are based on limited application data.`, 21, 152, 168, 7.5, 2);
  panel(16, 166, 87, 99); panel(107, 166, 87, 99);
  label('Role fit and outcomes', 21, 175, 11, colors.ink, true); label('Current outcome of submitted roles', 21, 182, 7, colors.muted);
  report.fits.forEach((fit, i) => {
    const y = 193 + i * 13;
    label(fit.label, 21, y, 8); label(applicationsLabel(fit.submitted), 98, y, 7.5, colors.muted, false, 'right');
    let x = 21;
    fit.outcomes.forEach(outcome => { const width = 77 * outcome.count / fit.submitted; if (width) { pdf.setFillColor(outcome.color); pdf.rect(x, y + 2, width, 5, 'F'); x += width; } });
  });
  if (!report.fits.length) wrap('No submitted applications to compare yet.', 21, 195, 77, 9);
  const outcomeKeys = report.fits[0]?.outcomes || [];
  outcomeKeys.forEach((item, i) => key(item.label, 21 + i % 2 * 38, 250 + Math.floor(i / 2) * 7, item.color));
  label('Platform effectiveness', 112, 175, 11, colors.ink, true);
  key('Progression', 112, 183, colors.progression); key('Offer stage', 153, 183, colors.offer);
  const platforms = report.platforms.slice(0, 6);
  platforms.forEach((row, i) => {
    const y = 193 + i * 10;
    wrap(row.label.replaceAll('_', ' '), 112, y, 42, 8, 1, colors.ink); label(applicationsLabel(row.submitted), 189, y, 7.5, colors.muted, false, 'right');
    bar(112, y + 2, 58, 1.8, (row.progressionRate ?? 0) / 100, colors.progression);
    bar(112, y + 4.5, 58, 1.8, (row.offerRate ?? 0) / 100, colors.offer);
    label(`${row.progressionRate}% / ${row.offerRate}%`, 189, y + 5.5, 6, colors.muted, false, 'right');
  });
  if (!platforms.length) wrap('No submitted applications to compare yet.', 112, 195, 77, 9);
  wrap(`Top ${platforms.length} of ${report.platforms.length} platforms. Percentages use each platform's submitted applications.`, 112, 253, 77, 7.5, 2);
  wrap(`Assessed: ${stats.assessed} · Unassessed: ${stats.unassessed}. Fit is saved experience alignment; outcomes are not evidence of causation. Full comparisons remain in Analytics.`, 16, 273, 178, 7, 2);

  page('Application timing', 'Waiting time and employer response latency answer different questions.');
  metric(16, 60, 55, 'Median callback', stats.timing.callbacks.medianDays === null ? 'N/A' : `${stats.timing.callbacks.medianDays} days`, `${report.responseCount} usable responses`);
  metric(77.5, 60, 55, 'Average callback', stats.timing.callbacks.averageDays === null ? 'N/A' : `${stats.timing.callbacks.averageDays} days`, 'Recorded employer events only');
  metric(139, 60, 55, 'Unanswered', count(stats.timing.pending), `${stats.timing.pendingUnknownAges} unknown ages`, true);
  stats.timing.windows.forEach((window, i) => metric(16 + i * 61.5, 95, 55, `Response within ${window.days} days`, percent(window.responseRate), `${window.responded} / ${window.eligible} eligible`));
  panel(16, 130, 87, 66); panel(107, 130, 87, 66);
  label('Unanswered application aging', 21, 139, 10, colors.ink, true);
  stats.timing.buckets.forEach((bucket, i) => {
    const y = 149 + i * 10;
    label(bucket.label, 21, y, 8); label(count(bucket.pending), 98, y, 8, colors.ink, true, 'right');
    bar(21, y + 2, 77, 3.5, stats.timing.pending ? bucket.pending / stats.timing.pending : 0, colors.progression);
  });
  label('Recorded callback distribution', 112, 139, 10, colors.ink, true);
  if (report.responseCount > 1) {
    const max = Math.max(1, ...report.callbackBins.map(bin => bin.count));
    report.callbackBins.forEach((bin, i) => {
      const height = 32 * bin.count / max, x = 116 + i * 17.5;
      if (height) { pdf.setFillColor(colors.recorded); pdf.rect(x, 184 - height, 10, height, 'F'); }
      label(String(bin.count), x + 5, 182 - height, 7, colors.ink, false, 'center'); label(bin.label.replace(' days', ''), x + 5, 190, 7, colors.muted, false, 'center');
    });
  } else wrap(report.responseCount ? 'One usable response. The callback KPIs show its latency; a distribution needs more observations.' : 'No usable response dates yet. Record actual first employer responses to unlock callback and cohort charts.', 112, 153, 77, 9, 5);
  panel(16, 203, 178, 58); label(report.heatmapReady ? 'Response cohorts' : 'Response window coverage', 21, 212, 11, colors.ink, true);
  if (report.heatmapReady) {
    const rows = report.responseCohorts.filter(row => row.responses).slice(-5), max = Math.max(1, ...rows.flatMap(row => row.counts));
    report.callbackBins.forEach((bin, i) => label(bin.label, 84 + i * 25, 222, 7, colors.muted, false, 'center'));
    rows.forEach((row, i) => {
      const y = 227 + i * 5.4; label(`${row.month} · ${row.responses} responses`, 21, y + 3.8, 7.5, colors.muted);
      row.counts.forEach((value, j) => {
        const intensity = value / max;
        pdf.setFillColor(255 - Math.round(22 * intensity), 240 - Math.round(86 * intensity), 246 - Math.round(60 * intensity));
        pdf.rect(72 + j * 25, y, 24, 5, 'F'); label(String(value), 84 + j * 25, y + 3.8, 7, colors.ink, false, 'center');
      });
    });
    label('Latest 5 responding months · cell = recorded response count, not conversion rate.', 21, 258, 7, colors.muted);
  } else {
    const datedCount = stats.timing.windows[0].eligible + stats.timing.windows[0].immature + stats.timing.windows[0].unknownTiming;
    label(`${datedCount} dated applications`, 189, 212, 8, colors.muted, false, 'right');
    key('Eligible', 21, 221, colors.progression); key('Too recent', 69, 221, colors.recorded); key('Timing unknown', 123, 221, colors.inferred);
    stats.timing.windows.forEach((window, i) => {
      const y = 231 + i * 7, total = window.eligible + window.immature + window.unknownTiming;
      label(`${window.days} days`, 21, y, 8); let x = 43;
      for (const [value, color] of [[window.eligible, colors.progression], [window.immature, colors.recorded], [window.unknownTiming, colors.inferred]] as const) {
        const width = total ? value / total * 127 : 0;
        if (width) { pdf.setFillColor(color); pdf.rect(x, y - 3, width, 4, 'F'); if (width > 6) label(String(value), x + width / 2, y, 7, colors.ink, false, 'center'); x += width; }
      }
    });
    label('Cohort heatmap: requires 5 usable responses across 2 submission months.', 21, 258, 7, colors.muted);
  }
  const exclusions = stats.timing.windows.map(window => `${window.days}d: ${window.immature} recent / ${window.unknownTiming} unknown`).join('; ');
  wrap(`Window exclusions (${exclusions}). Each rate uses only mature, eligible records. Age groups follow your preferences. Save/status timestamps do not establish responses or interviews.`, 16, 270, 178, 7.3, 2);

  page('Career insights', 'Observed results, limitations and suggested next steps');
  panel(16, 59, 87, 70); panel(107, 59, 87, 70); label('Preference alignment', 21, 68, 11, colors.ink, true);
  const knownAlignment = stats.preferenceAlignment.filter(item => item.label !== 'UNKNOWN').reduce((sum, item) => sum + item.count, 0);
  if (knownAlignment > 0) {
    let angle = -Math.PI / 2;
    stats.preferenceAlignment.forEach((item, index) => {
      if (!item.count) return;
      const sweep = item.count / stats.total * Math.PI * 2, pieces = Math.max(2, Math.ceil(sweep * 12));
      const points = Array.from({ length: pieces + 1 }, (_, i) => [43 + 19 * Math.cos(angle + sweep * i / pieces), 99 + 19 * Math.sin(angle + sweep * i / pieces)]);
      pdf.setFillColor(['#A6DCC7', '#F4D6A4', '#F6B4C4', '#C8BCE8'][index]);
      const segments = points.map((point, i) => [point[0] - (i ? points[i - 1][0] : 43), point[1] - (i ? points[i - 1][1] : 99)]);
      pdf.lines(segments, 43, 99, [1, 1], 'F', true); angle += sweep;
    });
    pdf.setFillColor('#FFFFFF'); pdf.circle(43, 99, 12.5, 'F'); label(String(stats.total), 43, 98, 13, colors.rose, true, 'center'); label('tracked', 43, 104, 7, colors.muted, false, 'center');
    stats.preferenceAlignment.forEach((item, i) => { key(item.label.charAt(0) + item.label.slice(1).toLowerCase(), 69, 87 + i * 9, ['#A6DCC7', '#F4D6A4', '#F6B4C4', '#C8BCE8'][i]); label(String(item.count), 98, 91 + i * 9, 7, colors.muted, false, 'right'); });
  } else wrap(`No saved preference comparisons yet. ${stats.total} tracked roles remain Unknown; analytics stays available without an assessment.`, 21, 83, 77, 9, 5);
  label('Seniority progression', 112, 68, 11, colors.ink, true);
  report.seniority.forEach((row, i) => {
    const y = 78 + i * 5.6;
    wrap(row.label, 112, y, 34, 8, 1, colors.ink); bar(148, y - 2, 18, 2.6, (row.progressionRate ?? 0) / 100, colors.progression);
    label(`${row.progressed}/${row.submitted} · ${row.progressionRate}%`, 189, y, 7.5, colors.muted, false, 'right');
  });
  if (!report.seniority.length) wrap('No submitted applications to compare yet.', 112, 84, 77, 9);
  label('Explicit title levels; unlabeled roles stay Unspecified.', 112, 124, 6.6, colors.muted);

  const salaryGroups = [...stats.salaryOffers.groups].sort((a, b) => b.count - a.count || a.key.localeCompare(b.key)), extraSalaryGroups = salaryGroups.slice(2);
  panel(16, 136, 178, 58); label('Recorded salary offers / Salary expectations', 21, 145, 11, colors.ink, true);
  const salaryRow = (group: typeof salaryGroups[number], y: number) => {
    const expected = stats.salaryOffers.expectations.find(item => item.key === group.key);
    const target = group.period === 'MONTHLY' && targets?.salary_currency?.toUpperCase() === group.currency ? targets.salary_min : undefined;
    wrap(`${group.currency} / ${offerPeriodLabel(group.period)} · ${group.count} ${group.count === 1 ? 'offer' : 'offers'}`, 21, y, 57, 8, 1, colors.ink);
    label(`Median ${formatSalaryRange(group.median, undefined, group.currency)}`, 189, y, 8, colors.rose, true, 'right');
    const max = Math.max(1, group.max, expected?.median || 0, target || 0) * 1.1;
    if (group.count >= 2 || expected || target !== undefined) {
      bar(80, y + 3, 109, 3.4, group.median / max, colors.offer);
      if (expected) { pdf.setFillColor(colors.rose); pdf.circle(80 + 109 * expected.median / max, y + 4.7, 1.2, 'F'); }
      if (target !== undefined) { pdf.setDrawColor(colors.rose); pdf.setLineWidth(0.4); pdf.line(80 + 109 * target / max, y + 1.5, 80 + 109 * target / max, y + 8); }
    }
    const comparison = expected?.matched ? `${expected.met} of ${expected.matched} matching offers meet expectations; median gap ${expected.medianGap === null ? 'N/A' : `${expected.medianGap < 0 ? '-' : expected.medianGap > 0 ? '+' : ''}${formatSalaryRange(Math.abs(expected.medianGap), undefined, group.currency)}`}.` : 'No matching salary expectation/offer pairs recorded.';
    const reference = [expected ? `Expected median ${formatSalaryRange(expected.median, undefined, group.currency)}` : '', target !== undefined ? `Monthly minimum ${formatSalaryRange(target, undefined, group.currency)}` : ''].filter(Boolean).join(' · ');
    if (reference) wrap(reference, 21, y + 9, 168, 7, 1);
    wrap(comparison, 21, y + 13, 168, 7, 1);
  };
  salaryGroups.slice(0, 2).forEach((group, i) => salaryRow(group, 154 + i * 18));
  if (!salaryGroups.length) {
    wrap(stats.salaryOffers.expectedCount ? `${stats.salaryOffers.expectedCount} salary expectations saved; no actual offers recorded yet.` : 'No actual salary offers or expectations recorded yet.', 21, 156, 168, 9, 2);
    stats.salaryOffers.expectations.slice(0, 2).forEach((group, i) => label(`${group.currency} / ${offerPeriodLabel(group.period)}: median expected ${formatSalaryRange(group.median, undefined, group.currency)}${stats.salaryOffers.expectations.length > 1 ? ` · ${group.count} expectations` : ''}`, 21, 169 + i * 7, 8, colors.rose));
  } else label(`Green = median offer; dot = median expectation; line = monthly minimum${extraSalaryGroups.length ? `; ${extraSalaryGroups.length} more groups in appendix` : ''}.`, 21, 190, 6.8, colors.muted);
  report.findings.forEach((finding, i) => {
    const x = 16 + i * 61.5; panel(x, 201, 55, 36, colors.pink); label(finding.title, x + 3, 208, 9, colors.rose, true); wrap(finding.text, x + 3, 214, 49, 7.8, 6);
  });
  const human = (values?: string[]) => values?.length ? values.map(value => value.replaceAll('_', ' ').toLowerCase()).join(', ') : 'Not set';
  const targetText = targets ? `Targets: ${targets.target_roles?.join(', ') || 'Not set'}; companies: ${targets.target_companies?.join(', ') || 'Not set'}; locations: ${targets.preferred_locations?.join(', ') || 'Not set'}; work: ${human(targets.work_models)}; types: ${human(targets.job_types)}; minimum monthly pay: ${formatSalaryRange(targets.salary_min, undefined, targets.salary_currency) || 'Not set'}; priorities: ${targets.dealbreakers?.trim() || 'Not set'}.` : 'Preference targets: Not set.';
  const targetLines = lines(targetText, 178, 7.5), longTargets = targetLines.length > 4;
  label('Preference targets', 16, 244, 9, colors.ink, true);
  wrap(longTargets ? 'Your full preference targets continue in the appendix; they remain available in My preferences.' : targetText, 16, 249, 178, 7.5, 4);
  wrap('Counts describe saved outcomes. Based on limited application data, comparisons should be treated cautiously; they do not predict your next application.', 16, 269, 178, 7.5, 3);

  // Exceptional long saved text or many pay units gets a readable appendix, not clipping.
  let appendixY = 0;
  const appendix = () => { page('Supporting context', 'Saved preference targets and salary groups · no individual application records'); appendixY = 63; };
  const appendixParagraph = (text: string) => {
    for (const line of lines(text, 178, 9)) { if (!appendixY || appendixY > 272) appendix(); label(line, 16, appendixY, 9); appendixY += 4.5; }
    appendixY += 5;
  };
  if (longTargets) { appendix(); label('Preference targets', 16, appendixY, 12, colors.rose, true); appendixY += 9; appendixParagraph(targetText); }
  if (extraSalaryGroups.length) {
    if (!appendixY) appendix();
    for (const group of extraSalaryGroups) { if (appendixY > 245) appendix(); salaryRow(group, appendixY); appendixY += 25; }
  }
  const pages = pdf.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    pdf.setPage(i); pdf.setDrawColor(colors.border); pdf.line(16, 283, 194, 283);
    label('Personal analytics', 16, 290, 8, colors.muted); label(`Report date: ${stats.asOf}`, 105, 290, 8, colors.muted, false, 'center'); label(`${i} / ${pages}`, 194, 290, 8, colors.muted, false, 'right');
  }
  return pdf;
}
