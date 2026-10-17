export const CURRENCIES = ['PHP', 'USD'] as const;

type SalaryAmount = number | string | null | undefined;
export function formatSalaryRange(minimum: SalaryAmount, maximum: SalaryAmount, currency?: string | null): string {
  const amount = (value: SalaryAmount) => {
    if (value == null || (typeof value === 'string' && !value.trim())) return undefined;
    const numeric = typeof value === 'number' ? value : Number(value.replace(/,/g, ''));
    return Number.isFinite(numeric) ? numeric.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : undefined;
  };
  const min = amount(minimum), max = amount(maximum);
  const code = currency?.trim().toUpperCase() || 'Currency unknown';
  if (min !== undefined && max !== undefined) return `${code} ${min} – ${max}`;
  if (min !== undefined) return `${code} ${min}`;
  if (max !== undefined) return `Up to ${code} ${max}`;
  return '';
}
