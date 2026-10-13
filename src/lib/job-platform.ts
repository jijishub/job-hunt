// Match hostname boundaries, not URL substrings or tracking parameters.
// This registry is local and deterministic; classifying never opens the URL.
const PLATFORM_HOSTS: Readonly<Record<string, readonly string[]>> = {
  LINKEDIN: ['linkedin.com'],
  JOBSTREET: ['jobstreet.com', 'jobstreet.com.ph', 'jobstreet.com.sg', 'jobstreet.com.my', 'jobstreet.co.id'],
  INDEED: ['indeed.com', 'indeed.com.ph', 'indeed.co.uk'],
  BOSSJOB: ['bossjob.ph', 'bossjob.com', 'bossjob.com.ph'],
  GLASSDOOR: ['glassdoor.com'],
  BAMBOOHR: ['bamboohr.com'], WORKABLE: ['apply.workable.com'], CVVIZ: ['jobs.cvviz.com'],
  ORACLE_HCM: ['fa.oraclecloud.com'], BETTERTEAM: ['betterteam.com'],
  GREENHOUSE: ['boards.greenhouse.io', 'job-boards.greenhouse.io'], LEVER: ['jobs.lever.co'],
  WORKDAY: ['myworkdayjobs.com'], ASHBY: ['jobs.ashbyhq.com'], SMARTRECRUITERS: ['jobs.smartrecruiters.com'],
  COMPANY_WEBSITE: ['accenture.com', 'joinbytedance.com', 'absoluteindustrial.solutions'],
};
function hostFor(value: string) {
  try {
    const url = new URL(value.trim());
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return null;
    return url.hostname.toLowerCase().replace(/\.$/, '').replace(/^www\./, '');
  } catch { return null; }
}
function matches(host: string, domain: string) { return host === domain || host.endsWith(`.${domain}`); }
export function jobPlatformFromUrl(value?: string | null, companyWebsite?: string | null) {
  if (!value?.trim()) return { platform: null, host: null, reason: 'missing-url' } as const;
  const host = hostFor(value);
  if (!host) return { platform: null, host: null, reason: 'invalid-url' } as const;
  for (const [platform, domains] of Object.entries(PLATFORM_HOSTS)) {
    if (domains.some(domain => matches(host, domain))) return { platform, host, reason: 'recognized-host' } as const;
  }
  const employer = companyWebsite ? hostFor(companyWebsite) : null;
  if (employer && matches(host, employer)) return { platform: 'COMPANY_WEBSITE', host, reason: 'company-website-match' } as const;
  return { platform: null, host, reason: 'unknown-host' } as const;
}
