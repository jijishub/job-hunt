export const JOB_SEARCH_PLATFORMS = [
  { id: 'linkedin', name: 'LinkedIn Jobs', description: 'Professional roles' },
  { id: 'jobstreet', name: 'JobStreet', description: 'Philippines & Southeast Asia' },
  { id: 'indeed', name: 'Indeed', description: 'Employer listings' },
  { id: 'google', name: 'Google Jobs', description: 'Aggregated search' },
] as const;

export type JobSearchPlatform = typeof JOB_SEARCH_PLATFORMS[number]['id'];

export function jobSearchUrl(platform: JobSearchPlatform, keywords: string, location = '') {
  const query = keywords.trim();
  const place = location.trim();
  switch (platform) {
    case 'linkedin': return `https://www.linkedin.com/jobs/search/?${new URLSearchParams({ keywords: query, ...(place ? { location: place } : {}) })}`;
    // JobStreet's Philippine keyword searches use a path, not /jobs?keywords=.
    case 'jobstreet': return query ? `https://ph.jobstreet.com/${encodeURIComponent(query.toLowerCase().replace(/\s+/g, '-'))}-jobs` : 'https://ph.jobstreet.com/jobs';
    case 'indeed': return `https://ph.indeed.com/jobs?${new URLSearchParams({ q: query, ...(place ? { l: place } : {}) })}`;
    case 'google': return `https://www.google.com/search?${new URLSearchParams({ q: [query, place, 'jobs'].filter(Boolean).join(' '), ibp: 'htl;jobs' })}`;
  }
}
