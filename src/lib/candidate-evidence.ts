import { getCandidateProfile } from '@/lib/db';
import { portfolioEvidence } from '@/lib/portfolio-evidence';

// The saved account resume is authoritative. Only the admin can fall back to
// her published portfolio; another account's evidence is never used.
export async function candidateEvidence(user: { id: string; email: string; role?: string }) {
  const resume = (await getCandidateProfile(user.id))?.trim();
  if (resume) return { text: resume, source: 'master_resume' as const };
  const portfolio = user.role === 'admin' ? await portfolioEvidence(user.email) : '';
  return { text: portfolio, source: portfolio ? 'portfolio' as const : 'missing' as const };
}
