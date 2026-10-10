import { getSessionAccount } from '@/lib/session-account';
import { NextResponse } from 'next/server';
import { updateUser, deleteUser, getUserById } from '@/lib/db';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const account = await getSessionAccount();
    if (!account) return NextResponse.json({ success: false, error: 'Sign in required.' }, { status: 401 });
    const { id } = await params;
    if (account.role !== 'admin' && account.id !== id) return NextResponse.json({ success: false, error: 'User not found.' }, { status: 404 });
    const user = await getUserById(id);
    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: user });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const account = await getSessionAccount();
    if (!account) return NextResponse.json({ success: false, error: 'Sign in required.' }, { status: 401 });
    const { id } = await params;
    if (account.role !== 'admin') return NextResponse.json({ success: false, error: 'Admin access required.' }, { status: 403 });
    const body = await req.json();
    const updated = await updateUser(id, body);
    if (!updated) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const account = await getSessionAccount();
    if (!account) return NextResponse.json({ success: false, error: 'Sign in required.' }, { status: 401 });
    const { id } = await params;
    if (account.role !== 'admin') return NextResponse.json({ success: false, error: 'Admin access required.' }, { status: 403 });
    const success = await deleteUser(id);
    return NextResponse.json({ success });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
