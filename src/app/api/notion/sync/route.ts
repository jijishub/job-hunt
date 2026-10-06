import { NextResponse } from 'next/server';
import { getNotionConfig, testNotionConnection, performTwoWaySync } from '@/lib/notion';
import { getApplications, getCompanies } from '@/lib/db';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
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
    const result = await performTwoWaySync();
    const apps = await getApplications();
    const comps = await getCompanies();
    return NextResponse.json({ ...result, data: apps, companies: comps });
  } catch (error: any) {
    console.error('Error during Notion sync:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to sync with Notion' },
      { status: 500 }
    );
  }
}

