import { JobApplication } from '@/types/job';
import { pipelineAnalytics } from './analytics';
import { AnalyticsStage, DEFAULT_REJECTION_STATUSES } from './analytics-stages';
import { PersonalPreferences } from './preferences';
import { formatSalaryRange } from './currencies';
import { offerPeriodLabel, salaryOfferScale } from './salary-offers';

type PipelineInsight = { summary: string; nextSteps: string[] };
type ReportTargets = Pick<PersonalPreferences, 'target_companies' | 'target_roles' | 'preferred_locations' | 'work_models' | 'job_types' | 'salary_min' | 'salary_currency' | 'dealbreakers'>;

export async function analyticsPdf(
  applications: JobApplication[], accountName: string, scope: string,
  insight?: string | PipelineInsight, mapping: Record<string, AnalyticsStage> = {},
  rejectionStatuses: readonly string[] = DEFAULT_REJECTION_STATUSES, targets?: ReportTargets,
) {
  const { default: jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  const stats = pipelineAnalytics(applications, mapping, rejectionStatuses);
  const colors = { rose: '#9D3C5E', ink: '#37343C', muted: '#736A6D', border: '#EAE4E9', pink: '#FFF0F6', recorded: '#E99ABA', inferred: '#C8BCE8', blue: '#A8CCF0', track: '#F3F1F5' };
  const clean = (value: string) => value.replace(/[–—]/g, '-').replace(/[’‘]/g, "'").replace(/[“”]/g, '"').normalize('NFKD').replace(/[^\x20-\x7E\n]/g, '');
  const percent = (value: number | null) => value === null ? 'N/A' : `${value}%`;
  const count = (value: number) => value.toLocaleString('en-US');
  const label = (value: string, x: number, y: number, size = 9, color = colors.ink, bold = false, align: 'left' | 'right' | 'center' = 'left') => {
    pdf.setFont('helvetica', bold ? 'bold' : 'normal'); pdf.setFontSize(size); pdf.setTextColor(color);
    pdf.text(clean(value), x, y, { align });
  };
  const panel = (x: number, y: number, width: number, height: number, fill = '#FFFFFF') => {
    pdf.setFillColor(fill); pdf.setDrawColor(colors.border); pdf.setLineWidth(0.2);
    pdf.roundedRect(x, y, width, height, 3, 3, 'FD');
  };
  const header = () => {
    label('job-hunt', 16, 18, 14, colors.rose, true);
    label('PERSONAL ANALYTICS', 16, 24, 7, colors.muted);
    label(scope, 194, 18, 8, colors.muted, false, 'right');
    label(`As of ${stats.asOf}`, 194, 24, 8, colors.muted, false, 'right');
    pdf.setDrawColor(colors.border); pdf.line(16, 30, 194, 30);
  };
  const pageTitle = (title: string, subtitle: string) => {
    label(title, 16, 43, 19, colors.ink, true);
    label(subtitle, 16, 51, 9, colors.muted);
  };
  const newPage = () => { pdf.addPage(); header(); };
  pdf.setProperties({ title: 'Job search analytics', subject: 'Aggregate pipeline results, insights and preference targets', author: accountName });
  header(); pageTitle('Pipeline overview', accountName);

  // Fixed-size visual summaries: document length never depends on the number of applications.
  const metrics = [
    ['Tracked', count(stats.total), `${count(stats.leads)} not submitted`],
    ['Submitted', count(stats.submitted), `${count(stats.recent)} in 30 days`],
    ['Progression', percent(stats.progressionRate), `${count(stats.funnel[1].count)} reached screening`],
    ['Offers', percent(stats.offerRate), `${count(stats.funnel[4].count)} reached offer`],
    ['Rejections', percent(stats.rejectionRate), `${count(stats.rejections)} current rejections`],
  ];
  metrics.forEach(([title, value, detail], i) => {
    const x = 16 + i * 36.4;
    panel(x, 60, 32.4, 29, i === 0 ? colors.pink : '#FFFFFF');
    label(title, x + 3, 66, 8, colors.muted);
    label(value, x + 3, 77, 19, colors.rose, true);
    label(detail, x + 3, 84, 6.3, colors.muted);
  });
  label('Rates use submitted applications in this scope.', 16, 96, 8, colors.muted);

  label('Reached or passed', 16, 108, 12, colors.ink, true);
  pdf.setFillColor(colors.recorded); pdf.rect(115, 104.5, 3, 3, 'F'); label('Recorded', 120, 107, 7, colors.muted);
  pdf.setFillColor(colors.inferred); pdf.rect(150, 104.5, 3, 3, 'F'); label('Inferred', 155, 107, 7, colors.muted);
  stats.funnel.forEach((stage, i) => {
    const y = 121 + i * 16;
    label(stage.label, 16, y, 9);
    label(`${count(stage.count)}  /  ${count(stats.submitted)}`, 194, y, 8, colors.muted, false, 'right');
    pdf.setFillColor(colors.track); pdf.roundedRect(16, y + 3, 178, 5, 1, 1, 'F');
    if (stats.submitted) {
      const recorded = 178 * stage.recorded / stats.submitted, inferred = 178 * stage.inferred / stats.submitted;
      if (recorded) { pdf.setFillColor(colors.recorded); pdf.rect(16, y + 3, recorded, 5, 'F'); }
      if (inferred) { pdf.setFillColor(colors.inferred); pdf.rect(16 + recorded, y + 3, inferred, 5, 'F'); }
    }
  });
  label('Inferred phases follow a later outcome; they are not recorded interview evidence.', 16, 201, 7.5, colors.muted);

  label('Submission activity', 16, 214, 12, colors.ink, true);
  label('Last 12 months', 194, 214, 8, colors.muted, false, 'right');
  const activityMax = Math.max(1, ...stats.activity.map(item => item.count));
  pdf.setDrawColor(colors.border); pdf.line(16, 255, 194, 255);
  stats.activity.forEach((item, i) => {
    const x = 19 + i * 14.6, height = 30 * item.count / activityMax;
    if (height) { pdf.setFillColor(colors.blue); pdf.rect(x, 255 - height, 9, height, 'F'); }
    label(count(item.count), x + 4.5, 252 - height, 7, colors.ink, false, 'center');
    label(item.label, x + 4.5, 261, 6.5, colors.muted, false, 'center');
  });
  label(`Dates excluded: ${stats.quality.missingDates} missing, ${stats.quality.invalidDates} invalid, ${stats.quality.futureDates} future.`, 16, 271, 7.5, colors.muted);

  newPage(); pageTitle('Fit and outcomes', 'Compare saved fit ratings with your recorded progress.');
  panel(16, 59, 178, 66);
  label('Conversion by role fit', 21, 67, 11, colors.ink, true);
  const series = [
    { title: 'Progression', key: 'progressionRate' as const, color: colors.blue },
    { title: 'Offers', key: 'offerRate' as const, color: '#A6DCC7' },
    { title: 'Rejections', key: 'rejectionRate' as const, color: '#F6B4C4' },
  ];
  series.forEach((item, i) => {
    const x = 105 + i * 29;
    pdf.setFillColor(item.color); pdf.rect(x, 64, 2.5, 2.5, 'F'); label(item.title, x + 4, 66.5, 6.5, colors.muted);
  });
  [0, 50, 100].forEach(value => {
    const y = 109 - value * 0.32;
    pdf.setDrawColor(colors.border); pdf.line(31, y, 187, y); label(`${value}%`, 28, y + 1, 6, colors.muted, false, 'right');
  });
  stats.fits.forEach((fit, i) => {
    const x = 44 + i * 39;
    series.forEach((item, j) => {
      const value = fit[item.key], height = (value ?? 0) * 0.32;
      if (height) { pdf.setFillColor(item.color); pdf.rect(x - 10 + j * 7, 109 - height, 5, height, 'F'); }
    });
    label(fit.label, x, 116, 7, colors.ink, false, 'center');
    label(`n = ${count(fit.submitted)} submitted`, x, 121, 6, colors.muted, false, 'center');
  });
  label('Role fit and conversion', 16, 138, 11, colors.ink, true);
  const columns = [19, 65, 88, 112, 143, 172];
  pdf.setFillColor(colors.pink); pdf.roundedRect(16, 143, 178, 10, 2, 2, 'F');
  ['Role fit', 'Tracked', 'Submitted', 'Progression', 'Offers', 'Rejections'].forEach((title, i) => label(title, columns[i], 149.5, 7, colors.rose, true));
  stats.fits.forEach((fit, i) => {
    const y = 162 + i * 9;
    [fit.label, count(fit.total), count(fit.submitted), percent(fit.progressionRate), percent(fit.offerRate), percent(fit.rejectionRate)].forEach((value, j) => label(value, columns[j], y, 8));
    pdf.setDrawColor(colors.border); pdf.line(16, y + 3, 194, y + 3);
  });
  label(`Assessed: ${count(stats.assessed)}  |  Unassessed: ${count(stats.unassessed)}  |  Coverage: ${percent(stats.coverage)}`, 16, 199, 8, colors.muted);

  panel(16, 207, 87, 65); panel(107, 207, 87, 65);
  label('Current outcomes', 21, 216, 11, colors.ink, true);
  stats.outcomes.forEach((item, i) => {
    const y = 226 + i * 7.5;
    pdf.setFillColor(item.color); pdf.rect(21, y - 2, 2.5, 2.5, 'F');
    label(item.label, 26, y, 7.5); label(count(item.count), 98, y, 8, colors.ink, true, 'right');
    if (item.count && stats.total) { pdf.setFillColor(item.color); pdf.rect(26, y + 1.2, 59 * item.count / stats.total, 1.2, 'F'); }
  });
  label('Preference alignment', 112, 216, 11, colors.ink, true);
  stats.preferenceAlignment.forEach((item, i) => {
    const y = 227 + i * 10;
    label(item.label.charAt(0) + item.label.slice(1).toLowerCase(), 112, y, 7.5);
    label(count(item.count), 189, y, 8, colors.ink, true, 'right');
    pdf.setFillColor(colors.track); pdf.rect(112, y + 2, 77, 2, 'F');
    if (item.count && stats.total) { pdf.setFillColor(['#A6DCC7', '#F4D6A4', '#F6B4C4', '#C8BCE8'][i]); pdf.rect(112, y + 2, 77 * item.count / stats.total, 2, 'F'); }
  });

  if (stats.salaryOffers.count) {
    stats.salaryOffers.groups.forEach((group, index) => {
      if (index % 6 === 0) { newPage(); pageTitle('Recorded salary offers', 'Actual base-pay offers, grouped by currency and pay period.'); }
      const x = 16 + index % 2 * 91, top = 61 + Math.floor(index % 6 / 2) * 72;
      panel(x, top, 87, 65);
      label(`${group.currency} / ${offerPeriodLabel(group.period)}`, x + 4, top + 8, 10, colors.ink, true);
      label(`n = ${group.count}`, x + 83, top + 8, 8, colors.muted, false, 'right');
      label(`Median: ${formatSalaryRange(group.median, undefined, group.currency)}`, x + 4, top + 17, 9, colors.rose, true);
      label(`Range: ${formatSalaryRange(group.min, group.max, group.currency)}`, x + 4, top + 23, 7, colors.muted);
      const scale = salaryOfferScale(group), position = (amount: number) => x + 9 + (amount - scale.min) / (scale.max - scale.min) * 69;
      pdf.setDrawColor(colors.border); pdf.line(x + 9, top + 52, x + 78, top + 52);
      pdf.setDrawColor(colors.rose); pdf.setLineDashPattern([1, 1], 0); pdf.line(position(group.median), top + 28, position(group.median), top + 52); pdf.setLineDashPattern([], 0);
      group.points.forEach((point, i) => { pdf.setFillColor(colors.recorded); pdf.circle(position(point.amount), top + 35 + i % 3 * 4, 1.3, 'F'); });
      label(scale.min.toLocaleString('en-US', { maximumFractionDigits: 2 }), x + 9, top + 60, 7, colors.muted);
      label(scale.max.toLocaleString('en-US', { maximumFractionDigits: 2 }), x + 78, top + 60, 7, colors.muted, false, 'right');
    });
    label('Dots are recorded offers; dashed line is the median. These samples are not a market salary estimate.', 16, 275, 7, colors.muted);
  }
  newPage(); pageTitle('Targets and insights', 'Your saved preferences and analysis for this scope.');
  let y = 63;
  const room = (height: number) => {
    if (y + height > 273) { newPage(); label('Targets and insights / continued', 16, 43, 16, colors.ink, true); y = 57; }
  };
  const paragraph = (value: string, x = 16, width = 178, size = 9, color = colors.ink) => {
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(size);
    const lines: string[] = pdf.splitTextToSize(clean(value), width);
    lines.forEach(line => { room(5); label(line, x, y, size, color); y += 4.7; });
  };
  const section = (title: string) => {
    room(23); label(title, 16, y, 12, colors.rose, true); y += 9;
  };
  if (!stats.salaryOffers.count) { paragraph('Salary offers: no actual offers recorded yet.', 16, 178, 8, colors.muted); y += 7; }
  if (stats.salaryOffers.expectedCount) {
    section('Salary expectations');
    stats.salaryOffers.expectations.forEach(group => {
      room(26);
      paragraph(`${group.currency} / ${offerPeriodLabel(group.period)}: ${group.count} expectations; median ${formatSalaryRange(group.median, undefined, group.currency)}.`, 16, 178, 9);
      paragraph(group.matched ? `${group.met} of ${group.matched} matching offers meet expectations. Median offer minus expected salary: ${group.medianGap! > 0 ? '+' : group.medianGap! < 0 ? '-' : ''}${formatSalaryRange(Math.abs(group.medianGap!), undefined, group.currency)}.` : 'No matching offers recorded yet.', 16, 178, 8, colors.muted);
      y += 3;
    });
    paragraph('Comparisons pair the same application with matching currency and pay period.', 16, 178, 8, colors.muted);
    y += 7;
  }
  section('Preference targets');
  const human = (values?: string[]) => values?.length ? values.map(value => value.replaceAll('_', ' ').toLowerCase()).join(', ') : 'Not set';
  const targetRows = [
    ['Target positions', targets?.target_roles?.join(', ') || 'Not set'],
    ['Target companies', targets?.target_companies?.join(', ') || 'Not set'],
    ['Locations', targets?.preferred_locations?.join(', ') || 'Not set'],
    ['Work models', human(targets?.work_models)],
    ['Job types', human(targets?.job_types)],
    ['Minimum monthly pay', formatSalaryRange(targets?.salary_min, undefined, targets?.salary_currency) || 'Not set'],
    ['Priorities', targets?.dealbreakers?.trim() || 'Not set'],
  ];
  targetRows.forEach(([title, value]) => {
    room(15); label(title, 16, y, 8, colors.muted, true);
    paragraph(value, 58, 136); y += 3;
  });
  y += 7; section('AI pipeline analysis');
  const summary = typeof insight === 'string' ? insight : insight?.summary;
  if (summary?.trim()) {
    paragraph(summary);
    if (typeof insight !== 'string' && insight?.nextSteps.length) {
      y += 5; section('AI next steps');
      insight.nextSteps.forEach((step, i) => { paragraph(`${i + 1}. ${step}`); y += 3; });
    }
  } else {
    paragraph('No AI analysis generated for this snapshot. Use Analyze my pipeline with AI in Analytics, then export again.', 16, 178, 9, colors.muted);
  }
  if (stats.recommendations.length) {
    y += 6; section('Data-based focus');
    stats.recommendations.forEach((item, i) => { paragraph(`${i + 1}. ${item}`); y += 2; });
  }
  y += 6; section('Data notes');
  paragraph(`${stats.quality.uncertainPhases} closed phases to review; ${stats.quality.duplicateRecords} duplicate records removed. Activity excludes missing, invalid and future dates.`, 16, 178, 8, colors.muted);
  y += 2;
  paragraph('Each application counts once. Rates use submitted roles; fit rates use each group\'s submitted roles. N/A means no submitted sample. Phases may be inferred from later outcomes. Current outcomes are exclusive; offers reached include declined offers. Rejections use your saved status selections. Small samples describe past results, not future chances.', 16, 178, 8, colors.muted);

  const pages = pdf.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    pdf.setPage(page); pdf.setDrawColor(colors.border); pdf.line(16, 281, 194, 281);
    label('job-hunt / Personal analytics', 16, 289, 7, colors.muted);
    label(`${page} / ${pages}`, 194, 289, 7, colors.muted, false, 'right');
  }
  return pdf;
}
