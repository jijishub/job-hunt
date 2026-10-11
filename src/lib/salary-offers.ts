import { JobApplication, OfferPayPeriod } from '@/types/job';

export const OFFER_PAY_PERIODS: { value: OfferPayPeriod; label: string }[] = [
  { value: 'MONTHLY', label: 'Monthly' }, { value: 'ANNUAL', label: 'Annual' }, { value: 'HOURLY', label: 'Hourly' },
];
export const offerPeriodLabel = (value: OfferPayPeriod) => OFFER_PAY_PERIODS.find(period => period.value === value)!.label;

export function recordedSalaryOffer(app: JobApplication) {
  const raw = app.offer_amount;
  if (raw == null || String(raw).trim() === '' || !['number', 'string'].includes(typeof raw)) return null;
  const amount = Number(raw), currency = (app.offer_currency || 'PHP').trim().toUpperCase();
  const period = app.offer_pay_period || 'MONTHLY';
  if (!Number.isFinite(amount) || amount < 0 || !/^[A-Z]{3}$/.test(currency) || !OFFER_PAY_PERIODS.some(item => item.value === period)) return null;
  return { key: `${currency}:${period}`, amount, currency, period, id: app.id, company: app.company_name, role: app.role_title };
}

export function salaryOfferAnalytics(applications: JobApplication[]) {
  const offers = applications.map(recordedSalaryOffer).filter((offer): offer is NonNullable<typeof offer> => offer !== null);
  const keys = [...new Set(offers.map(offer => offer.key))].sort();
  const groups = keys.map(key => {
    const points = offers.filter(offer => offer.key === key).sort((a, b) => a.amount - b.amount || a.id.localeCompare(b.id));
    const middle = Math.floor(points.length / 2);
    const median = points.length % 2 ? points[middle].amount : points[middle - 1].amount / 2 + points[middle].amount / 2;
    return { key, currency: points[0].currency, period: points[0].period, count: points.length, median, min: points[0].amount, max: points.at(-1)!.amount, points };
  });
  return { count: offers.length, missing: applications.length - offers.length, groups };
}
export type SalaryOfferGroup = ReturnType<typeof salaryOfferAnalytics>['groups'][number];

export function salaryOfferScale(group: SalaryOfferGroup) {
  const padding = Math.max((group.max - group.min) * 0.1, group.max * 0.05, 1);
  return { min: Math.max(0, group.min - padding), max: group.max + padding };
}

export function normalizeOfferFields(body: Record<string, unknown>) {
  const result: Record<string, unknown> = {};
  if (Object.hasOwn(body, 'offer_amount')) result.offer_amount = body.offer_amount == null || String(body.offer_amount).trim() === '' ? null : Number(body.offer_amount);
  if (Object.hasOwn(body, 'offer_currency')) result.offer_currency = body.offer_currency == null ? null : String(body.offer_currency).trim().toUpperCase();
  if (Object.hasOwn(body, 'offer_pay_period')) result.offer_pay_period = body.offer_pay_period;
  return result;
}
