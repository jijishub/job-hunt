import { getSessionAccount } from '@/lib/session-account';
import { candidateEvidence } from '@/lib/candidate-evidence';
import { NextResponse } from 'next/server';
import { generateLeadPitch, AIModelId } from '@/lib/ai';

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const user = await getSessionAccount();
    if (!user) return NextResponse.json({ success: false, error: 'Sign in required.' }, { status: 401 });
    const body = await request.json();
    const evidence = await candidateEvidence(user);
    const profileText = evidence.text;
    const { leadTitle, companyName, leadDescription, model } = body;

    if (!profileText || !profileText.trim()) {
      return NextResponse.json(
        { success: false, error: 'Candidate profile text is required to write a tailored pitch.' },
        { status: 400 }
      );
    }

    if (!leadTitle || !companyName) {
      return NextResponse.json(
        { success: false, error: 'Lead title and company name are required.' },
        { status: 400 }
      );
    }

    const pitchData = await generateLeadPitch({
      profileText: profileText.trim(),
      leadTitle: leadTitle.trim(),
      companyName: companyName.trim(),
      leadDescription: leadDescription || `${leadTitle} at ${companyName}`,
      model: model as AIModelId | undefined,
    });

    return NextResponse.json({
      success: true,
      data: pitchData,
    });
  } catch (error: any) {
    console.error('AI lead pitch error:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to generate tailored pitch with AI.' },
      { status: 500 }
    );
  }
}
