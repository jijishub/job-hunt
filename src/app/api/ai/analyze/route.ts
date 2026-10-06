import { NextResponse } from 'next/server';
import { analyzeResumeWithGemini, AVAILABLE_AI_MODELS, getAIConfig, AIModelId } from '@/lib/ai';

export async function GET() {
  try {
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
    const body = await request.json();
    const { resumeText, jobTitle, companyName, jobDescription, model } = body;

    if (!resumeText || !resumeText.trim()) {
      return NextResponse.json(
        { success: false, error: 'Resume text is required for analysis.' },
        { status: 400 }
      );
    }

    if (!jobDescription || !jobDescription.trim()) {
      return NextResponse.json(
        { success: false, error: 'Job description or target role requirements are required for matching.' },
        { status: 400 }
      );
    }

    const result = await analyzeResumeWithGemini({
      resumeText: resumeText.trim(),
      jobTitle: jobTitle?.trim(),
      companyName: companyName?.trim(),
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
