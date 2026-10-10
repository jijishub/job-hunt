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

export function getAIConfig() {
  const baseUrl = (process.env.AI_BASE_URL || 'https://api.jizellecasia.site/v1').replace(/\/+$/, '');
  const apiKey =
    process.env.AI_API_KEY ||
    process.env.TOKEN_POOL ||
    'gds_live_Xd4MjLWy7-truOmzQm5KcnFVnpSTTn5A';
  const defaultModel = (process.env.AI_DEFAULT_MODEL || 'luna') as AIModelId;

  return {
    baseUrl,
    apiKey,
    defaultModel,
    isConfigured: Boolean(apiKey),
  };
}

export async function callGeminiJSON<T>(
  systemPrompt: string,
  userPrompt: string,
  model?: AIModelId,
  options?: { timeoutMs?: number }
): Promise<T> {
  const config = getAIConfig();
  const selectedModel = model || config.defaultModel;

  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: 'POST',
    signal: options?.timeoutMs ? AbortSignal.timeout(options.timeoutMs) : undefined,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: selectedModel,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AI service responded with HTTP ${response.status}: ${errorText}`);
  }

  const rawText = await response.text();
  let fullOutput = '';

  const lines = rawText.split('\n');
  let isStream = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('data: ')) {
      isStream = true;
      const jsonStr = trimmed.slice(6);
      if (jsonStr === '[DONE]') continue;
      try {
        const parsed = JSON.parse(jsonStr);
        const delta = parsed.choices?.[0]?.delta?.content || parsed.choices?.[0]?.message?.content || '';
        fullOutput += delta;
      } catch {
        // ignore parse errors for partial lines
      }
    }
  }

  if (!isStream) {
    try {
      const parsed = JSON.parse(rawText);
      fullOutput = parsed.choices?.[0]?.message?.content || parsed.choices?.[0]?.text || rawText;
    } catch {
      fullOutput = rawText;
    }
  }

  let cleanJson = fullOutput.trim();
  if (cleanJson.startsWith('```')) {
    cleanJson = cleanJson.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  }

  try {
    return JSON.parse(cleanJson) as T;
  } catch (err: any) {
    console.error('Failed to parse AI JSON response:', cleanJson);
    throw new Error(`AI returned an unparseable response: ${err.message}`);
  }
}

export async function analyzeResumeWithGemini(params: {
  resumeText: string;
  jobTitle?: string;
  companyName?: string;
  jobDescription: string;
  model?: AIModelId;
}): Promise<ResumeAnalysisResult> {
  const config = getAIConfig();
  const selectedModel = params.model || config.defaultModel;

  const systemPrompt = `You are an elite Senior Technical Recruiter, ATS (Applicant Tracking System) Algorithm Architect, and Executive Career Coach.
Your task is to analyze the candidate's resume/portfolio against the target job role & description.
Evaluate technical skill overlap, quantify ATS match percentage (0-100), identify missing keywords, suggest actionable bullet point rewrites with metrics, and write a high-impact personalized application pitch.

You MUST respond strictly with a valid JSON object matching this schema (do NOT wrap with any text outside the JSON):
{
  "matchScore": number,
  "matchTier": "Strong Match" | "Good Match" | "Moderate Match" | "Stretch / Growth Role",
  "summary": "2-3 sentences summarizing overall fit, role seniority alignment, and readiness",
  "matchingSkills": ["skill1", "skill2", "skill3"],
  "missingKeywords": ["keyword1", "keyword2", "keyword3"],
  "strengths": ["strength 1 with specific evidence", "strength 2", "strength 3"],
  "gaps": ["gap 1 with actionable advice", "gap 2"],
  "bulletRewrites": [
    {
      "original": "candidate original experience or skill mention",
      "improved": "impactful rewrite with action verbs, tech stack, and quantifiable outcome",
      "reason": "why this passes ATS filters and impresses engineering leads"
    }
  ],
  "interviewTips": ["specific talking point or technical concept to review for this role"],
  "tailoredPitch": "a polished, compelling 2-3 paragraph cover letter / pitch ready to send to the hiring team"
}`;

  const userContent = `### TARGET JOB DETAILS
Role Title: ${params.jobTitle || 'Unspecified Role'}
Company: ${params.companyName || 'Target Company'}

### JOB DESCRIPTION & REQUIREMENTS:
${params.jobDescription.trim()}

---

### CANDIDATE RESUME / PROFILE:
${params.resumeText.trim()}

Please analyze the match thoroughly and return the JSON evaluation.`;

  const parsedData = await callGeminiJSON<any>(systemPrompt, userContent, selectedModel);

  return {
    matchScore: Math.min(100, Math.max(0, Number(parsedData.matchScore) || 75)),
    matchTier:
      parsedData.matchTier ||
      (parsedData.matchScore >= 80 ? 'Strong Match' : parsedData.matchScore >= 65 ? 'Good Match' : 'Moderate Match'),
    summary: parsedData.summary || 'Resume analysis completed successfully.',
    matchingSkills: Array.isArray(parsedData.matchingSkills) ? parsedData.matchingSkills : [],
    missingKeywords: Array.isArray(parsedData.missingKeywords) ? parsedData.missingKeywords : [],
    strengths: Array.isArray(parsedData.strengths) ? parsedData.strengths : [],
    gaps: Array.isArray(parsedData.gaps) ? parsedData.gaps : [],
    bulletRewrites: Array.isArray(parsedData.bulletRewrites) ? parsedData.bulletRewrites : [],
    interviewTips: Array.isArray(parsedData.interviewTips) ? parsedData.interviewTips : [],
    tailoredPitch: parsedData.tailoredPitch || '',
    modelUsed: selectedModel,
    analyzedAt: new Date().toISOString(),
  };
}

export async function matchLeadsWithProfile(params: {
  profileText: string;
  leads: Array<{ id: string; title: string; company_name: string; tags: string[]; description: string }>;
  model?: AIModelId;
}): Promise<AILeadMatch[]> {
  const systemPrompt = `You are an AI Job Matching Specialist. Compare the candidate's real profile skills and portfolio against multiple job leads.
For each lead, calculate a dynamic matchScore (0-100), identify which skills overlap (matchedSkills), which skills/tools are missing (missingSkills), and give a 1-sentence personalized verdict (aiVerdict) explaining why the candidate fits or how to position themselves.

Respond strictly with valid JSON:
{
  "matches": [
    {
      "leadId": "string",
      "matchScore": number,
      "fitTier": "Strong Match" | "Good Match" | "Growth Role",
      "matchedSkills": ["skill1", "skill2"],
      "missingSkills": ["tool1", "tool2"],
      "aiVerdict": "1 sentence explanation"
    }
  ]
}`;

  const userContent = `### CANDIDATE PROFILE:
${params.profileText.trim()}

### JOB LEADS TO EVALUATE:
${JSON.stringify(params.leads, null, 2)}

Evaluate each lead and return the JSON matches array.`;

  const result = await callGeminiJSON<{ matches: AILeadMatch[] }>(systemPrompt, userContent, params.model);
  return Array.isArray(result.matches) ? result.matches : [];
}

export async function generateTailoredLeads(params: {
  profileText?: string;
  targetRole?: string;
  industry?: string;
  locationPreference?: string;
  count?: number;
  model?: AIModelId;
}): Promise<GeneratedLead[]> {
  const count = params.count || 6;
  const targetDomain = params.industry || params.targetRole || 'Professional Roles';
  const location = params.locationPreference || 'Metro Manila / Philippines';

  const systemPrompt = `You are an AI Executive Talent Scout & Web Job Market Researcher.
Your task is to search current real-world hiring trends and discover ${count} realistic, high-fit job postings for a candidate based on their target role, industry/domain, and location.

CRITICAL INSTRUCTIONS:
1. DOMAIN SPECIFICITY: Respect the candidate's target domain/role strictly. Do NOT force software/IT roles unless specifically requested. For Hospitality/Tourism (e.g., Marriott Manila, Shangri-La, Seda Hotels, Okada, The Peninsula, airlines, travel agencies, front desk, reservations, concierge), curate genuine hospitality employers and roles. For Marketing, Finance, Healthcare, Design, or IT, curate employers and positions fitting that domain.
2. REAL-WORLD EMPLOYERS: Use real, established companies, hotel groups, or organizations operating in ${location} or offering remote positions.
3. SEARCH URL: Provide a functional Google Jobs search query link for "search_url":
   Format: "https://www.google.com/search?q=" + encodeURIComponent(Company Name + " " + Role Title + " jobs hiring") + "&ibp=htl;jobs"
4. PRACTICAL DETAILS: Include realistic local salary estimates (e.g. ₱ PHP for Philippines, $ for global remote), key skill/qualification tags, match score (80-98), and a 1-sentence verdict on why this role fits.

Respond strictly with valid JSON:
{
  "leads": [
    {
      "id": "ai-lead-[unique-short-slug]",
      "title": "Exact Role Title",
      "company_name": "Company Name",
      "location": "Location (e.g. Pasay, Makati, BGC, or Remote)",
      "remote": boolean,
      "tags": ["Skill 1", "Tool / System", "Requirement"],
      "matched_skills": ["Key Strength 1", "Key Strength 2"],
      "match_score": number (80 to 98),
      "salary_range": "₱30,000 - ₱45,000 / mo" (or relevant currency),
      "job_types": ["Full-Time"],
      "description": "2 sentences describing core responsibilities and team scope",
      "search_url": "https://www.google.com/search?q=Company+Name+Role+Title+jobs+hiring&ibp=htl;jobs",
      "ai_verdict": "Why this role aligns with the candidate's background"
    }
  ]
}`;

  const userContent = `### TARGET CRITERIA:
Target Role / Keywords: ${params.targetRole || 'Open Opportunities'}
Industry / Domain Focus: ${targetDomain}
Location Preference: ${location}
${params.profileText ? `\n### CANDIDATE RESUME / PROFILE CONTEXT:\n${params.profileText.trim()}` : ''}
Desired Count: ${count}

Search and return the ${count} realistic job leads as JSON.`;

  const result = await callGeminiJSON<{ leads: GeneratedLead[] }>(systemPrompt, userContent, params.model);
  const leads = Array.isArray(result.leads) ? result.leads : [];
  return leads.map((lead) => ({
    ...lead,
    search_url: lead.search_url || `https://www.google.com/search?q=${encodeURIComponent(`${lead.company_name} ${lead.title} hiring jobs`)}&ibp=htl;jobs`,
    company_logo: lead.company_logo || `https://www.google.com/s2/favicons?domain=${lead.company_name.toLowerCase().replace(/[^a-z0-9]/g, '')}.com&sz=128`,
  }));
}

export async function generateLeadPitch(params: {
  profileText: string;
  leadTitle: string;
  companyName: string;
  leadDescription: string;
  model?: AIModelId;
}): Promise<{ pitch: string; hook: string; talkingPoints: string[] }> {
  const systemPrompt = `You are an expert Career Strategist and Hiring Pitch Writer. Write a high-converting, tailored application pitch message for a candidate applying to a specific role.
Include:
1. "pitch": A personalized 2-paragraph outreach / cover message ready to send to the recruiter or hiring manager on LinkedIn or email.
2. "hook": A punchy 1-sentence opening hook highlighting immediate impact and stack alignment.
3. "talkingPoints": 3 bullet points connecting candidate's past work directly to the company's needs.

Respond strictly with valid JSON:
{
  "pitch": "string",
  "hook": "string",
  "talkingPoints": ["point 1", "point 2", "point 3"]
}`;

  const userContent = `### CANDIDATE PROFILE:
${params.profileText.trim()}

### TARGET COMPANY: ${params.companyName}
### TARGET ROLE: ${params.leadTitle}
### JOB CONTEXT:
${params.leadDescription.trim()}

Generate the tailored pitch JSON.`;

  return callGeminiJSON<{ pitch: string; hook: string; talkingPoints: string[] }>(
    systemPrompt,
    userContent,
    params.model
  );
}
