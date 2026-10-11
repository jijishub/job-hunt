export type AIModelId =
  | 'luna'
  | 'gemini-3.8-flash'
  | 'gemini-3.1-pro-high'
  | 'gemini-web-pro'
  | 'gemini-web-thinking'
  | 'gemini-web-flash';

export interface AIModelOption {
  id: AIModelId;
  name: string;
  badge: string;
  description: string;
}

export const AVAILABLE_AI_MODELS: AIModelOption[] = [
  {
    id: 'luna',
    name: 'ChatGPT 5.6 Luna',
    badge: '🌙 Fast & Smart (~2s)',
    description: 'Fast, balanced intelligence for rapid resume scanning and job lead matching',
  },
  {
    id: 'gemini-3.8-flash',
    name: 'Antigravity 3.8 Flash',
    badge: '⚡ Blazing Fast (~1.5s)',
    description: 'Ultra-fast Antigravity speed with high accuracy for rapid ATS scanning & fit checks',
  },
  {
    id: 'gemini-3.1-pro-high',
    name: 'Antigravity 3.1 Pro High',
    badge: '👑 Executive Reasoning',
    description: 'Deep technical reasoning, comprehensive ATS gap analysis & tailored pitches',
  },
  {
    id: 'gemini-web-thinking',
    name: 'Gemini Thinking',
    badge: '🧠 Chain-of-Thought',
    description: 'Extended chain-of-thought analysis for complex qualification gap detection',
  },
  {
    id: 'gemini-web-pro',
    name: 'Gemini Web Pro',
    badge: '💎 High Fidelity',
    description: 'Recruiter-grade evaluation, comprehensive ATS optimization & executive pitch',
  },
];

export interface BulletRewrite {
  original: string;
  improved: string;
  reason: string;
}

export interface ResumeAnalysisResult {
  matchScore: number;
  matchTier: 'Strong Match' | 'Good Match' | 'Moderate Match' | 'Stretch / Growth Role';
  summary: string;
  matchingSkills: string[];
  missingKeywords: string[];
  strengths: string[];
  gaps: string[];
  bulletRewrites: BulletRewrite[];
  interviewTips: string[];
  tailoredPitch: string;
  modelUsed: string;
  analyzedAt: string;
}

export interface AILeadMatch {
  leadId: string;
  matchScore: number;
  fitTier: 'Strong Match' | 'Good Match' | 'Growth Role';
  matchedSkills: string[];
  missingSkills: string[];
  aiVerdict: string;
}

export interface GeneratedLead {
  id: string;
  title: string;
  company_name: string;
  company_logo?: string;
  location: string;
  remote: boolean;
  tags: string[];
  matched_skills: string[];
  match_score: number;
  salary_range?: string;
  job_types: string[];
  description: string;
  search_url: string;
  ai_verdict: string;
}

