import { NextResponse } from 'next/server';
import { getSessionAccount } from '@/lib/session-account';
import { getCandidatePreferences, saveCandidatePreferences } from '@/lib/db';
import { validatePreferences, EMPTY_PREFERENCES } from '@/lib/preferences';
import { normalizeJobPlatform, JOB_PLATFORMS } from '@/lib/application-analytics-fields';
export async function GET() {
  const user = await getSessionAccount();
  if (!user) return NextResponse.json({ success: false, error: 'Sign in required.' }, { status: 401 });
  return NextResponse.json({ success: true, data: { ...EMPTY_PREFERENCES, ...await getCandidatePreferences(user.id) } });
}
export async function PUT(request: Request) {
  const user = await getSessionAccount();
  if (!user) return NextResponse.json({ success: false, error: 'Sign in required.' }, { status: 401 });
  try {
    const body = await request.json();
    const existing = await getCandidatePreferences(user.id);
    const data = validatePreferences({ ...body, job_platform_options: existing?.job_platform_options || [] });
    await saveCandidatePreferences(user.id, data);
    return NextResponse.json({ success: true, data });
  } catch (error) { return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Preferences could not be saved.' }, { status: 400 }); }
}

export async function PATCH(request: Request) {
  const user = await getSessionAccount();
  if (!user) return NextResponse.json({ success: false, error: 'Sign in required.' }, { status: 401 });
  try {
    const body = await request.json();
    if (typeof body.job_platform !== 'string' || !body.job_platform.trim() || body.job_platform.length > 200) {
      return NextResponse.json({ success: false, error: 'Enter a platform name between 1 and 200 characters.' }, { status: 400 });
    }
    const platform = normalizeJobPlatform(body.job_platform)!;
    const existing = await getCandidatePreferences(user.id);
    const options = [...new Set([...(existing?.job_platform_options || []), platform])].filter(name => !JOB_PLATFORMS.some(item => item === name));
    const data = validatePreferences({ ...EMPTY_PREFERENCES, ...existing, job_platform_options: options });
    await saveCandidatePreferences(user.id, data);
    return NextResponse.json({ success: true, data, platform });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Platform could not be saved.' }, { status: 400 });
  }
}
