import { NextResponse } from 'next/server';
import { matchLeadsWithProfile, AIModelId } from '@/lib/ai';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { profileText, leads, model } = body;

    if (!profileText || !profileText.trim()) {
      return NextResponse.json(
        { success: false, error: 'Candidate profile text is required for AI matching.' },
        { status: 400 }
      );
    }

    if (!Array.isArray(leads) || leads.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Leads array is required.' },
        { status: 400 }
      );
    }

    const matches = await matchLeadsWithProfile({
      profileText: profileText.trim(),
      leads: leads.map((l: any) => ({
        id: l.id,
        title: l.title,
        company_name: l.company_name,
        tags: l.tags || [],
        description: l.description || '',
      })),
      model: model as AIModelId | undefined,
    });

    return NextResponse.json({
      success: true,
      matches,
    });
  } catch (error: any) {
    console.error('AI lead match error:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to match leads with AI.' },
      { status: 500 }
    );
  }
}
