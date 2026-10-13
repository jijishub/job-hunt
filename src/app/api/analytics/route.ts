import { NextResponse } from 'next/server';
import { getSessionAccount } from '@/lib/session-account';
import { getAccountAnalytics } from '@/lib/analytics-service';

export async function GET(request: Request) {
  const user = await getSessionAccount();
  if (!user) return NextResponse.json({ success: false, error: 'Sign in required.' }, { status: 401 });
  const scope = new URL(request.url).searchParams.get('scope') || 'ALL';
  if (!['ALL', 'INTERNSHIP', 'OTHER'].includes(scope)) return NextResponse.json({ success: false, error: 'Invalid analytics scope.' }, { status: 400 });
  try {
    const { stats } = await getAccountAnalytics(user, scope);
    return NextResponse.json({ success: true, data: stats }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch {
    return NextResponse.json({ success: false, error: 'Analytics could not be loaded.' }, { status: 500 });
  }
}
