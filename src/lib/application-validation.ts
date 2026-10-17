import { CURRENCIES } from './currencies';
import { OFFER_PAY_PERIODS } from './salary-offers';
import { SENIORITY_LEVELS } from './application-analytics-fields';

export const APPLICATION_STATUSES = ['LEAD', 'APPLIED', 'SCREENING', 'INTERVIEWING', 'OFFER', 'ACCEPTED', 'REJECTED', 'WITHDRAWN'] as const;

export function applicationValidationError(input: unknown) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return 'Expected one application object.';
  const body = input as Record<string, unknown>;
  if (body.seniority_level != null && !SENIORITY_LEVELS.some(item => item.value === body.seniority_level)) return 'Choose a valid seniority level.';
  for (const field of ['seniority_level_source', 'role_family_source']) {
    if (body[field] != null && !['derived', 'manual'].includes(body[field] as string)) return 'Choose automatic or manual classification.';
  }
  for (const field of ['role_family', 'job_platform']) {
    if (body[field] != null && (typeof body[field] !== 'string' || (body[field] as string).length > 200)) return `${field.replaceAll('_', ' ')} must be text of at most 200 characters.`;
  }
  if (body.first_response_at != null && body.first_response_at !== '') {
    const value = body.first_response_at;
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value.slice(0, 10)).toISOString().slice(0, 10) !== value.slice(0, 10)) return 'First employer response must be a valid date and time with a timezone.';
  }
  if (body.ensure_company != null && typeof body.ensure_company !== 'boolean') return 'Invalid company creation flag.';
  if (body.is_lead != null && typeof body.is_lead !== 'boolean') return 'Invalid lead flag.';
  const options: Record<string, readonly string[]> = {
    status: APPLICATION_STATUSES, priority: ['LOW', 'MEDIUM', 'HIGH', 'DREAM'],
    job_type: ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP'], work_model: ['REMOTE', 'HYBRID', 'ON_SITE'],
  };
  for (const [field, values] of Object.entries(options)) {
    if (body[field] != null && !values.includes(body[field] as string)) return `Invalid ${field.replaceAll('_', ' ')}.`;
  }
  for (const field of ['role_title', 'company_name', 'information', 'job_description', 'notes', 'notion_status', 'location', 'contact_name', 'contact_email', 'salary_currency']) {
    if (body[field] != null && typeof body[field] !== 'string') return `${field.replaceAll('_', ' ')} must be text.`;
  }
  if (body.salary_currency != null && body.salary_currency !== '' && !/^[A-Za-z]{3}$/.test(body.salary_currency as string)) return 'Salary currency must be a three-letter code or unknown.';
  if (body.job_url != null && body.job_url !== '' && (typeof body.job_url !== 'string' || !/^https?:\/\//i.test(body.job_url))) return 'Use an http or https job posting URL.';
  for (const field of ['salary_min', 'salary_max']) {
    if (body[field] != null && body[field] !== '' && (!['number', 'string'].includes(typeof body[field]) || !String(body[field]).trim() || !Number.isFinite(Number(body[field])) || Number(body[field]) < 0)) return 'Salary must be a nonnegative amount.';
  }
  if (body.salary_min != null && body.salary_max != null && body.salary_max !== '' && Number(body.salary_min) > Number(body.salary_max)) return 'Maximum salary must be at least the minimum.';
  for (const [prefix, label] of [['offer', 'Offer'], ['expected_salary', 'Expected salary']]) {
    const amount = body[`${prefix}_amount`], currency = body[`${prefix}_currency`], period = body[`${prefix}_pay_period`];
    if (amount != null && String(amount).trim() !== '' && (!['number', 'string'].includes(typeof amount) || !Number.isFinite(Number(amount)) || Number(amount) < 0)) return `${label} amount must be a nonnegative number.`;
    if (currency != null && (typeof currency !== 'string' || !CURRENCIES.some(value => value === currency.trim().toUpperCase()))) return `Choose PHP or USD for the ${label.toLowerCase()} currency.`;
    if (period != null && !OFFER_PAY_PERIODS.some(value => value.value === period)) return `Choose a valid ${label.toLowerCase()} pay period.`;
  }
  return null;
}
