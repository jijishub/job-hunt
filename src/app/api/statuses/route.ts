import { NextResponse } from 'next/server';
import { getCustomStatuses, createCustomStatus, deleteCustomStatus } from '@/lib/db';
import { SEEDED_STATUS_OPTIONS, getStatusCategory, StatusOption } from '@/lib/statuses';

export async function GET() {
  try {
    const custom = await getCustomStatuses();
    const customOptions: StatusOption[] = custom.map((c) => ({
      id: c.id,
      name: c.name,
      color: c.color || 'default',
      category: c.category || getStatusCategory(c.name),
      isCustom: true,
    }));

    // Merge: SEEDED first, then custom ones that don't duplicate seeded names
    const seenNames = new Set(SEEDED_STATUS_OPTIONS.map((s) => s.name.toLowerCase()));
    const filteredCustom = customOptions.filter((c) => !seenNames.has(c.name.toLowerCase()));

    const allStatuses = [...SEEDED_STATUS_OPTIONS, ...filteredCustom];
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
    const body = await request.json();
    const { name, color, category } = body;

    if (!name || !name.trim()) {
      return NextResponse.json(
        { success: false, error: 'Status name is required' },
        { status: 400 }
      );
    }

    const trimmedName = name.trim();
    const resolvedCategory = category || getStatusCategory(trimmedName);

    const created = await createCustomStatus({
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
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Status ID is required' },
        { status: 400 }
      );
    }

    await deleteCustomStatus(id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to delete status' },
      { status: 500 }
    );
  }
}
