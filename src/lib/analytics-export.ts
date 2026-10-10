import { JobApplication } from '@/types/job';
import { pipelineAnalytics, isInternship } from './analytics';
import { ROLE_FITS } from './role-fit';

export async function analyticsPdf(applications: JobApplication[], accountName: string, scope: string, aiSummary?: string) {
  const { default: jsPDF } = await import('jspdf');
  const pdf = new jsPDF();
  const stats = pipelineAnalytics(applications);
  let y = 20;
  const text = (value: string, size = 10) => {
    pdf.setFontSize(size);
    const lines: string[] = pdf.splitTextToSize(value.replace(/[^\x20-\x7E\n]/g, '-'), 174);
    for (const line of lines) {
      if (y > 275) { pdf.addPage(); y = 20; }
      pdf.text(line, 18, y); y += size * 0.45 + 2;
    }
  };
  const section = (title: string) => { y += 5; text(title, 13); };
  const percent = (value: number | null) => value === null ? 'N/A' : `${value}%`;
  text(`${accountName} - Job search analytics`, 18);
  text(`Generated ${new Date().toLocaleDateString('en-PH', { timeZone: 'Asia/Shanghai' })} | ${scope}`);
  text(`Tracked: ${stats.total} | Submitted: ${stats.submitted} | Not submitted / leads: ${stats.leads}`);
  text(`Assessed: ${stats.assessed} | Unassessed: ${stats.unassessed} | Fit coverage: ${percent(stats.coverage)}`);
  text(`Screening progression: ${percent(stats.progressionRate)} | Offer rate: ${percent(stats.offerRate)} | Submitted in last 30 days: ${stats.recent}`);
  section('Role fit and conversion');
  for (const fit of stats.fits) {
    text(`${fit.label}: ${fit.total} tracked, ${fit.submitted} submitted, ${fit.progressed} reached screening or later, ${fit.offers} offers.`);
    text(`Progression: ${percent(fit.progressionRate)} | Offers: ${percent(fit.offerRate)}. ${fit.description}`);
  }
  section('Recorded progression');
  for (const stage of stats.funnel) text(`${stage.label}: ${stage.count}`);
  section('Preference alignment');
  for (const item of stats.preferenceAlignment) text(`${item.label}: ${item.count}`);
  section('Opportunity mix');
  text(`Internships: ${applications.filter(isInternship).length} | Other roles: ${applications.filter(app => !isInternship(app)).length}`);
  for (const [model, label] of [['ON_SITE', 'On-site'], ['HYBRID', 'Hybrid'], ['REMOTE', 'Remote']]) text(`${label}: ${applications.filter(app => app.work_model === model).length}`);
  section('Suggested focus');
  for (const recommendation of stats.recommendations) text(`- ${recommendation}`);
  if (aiSummary) { section('AI interpretation'); text(aiSummary); }
  section('Reading this report');
  text('Rates use submitted applications as the denominator, inferred from their stages. Repeated and Not Accepting Interns are excluded without submission history. Unassessed roles are kept separate. Progression uses current stages plus recorded transitions; older stage history may be missing. A rejection alone does not establish which interview round was reached. Counts show recorded outcomes, not a prediction of future success. Fit ratings reflect the assessment at the time it was saved.');
  section('Application details');
  for (const app of applications) {
    text(`${app.company_name} - ${app.role_title}`, 11);
    text(`Stage: ${app.notion_status || app.status} | Fit: ${ROLE_FITS.find(fit => fit.value === app.role_fit)?.label || 'Unassessed'} (${app.role_fit_source || 'not rated'}) | ${app.work_model} | ${app.salary_currency}`);
    if (app.role_fit_analysis?.explanation) text(app.role_fit_analysis.explanation);
    if (app.role_fit_analysis?.preference_notes) text(`Preference alignment: ${app.role_fit_analysis.preference_alignment}. ${app.role_fit_analysis.preference_notes}`);
  }
  const pages = pdf.getNumberOfPages();
  for (let page = 1; page <= pages; page++) { pdf.setPage(page); pdf.setFontSize(8); pdf.text(`${page} / ${pages}`, 185, 290); }
  return pdf;
}
