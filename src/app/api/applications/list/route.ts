import { observedJson } from '@/lib/api-observability';
import { NextResponse } from 'next/server';
import { getSessionAccount } from '@/lib/session-account';
import { getApplicationList } from '@/lib/application-list';

// POST avoids large ID lists in URLs and access logs. This endpoint is read-only.
export async function POST(request: Request) {
  const user = await getSessionAccount();
  if (!user) return NextResponse.json({ success: false, error: 'Sign in required.' }, { status: 401 });
  try {
    const { ids, offset = 0, limit = 25 } = await request.json();
    if (!Array.isArray(ids) || ids.length > 10000 || !ids.every(id => typeof id === 'string' && id.length <= 200) || !Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(limit) || limit < 1 || limit > 100) return NextResponse.json({ success: false, error: 'Invalid page parameters.' }, { status: 400 });
    const result = await getApplicationList(user, { ids: ids.slice(offset,offset + limit), limit, offset: 0 });
    const byId = new Map(result.data.map(app => [app.id,app]));
    return observedJson('applications.page', { success: true, paged: true, data: ids.slice(offset,offset + limit).flatMap(id => byId.has(id) ? [byId.get(id)] : []) }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch { return NextResponse.json({ success: false, error: 'Application page could not be loaded.' }, { status: 500 }); }
}
