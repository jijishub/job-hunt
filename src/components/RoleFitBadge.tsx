import { JobApplication } from '@/types/job';
import { ROLE_FITS } from '@/lib/role-fit';
export default function RoleFitBadge({ app }: { app: JobApplication }) {
  const fit = ROLE_FITS.find(fit => fit.value === app.role_fit);
  const color = app.role_fit === 'STRONG' ? 'bg-emerald-50 text-emerald-800' : app.role_fit === 'POSSIBLE' ? 'bg-amber-50 text-amber-800' : app.role_fit === 'WEAK' ? 'bg-rose-50 text-rose-800' : 'bg-stone-100 text-stone-500';
  return <span title={app.role_fit_analysis?.explanation || fit?.description || 'Add job requirements to analyze your fit.'} className={`inline-flex rounded-full px-2 py-1 text-[11px] font-semibold ${color}`}>{fit?.label || 'Unassessed'}{app.role_fit_source === 'ai' ? ' · AI' : ''}</span>;
}
