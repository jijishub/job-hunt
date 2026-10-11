import { JobApplication } from '@/types/job';
import { pipelineAnalytics, isInternship } from './analytics';
import { AnalyticsStage } from './analytics-stages';
import { ROLE_FITS } from './role-fit';

export async function analyticsPdf(applications: JobApplication[], accountName: string, scope: string, aiSummary?: string, mapping: Record<string, AnalyticsStage> = {}) {
  const { default: jsPDF } = await import('jspdf');
  const pdf = new jsPDF(); const stats = pipelineAnalytics(applications, mapping);
  const rose = '#9D3C5E', ink = '#4A3E44', muted = '#736A6D', pink = '#FFF0F6';
  const clean = (value: string) => value.normalize('NFKD').replace(/[^\x20-\x7E\n]/g, '');
  const percent = (value: number | null) => value === null ? 'N/A' : `${value}%`;
  let y = 42;
  const header = () => {
    pdf.setFillColor(pink); pdf.rect(0, 0, 210, 32, 'F');
    pdf.setTextColor(rose); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(19); pdf.text('job-hunt', 17, 16);
    pdf.setFontSize(9); pdf.setFont('helvetica', 'normal'); pdf.text('PERSONAL PIPELINE REPORT', 17, 24);
    pdf.setTextColor(muted); pdf.text(clean(scope), 193, 16, { align: 'right' });
    pdf.text(new Date().toLocaleDateString('en-PH', { timeZone: 'Asia/Shanghai', day: 'numeric', month: 'short', year: 'numeric' }), 193, 24, { align: 'right' });
  };
  header();
  const room = (height: number) => { if (y + height > 274) { pdf.addPage(); header(); y = 42; } };
  const text = (value: string, size = 10, color = ink) => {
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(size); pdf.setTextColor(color);
    const lines: string[] = pdf.splitTextToSize(clean(value), 176);
    for (const line of lines) { room(6); pdf.text(line, 17, y); y += size * 0.45 + 2; }
  };
  const section = (title: string) => { room(20); y += 6; pdf.setDrawColor('#F1DDE9'); pdf.line(17, y - 3, 193, y - 3); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(12); pdf.setTextColor(rose); pdf.text(title, 17, y + 3); y += 13; };
  text(`${accountName} - Job search analytics`, 17);
  text('A snapshot of your targeting, progress and recorded outcomes.', 10, muted); y += 4;
  const cards = [['Tracked roles', String(stats.total)], ['Submitted', String(stats.submitted)], ['Screening', percent(stats.progressionRate)], ['Acceptance / offer', percent(stats.offerRate)]];
  room(28);
  cards.forEach(([label, value], i) => { const x = 17 + i * 45; pdf.setFillColor(pink); pdf.roundedRect(x, y, 41, 25, 3, 3, 'F'); pdf.setTextColor(muted); pdf.setFontSize(8); pdf.text(label, x + 3, y + 6); pdf.setTextColor(rose); pdf.setFontSize(19); pdf.setFont('helvetica', 'bold'); pdf.text(value, x + 3, y + 18); });
  y += 33; text(`Assessed: ${stats.assessed} | Unassessed: ${stats.unassessed} | Fit coverage: ${percent(stats.coverage)}`, 9, muted);
  text(`Not submitted / leads: ${stats.leads} | Submitted in last 30 days: ${stats.recent}`, 9, muted);
  section('Recorded progression');
  for (const stage of stats.funnel) { room(15); pdf.setFont('helvetica', 'normal'); pdf.setFontSize(10); pdf.setTextColor(ink); pdf.text(stage.label, 17, y); pdf.text(String(stage.count), 193, y, { align: 'right' }); pdf.setFillColor('#F5F0F3'); pdf.roundedRect(17, y + 3, 176, 3, 1, 1, 'F'); const width=stats.submitted?176*stage.count/stats.submitted:0; if(width){pdf.setFillColor('#FF7AB3');pdf.roundedRect(17,y+3,width,3,1,1,'F');} y += 14; }
  room(90); section('Role fit and conversion');
  const columns=[17,86,110,135,165];
  const tableHeader=()=>{room(12);pdf.setFillColor(rose);pdf.rect(17,y,176,9,'F');pdf.setTextColor('#FFFFFF');pdf.setFontSize(8);['Role fit','Tracked','Submitted','Screening','Acceptances'].forEach((label,i)=>pdf.text(label,columns[i]+2,y+6));y+=12;};
  tableHeader();
  stats.fits.forEach((fit,i)=>{room(17);pdf.setFillColor(i%2? '#FFFFFF':pink);pdf.rect(17,y-3,176,13,'F');pdf.setTextColor(ink);pdf.setFontSize(9);[fit.label,String(fit.total),String(fit.submitted),`${fit.progressed} (${percent(fit.progressionRate)})`,`${fit.offers} (${percent(fit.offerRate)})`].forEach((value,j)=>pdf.text(value,columns[j]+2,y+3));y+=17;});
  text('Conversion rates use submitted roles within each fit group. Unassessed roles remain separate.', 9, muted);
  section('Opportunity mix');
  text(`Internships: ${applications.filter(isInternship).length} | Regular Employment: ${applications.filter(app => !isInternship(app)).length}`);
  text(['ON_SITE','HYBRID','REMOTE'].map(model => `${model.replace('_',' ')}: ${applications.filter(app=>app.work_model===model).length}`).join(' | '));
  section('Preference alignment');
  text(stats.preferenceAlignment.map(item=>`${item.label}: ${item.count}`).join(' | '));
  section('Suggested focus'); stats.recommendations.forEach((item,i)=>text(`${i+1}. ${item}`));
  if(aiSummary){section('AI interpretation');text(aiSummary);}
  section('How to read this report');
  text('Standard phases use your saved status mappings, explicit phase entries, and recorded history. Not Proceeding does not erase the phase reached. Acceptance counts include both accepted and declined outcomes mapped to Acceptance / offer. Each application counts once. Older outcomes may need phase review. Rates describe recorded results and do not predict future success.',9,muted);
  pdf.addPage();header();y=42;section('Application details');
  for(const app of applications){
    room(27);pdf.setFillColor(pink);pdf.roundedRect(17,y-3,176,9,2,2,'F');text(`${app.company_name} - ${app.role_title}`,10);
    text(`Status: ${app.notion_status||app.status}${app.not_proceeding?' | Not Proceeding':''} | Fit: ${ROLE_FITS.find(fit=>fit.value===app.role_fit)?.label||'Unassessed'}`,9,muted);
    if(app.analytics_stage)text(`Explicit analytics phase: ${app.analytics_stage}`,9,muted);
    if(app.role_fit_analysis?.explanation)text(app.role_fit_analysis.explanation,9);
    if(app.notes)text(`Personal notes: ${app.notes}`,9);
    y+=4;
  }
  const pages=pdf.getNumberOfPages();for(let page=1;page<=pages;page++){pdf.setPage(page);pdf.setDrawColor('#F1DDE9');pdf.line(17,282,193,282);pdf.setFont('helvetica','normal');pdf.setFontSize(8);pdf.setTextColor(muted);pdf.text('job-hunt | '+clean(accountName),17,289);pdf.text(`${page} / ${pages}`,193,289,{align:'right'});}
  return pdf;
}
