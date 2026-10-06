import { NextResponse } from 'next/server';
import { generateTailoredLeads, AIModelId } from '@/lib/ai';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { profileText, targetRole, locationPreference, count, model } = body;

    if (!profileText || !profileText.trim()) {
      return NextResponse.json(
        { success: false, error: 'Candidate profile text is required to discover tailored leads.' },
        { status: 400 }
      );
    }

    const generatedLeads = await generateTailoredLeads({
      profileText: profileText.trim(),
      targetRole: targetRole?.trim(),
      locationPreference: locationPreference?.trim(),
      count: count ? Number(count) : 5,
      model: model as AIModelId | undefined,
    });

    return NextResponse.json({
      success: true,
      data: generatedLeads,
    });
  } catch (error: any) {
    console.error('AI lead discovery error:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to generate tailored leads with AI.' },
      { status: 500 }
    );
  }
}
