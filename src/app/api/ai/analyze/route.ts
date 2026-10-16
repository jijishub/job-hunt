import { NextResponse } from 'next/server';
import { analyzeResumeWithGemini, AVAILABLE_AI_MODELS, getAIConfig, AIModelId } from '@/lib/ai';
import { getSessionAccount } from '@/lib/session-account';
import { candidateEvidence } from '@/lib/candidate-evidence';
import { getApplicationById } from '@/lib/db';
import { ownsApplication } from '@/lib/ownership';

// Leave room for authentication/database reads around the 150-second AI call.
export const maxDuration = 180;

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
  const startedAt = Date.now();
  try {
    const user = await getSessionAccount();
    if (!user) return NextResponse.json({ success: false, error: 'Sign in required.' }, { status: 401 });
    const body = await request.json();
    const { jobTitle, companyName, model } = body;
    const app = body.applicationId ? await getApplicationById(body.applicationId, user) : null;
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
    const timedOut = ['TimeoutError', 'AbortError'].includes(error?.name);
    console.warn('ATS analysis failed', { kind: error?.name || 'Error', elapsedMs: Date.now() - startedAt });
    return NextResponse.json(
      { success: false, error: timedOut ? 'The AI service did not finish the ATS report in time. Try again later or choose a faster model.' : error?.message || 'Failed to analyze resume with AI.', ...(timedOut ? { code: 'AI_TIMEOUT' } : {}) },
      { status: timedOut ? 504 : 500 }
    );
  }
}
