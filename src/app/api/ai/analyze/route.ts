import { NextResponse } from 'next/server';
import { analyzeResumeWithGemini, AVAILABLE_AI_MODELS, getAIConfig, AIModelId } from '@/lib/ai';
import { getSessionAccount } from '@/lib/session-account';
import { candidateEvidence } from '@/lib/candidate-evidence';
import { getApplicationById } from '@/lib/db';
import { ownsApplication } from '@/lib/ownership';

export const maxDuration = 60;

export async function GET() {
  try {
    if (!await getSessionAccount()) return NextResponse.json({ success: false, error: 'Sign in required.' }, { status: 401 });
    const config = getAIConfig();
    return NextResponse.json({
      success: true,
      configured: config.isConfigured,
      models: AVAILABLE_AI_MODELS,
      defaultModel: config.defaultModel,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to retrieve AI configuration' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await getSessionAccount();
    if (!user) return NextResponse.json({ success: false, error: 'Sign in required.' }, { status: 401 });
    const body = await request.json();
    const { jobTitle, companyName, model } = body;
    const app = body.applicationId ? await getApplicationById(body.applicationId) : null;
    if (body.applicationId && (!app || !ownsApplication(app, user))) return NextResponse.json({ success: false, error: 'Application not found.' }, { status: 404 });
    const evidence = await candidateEvidence(user);
    const resumeText = user.role === 'admin' && typeof body.resumeText === 'string' && body.resumeText.trim() ? body.resumeText : evidence.text;
    const jobDescription = app ? app.information || app.job_description : body.jobDescription;

    if (!resumeText || !resumeText.trim()) {
      return NextResponse.json(
        { success: false, error: 'Resume text is required for analysis.' },
        { status: 400 }
      );
    }

    if (typeof jobDescription !== 'string' || jobDescription.trim().length < 30) {
      return NextResponse.json(
        { success: false, error: 'Add the actual job requirements (at least 30 characters) before matching.' },
        { status: 400 }
      );
    }

    const result = await analyzeResumeWithGemini({
      resumeText: resumeText.trim(),
      jobTitle: app?.role_title || (typeof jobTitle === 'string' ? jobTitle.trim() : undefined),
      companyName: app?.company_name || (typeof companyName === 'string' ? companyName.trim() : undefined),
      jobDescription: jobDescription.trim(),
      model: model as AIModelId | undefined,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('AI resume analysis error:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to analyze resume with AI.' },
      { status: 500 }
    );
  }
}
