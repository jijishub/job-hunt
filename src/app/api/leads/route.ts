import { getSessionAccount } from '@/lib/session-account';
import { NextResponse } from 'next/server';

// Retained for existing clients; discovery no longer supplies preset opportunities.
export async function GET() {
  const user = await getSessionAccount();
  if (!user) return NextResponse.json({ success: false, error: 'Sign in required.' }, { status: 401 });
  return NextResponse.json({ success: true, data: [], portfolioConnected: false });
}
