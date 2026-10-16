import type { JobApplication } from '@/types/job';

export async function fetchApplicationSummaries(search = '', signal?: AbortSignal) {
  const records: JobApplication[] = [];
  for (let offset = 0; ; offset += 500) {
    const query = new URLSearchParams({ view: 'summary' });
    if (offset) query.set('offset',String(offset));
    if (search) query.set('q',search);
    const response = await fetch(`/api/applications${query.size ? `?${query}` : ''}`, { signal });
    const result = await response.json();
    if (!response.ok || !result.success || !Array.isArray(result.data)) throw new Error(result.error || 'Applications could not be loaded.');
    records.push(...result.data);
    if (!result.pagination || records.length >= result.pagination.total || !result.data.length) break;
  }
  return records;
}
export async function hydrateApplication(app: JobApplication, signal?: AbortSignal): Promise<JobApplication> {
  if (!app.summary_only) return app;
  const response = await fetch(`/api/applications/${encodeURIComponent(app.id)}`, { signal });
  const result = await response.json();
  if (!response.ok || !result.success || !result.data || result.data.id !== app.id || result.data.summary_only) throw new Error(result.error || 'Application details could not be loaded.');
  return result.data;
}
