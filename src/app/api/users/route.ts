import { getSessionAccount } from '@/lib/session-account';
import { NextResponse } from 'next/server';
import { getUsers, createUser } from '@/lib/db';

export async function GET() {
  try {
    const account = await getSessionAccount();
    if (!account) return NextResponse.json({ success: false, error: 'Sign in required.' }, { status: 401 });
    const users = await getUsers();
    return NextResponse.json({ success: true, data: account.role === 'admin' ? users : users.filter(user => user.id === account.id) });
  } catch (error: any) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch users' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const account = await getSessionAccount();
    if (!account) return NextResponse.json({ success: false, error: 'Sign in required.' }, { status: 401 });
    if (account.role !== 'admin') return NextResponse.json({ success: false, error: 'Admin access required.' }, { status: 403 });
    const body = await req.json();
    if (!body.name || !body.email) {
      return NextResponse.json(
        { success: false, error: 'Name and email are required' },
        { status: 400 }
      );
    }

    const newUser = await createUser(body);
    return NextResponse.json({ success: true, data: newUser });
  } catch (error: any) {
    console.error('Error creating user:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create user' },
      { status: 500 }
    );
  }
}
