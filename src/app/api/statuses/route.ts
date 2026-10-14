import { APPLICATION_STATUSES } from '@/lib/application-validation';
import { NextResponse } from 'next/server';
import { getCustomStatuses, createCustomStatus, deleteCustomStatus, getApplications } from '@/lib/db';
import { getSessionAccount } from '@/lib/session-account';
import { ownsApplication } from '@/lib/ownership';
import { SEEDED_STATUS_OPTIONS, MEMBER_STATUS_OPTIONS, getStatusCategory, canonicalStatusName, StatusOption } from '@/lib/statuses';

export async function GET() {
  try {
    const user = await getSessionAccount();
    if (!user) return NextResponse.json({ success: false, error: 'Sign in required.' }, { status: 401 });
    const seeded = user.role === 'admin' ? SEEDED_STATUS_OPTIONS : MEMBER_STATUS_OPTIONS;
    const custom = (await getCustomStatuses()).filter(c => c.owner === user.id || (!c.owner && user.role === 'admin'));
    const customOptions: StatusOption[] = custom.map((c) => ({
      id: c.id,
      name: canonicalStatusName(c.name),
      color: c.color || 'default',
      category: c.category || getStatusCategory(c.name),
      isCustom: true,
    }));

    // Merge: SEEDED first, then custom ones that don't duplicate seeded names
    const seenNames = new Set(seeded.map((s) => s.name.toLowerCase()));
    const filteredCustom = customOptions.filter((c) => {
      const key = c.name.toLowerCase();
      if (seenNames.has(key)) return false;
      seenNames.add(key); return true;
    });

    const allStatuses = [...seeded, ...filteredCustom];
    const known = new Set(allStatuses.map(status => status.name.toLowerCase()));
    for (const app of (await getApplications(true, user, 'status')).filter(app => ownsApplication(app, user))) {
      for (const rawName of [app.notion_status, ...(app.stage_history || []).map(stage => stage.notion_status)]) {
        const name = rawName ? canonicalStatusName(rawName) : undefined;
        if (name && !known.has(name.toLowerCase())) { allStatuses.push({ id: name, name, color: 'default', category: getStatusCategory(name), isCustom: true }); known.add(name.toLowerCase()); }
      }
    }
    return NextResponse.json({ success: true, data: allStatuses });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to fetch statuses' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await getSessionAccount();
    if (!user) return NextResponse.json({ success: false, error: 'Sign in required.' }, { status: 401 });
    const body = await request.json();
    const { name, color, category } = body;

    if (typeof name !== 'string' || !name.trim()) {
      return NextResponse.json(
        { success: false, error: 'Status name is required' },
        { status: 400 }
      );
    }

    if (category != null && !APPLICATION_STATUSES.includes(category)) return NextResponse.json({ success: false, error: 'Invalid status category.' }, { status: 400 });
    const trimmedName = canonicalStatusName(name);
    const resolvedCategory = category || getStatusCategory(trimmedName);

    const created = await createCustomStatus({
      owner: user.id,
      name: trimmedName,
      color: color || 'default',
      category: resolvedCategory,
    });

    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to create status' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await getSessionAccount();
    if (!user) return NextResponse.json({ success: false, error: 'Sign in required.' }, { status: 401 });
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Status ID is required' },
        { status: 400 }
      );
    }

    const status = (await getCustomStatuses()).find(s => s.id === id && (s.owner === user.id || (!s.owner && user.role === 'admin')));
    if (!status) return NextResponse.json({ success: false, error: 'Status not found.' }, { status: 404 });
    await deleteCustomStatus(id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to delete status' },
      { status: 500 }
    );
  }
}
