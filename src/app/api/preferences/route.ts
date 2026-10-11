import { NextResponse } from 'next/server';
import { getSessionAccount } from '@/lib/session-account';
import { getCandidatePreferences, saveCandidatePreferences } from '@/lib/db';
import { validatePreferences, EMPTY_PREFERENCES } from '@/lib/preferences';
export async function GET() {
  const user = await getSessionAccount();
  if (!user) return NextResponse.json({ success: false, error: 'Sign in required.' }, { status: 401 });
  return NextResponse.json({ success: true, data: { ...EMPTY_PREFERENCES, ...await getCandidatePreferences(user.id) } });
}
export async function PUT(request: Request) {
  const user = await getSessionAccount();
  if (!user) return NextResponse.json({ success: false, error: 'Sign in required.' }, { status: 401 });
  try {
    const data = validatePreferences(await request.json());
    await saveCandidatePreferences(user.id, data);
    return NextResponse.json({ success: true, data });
  } catch (error) { return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Preferences could not be saved.' }, { status: 400 }); }
}
