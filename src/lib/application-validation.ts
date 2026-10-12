import { CURRENCIES } from './currencies';
import { OFFER_PAY_PERIODS } from './salary-offers';

export const APPLICATION_STATUSES = ['LEAD', 'APPLIED', 'SCREENING', 'INTERVIEWING', 'OFFER', 'ACCEPTED', 'REJECTED', 'WITHDRAWN'] as const;

export function applicationValidationError(input: unknown) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return 'Expected one application object.';
  const body = input as Record<string, unknown>;
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
