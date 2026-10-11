import { CURRENCIES } from './currencies';
import { OFFER_PAY_PERIODS } from './salary-offers';

export const APPLICATION_STATUSES = ['LEAD', 'APPLIED', 'SCREENING', 'INTERVIEWING', 'OFFER', 'ACCEPTED', 'REJECTED', 'WITHDRAWN'] as const;

export function applicationValidationError(body: Record<string, unknown>) {
  if (body.ensure_company != null && typeof body.ensure_company !== 'boolean') return 'Invalid company creation flag.';
  const options: Record<string, readonly string[]> = {
    status: APPLICATION_STATUSES, priority: ['LOW', 'MEDIUM', 'HIGH', 'DREAM'],
    job_type: ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP'], work_model: ['REMOTE', 'HYBRID', 'ON_SITE'],
  };
  for (const [field, values] of Object.entries(options)) {
    if (body[field] != null && !values.includes(body[field] as string)) return `Invalid ${field.replaceAll('_', ' ')}.`;
  }
  for (const field of ['role_title', 'company_name', 'information', 'job_description', 'notes', 'notion_status']) {
    if (body[field] != null && typeof body[field] !== 'string') return `${field.replaceAll('_', ' ')} must be text.`;
  }
  if (body.job_url && (typeof body.job_url !== 'string' || !/^https?:\/\//i.test(body.job_url))) return 'Use an http or https job posting URL.';
  for (const field of ['salary_min', 'salary_max']) {
    if (body[field] != null && body[field] !== '' && (!Number.isFinite(Number(body[field])) || Number(body[field]) < 0)) return 'Salary must be a nonnegative amount.';
  }
  if (body.salary_min != null && body.salary_max != null && body.salary_max !== '' && Number(body.salary_min) > Number(body.salary_max)) return 'Maximum salary must be at least the minimum.';
  if (body.offer_amount != null && String(body.offer_amount).trim() !== '' && (!['number', 'string'].includes(typeof body.offer_amount) || !Number.isFinite(Number(body.offer_amount)) || Number(body.offer_amount) < 0)) return 'Offer amount must be a nonnegative number.';
  if (body.offer_currency != null && (typeof body.offer_currency !== 'string' || !CURRENCIES.some(currency => currency === (body.offer_currency as string).trim().toUpperCase()))) return 'Choose PHP or USD for the offer currency.';
  if (body.offer_pay_period != null && !OFFER_PAY_PERIODS.some(period => period.value === body.offer_pay_period)) return 'Choose a valid offer pay period.';
  return null;
}
