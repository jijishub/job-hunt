import { getSessionAccount } from '@/lib/session-account';
import { ownsApplication } from '@/lib/ownership';
import { NextResponse } from 'next/server';
import { getNotionConfig, testNotionConnection, performTwoWaySync } from '@/lib/notion';
import { getApplications, getCompanies } from '@/lib/db';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await getSessionAccount();
    if (!user) return NextResponse.json({ success: false, error: 'Sign in required.' }, { status: 401 });
    if (user.role !== 'admin' || !user.notion_enabled) return NextResponse.json({ configured: false, success: false, error: 'Notion sync is unavailable for this account.' }, { status: 403 });
    const config = getNotionConfig();
    const test = await testNotionConnection();
    return NextResponse.json({
      configured: config.isConfigured,
      databaseId: config.databaseId,
      status: test,
    });
  } catch (error: any) {
    return NextResponse.json(
      { configured: false, error: error?.message || 'Error checking Notion status' },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    const user = await getSessionAccount();
    if (!user) return NextResponse.json({ success: false, error: 'Sign in required.' }, { status: 401 });
    if (user.role !== 'admin' || !user.notion_enabled) return NextResponse.json({ configured: false, success: false, error: 'Notion sync is unavailable for this account.' }, { status: 403 });
    const result = await performTwoWaySync();
    const apps = await getApplications();
    const comps = await getCompanies();
    return NextResponse.json({ ...result, data: apps.filter(app => ownsApplication(app, user)), companies: comps.filter(company => apps.some(app => ownsApplication(app, user) && app.company_id === company.id) || company.created_by === user.id || company.created_by === user.email || (user.id === 'user_ji' && !company.created_by)) });
  } catch (error: any) {
    console.error('Error during Notion sync:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to sync with Notion' },
      { status: 500 }
    );
  }
}

