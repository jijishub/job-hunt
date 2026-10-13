import { RoleFit, RoleFitAnalysis, type JobApplication } from '@/types/job';

export const ROLE_FITS: { value: RoleFit; label: string; description: string }[] = [
  { value: 'STRONG', label: 'Strong fit', description: 'You already have most of the required experience.' },
  { value: 'POSSIBLE', label: 'Possible fit', description: 'You are qualified but need to demonstrate transferable skills.' },
  { value: 'WEAK', label: 'Weak fit', description: 'You do not meet several important requirements.' },
];
export function validRoleFit(value: unknown): value is RoleFit {
  return ROLE_FITS.some(fit => fit.value === value);
}
export function savedRoleFit(app: Pick<JobApplication, 'role_fit' | 'role_fit_analysis'>) {
  return validRoleFit(app.role_fit) ? app.role_fit : validRoleFit(app.role_fit_analysis?.fit) ? app.role_fit_analysis.fit : null;
}
export function validateFitAnalysis(value: unknown): RoleFitAnalysis {
  const result = value as Partial<RoleFitAnalysis> | null;
  if (!result || !validRoleFit(result.fit) || typeof result.explanation !== 'string' || !result.explanation.trim()
    || !Array.isArray(result.strengths) || !Array.isArray(result.gaps)
    || !result.strengths.every(item => typeof item === 'string') || !result.gaps.every(item => typeof item === 'string')) {
    throw new Error('AI returned an invalid role-fit assessment. Your saved rating was kept.');
  }
  if (result.preference_alignment != null && !['ALIGNED', 'MIXED', 'MISALIGNED', 'UNKNOWN'].includes(result.preference_alignment)) throw new Error('AI returned invalid preference alignment.');
  if (result.preference_notes != null && typeof result.preference_notes !== 'string') throw new Error('AI returned invalid preference notes.');
  return { preference_alignment: result.preference_alignment || 'UNKNOWN', preference_notes: result.preference_notes || '', fit: result.fit, explanation: result.explanation, strengths: result.strengths, gaps: result.gaps, analyzed_at: new Date().toISOString() };
}
