import { JobApplication, OfferPayPeriod } from '@/types/job';

export const OFFER_PAY_PERIODS: { value: OfferPayPeriod; label: string }[] = [
  { value: 'MONTHLY', label: 'Monthly' }, { value: 'ANNUAL', label: 'Annual' }, { value: 'HOURLY', label: 'Hourly' },
];
export const offerPeriodLabel = (value: OfferPayPeriod) => OFFER_PAY_PERIODS.find(period => period.value === value)!.label;

export function recordedSalaryOffer(app: JobApplication) {
  return salaryValue(app, 'offer');
}

export function recordedExpectedSalary(app: JobApplication) {
  return salaryValue(app, 'expected_salary');
}

function salaryValue(app: JobApplication, prefix: 'offer' | 'expected_salary') {
  const raw = app[`${prefix}_amount`];
  if (raw == null || String(raw).trim() === '' || !['number', 'string'].includes(typeof raw)) return null;
  const amount = Number(raw), currency = (app[`${prefix}_currency`] || 'PHP').trim().toUpperCase();
  const period = app[`${prefix}_pay_period`] || 'MONTHLY';
  if (!Number.isFinite(amount) || amount < 0 || !/^[A-Z]{3}$/.test(currency) || !OFFER_PAY_PERIODS.some(item => item.value === period)) return null;
  return { key: `${currency}:${period}`, amount, currency, period, id: app.id, company: app.company_name, role: app.role_title };
}

export function salaryOfferAnalytics(applications: JobApplication[]) {
  const offers = applications.map(recordedSalaryOffer).filter((offer): offer is NonNullable<typeof offer> => offer !== null);
  const expected = applications.map(recordedExpectedSalary).filter((salary): salary is NonNullable<typeof salary> => salary !== null);
  const groups = salaryGroups(offers);
  const expectations = salaryGroups(expected).map(group => {
    const pairs = group.points.flatMap(point => {
      const offer = offers.find(value => value.id === point.id && value.key === point.key);
      return offer ? [{ ...point, expected: point.amount, offered: offer.amount, gap: offer.amount - point.amount }] : [];
    });
    return { ...group, pairs, matched: pairs.length, met: pairs.filter(pair => pair.gap >= 0).length, medianGap: pairs.length ? median(pairs.map(pair => pair.gap)) : null };
  });
  return { count: offers.length, missing: applications.length - offers.length, groups, expectedCount: expected.length, expectations };
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b), middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : sorted[middle - 1] / 2 + sorted[middle] / 2;
}

function salaryGroups(values: NonNullable<ReturnType<typeof recordedSalaryOffer>>[]) {
  return [...new Set(values.map(value => value.key))].sort().map(key => {
    const points = values.filter(value => value.key === key).sort((a, b) => a.amount - b.amount || a.id.localeCompare(b.id));
    return { key, currency: points[0].currency, period: points[0].period, count: points.length, median: median(points.map(point => point.amount)), min: points[0].amount, max: points.at(-1)!.amount, points };
  });
}
export type SalaryOfferGroup = ReturnType<typeof salaryOfferAnalytics>['groups'][number];

export function salaryOfferScale(group: SalaryOfferGroup) {
  const padding = Math.max((group.max - group.min) * 0.1, group.max * 0.05, 1);
  return { min: Math.max(0, group.min - padding), max: group.max + padding };
}

export function normalizeOfferFields(body: Record<string, unknown>) {
  const result: Record<string, unknown> = {};
  for (const prefix of ['offer', 'expected_salary']) {
    const amount = `${prefix}_amount`, currency = `${prefix}_currency`, period = `${prefix}_pay_period`;
    if (Object.hasOwn(body, amount)) result[amount] = body[amount] == null || String(body[amount]).trim() === '' ? null : Number(body[amount]);
    if (Object.hasOwn(body, currency)) result[currency] = body[currency] == null ? null : String(body[currency]).trim().toUpperCase();
    if (Object.hasOwn(body, period)) result[period] = body[period];
  }
  return result;
}
