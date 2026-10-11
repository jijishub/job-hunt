import { NextResponse } from 'next/server';
import { getSessionAccount } from '@/lib/session-account';
import { getCandidateProfile, saveCandidateProfile } from '@/lib/db';
import activeResume from '@/lib/active-resume.json';

export async function GET() {
  const user = await getSessionAccount();
  if (!user) return NextResponse.json({ success: false, error: 'Sign in to access your resume.' }, { status: 401 });
  const saved = await getCandidateProfile(user.id);
  return NextResponse.json({ success: true, resumeText: saved || (user.email === 'jizelle.casia@gmail.com' ? activeResume.resume_text : '') });
}
export async function PUT(request: Request) {
  const user = await getSessionAccount();
  if (!user) return NextResponse.json({ success: false, error: 'Sign in to save your resume.' }, { status: 401 });
  const body = await request.json();
  if (typeof body.resumeText !== 'string' || !body.resumeText.trim() || body.resumeText.length > 60000) {
    return NextResponse.json({ success: false, error: 'Paste resume text between 1 and 60,000 characters.' }, { status: 400 });
  }
  await saveCandidateProfile(user.id, body.resumeText.trim());
  return NextResponse.json({ success: true });
}
