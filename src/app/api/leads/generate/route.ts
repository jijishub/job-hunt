import { getSessionAccount } from '@/lib/session-account';
import { candidateEvidence } from '@/lib/candidate-evidence';
import { NextResponse } from 'next/server';
import { generateTailoredLeads, AIModelId } from '@/lib/ai';

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const user = await getSessionAccount();
    if (!user) return NextResponse.json({ success: false, error: 'Sign in required.' }, { status: 401 });
    const body = await request.json();
    const evidence = await candidateEvidence(user);
    const profileText = evidence.text;
    if (!profileText && body.useResumeContext !== false) return NextResponse.json({ success: false, error: 'Save your master resume in My preferences before requesting search ideas.' }, { status: 422 });
    const { targetRole, industry, locationPreference, count, model } = body;
    if ([targetRole, industry, locationPreference].some(value => value != null && typeof value !== 'string') || (count != null && (!Number.isInteger(Number(count)) || Number(count) < 1 || Number(count) > 12))) return NextResponse.json({ success: false, error: 'Use text search criteria and a count between 1 and 12.' }, { status: 400 });

    if (
      (!profileText || !profileText.trim()) &&
      (!targetRole || !targetRole.trim()) &&
      (!industry || !industry.trim())
    ) {
      return NextResponse.json(
        { success: false, error: 'Target role, industry, or candidate profile is required to search job postings.' },
        { status: 400 }
      );
    }

    const generatedLeads = await generateTailoredLeads({
      profileText: body.useResumeContext === false ? undefined : profileText,
      targetRole: targetRole?.trim(),
      industry: industry?.trim(),
      locationPreference: locationPreference?.trim(),
      count: count ? Number(count) : 6,
      model: model as AIModelId | undefined,
    });

    return NextResponse.json({
      success: true,
      data: generatedLeads, kind: 'SEARCH_IDEAS',
    });
  } catch (error: any) {
    const timedOut = error instanceof Error && ['TimeoutError', 'AbortError'].includes(error.name);
    return NextResponse.json(
      { success: false, error: timedOut ? 'AI did not respond in time. Your last keywords are still available. Try again later.' : error?.message || 'Failed to generate tailored leads with AI.' },
      { status: timedOut ? 504 : 502 }
    );
  }
}
