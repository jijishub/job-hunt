import { getSessionAccount } from '@/lib/session-account';
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { randomBytes } from 'node:crypto';

const ENV_PATH = path.join(process.cwd(), '.env.local');

export async function GET(req: Request) {
  const user = await getSessionAccount();
  if (!user) return NextResponse.json({ success: false, error: 'Sign in required.' }, { status: 401 });
  if (user.role !== 'admin') return NextResponse.json({ success: false, error: 'Admin access required.' }, { status: 403 });
  try {
    const origin = req.headers.get('origin') || req.headers.get('host') || 'http://localhost:3000';
    const baseUrl = origin.startsWith('http') ? origin : `http://${origin}`;
    const redirectUri = `${baseUrl}/api/auth/callback/google`;

    const clientId = process.env.GOOGLE_CLIENT_ID || '';
    const hasSecret = Boolean(process.env.GOOGLE_CLIENT_SECRET);
    const isConfigured = Boolean(clientId && hasSecret);

    return NextResponse.json({
      success: true,
      isConfigured,
      clientId,
      hasSecret,
      redirectUri,
      origin: baseUrl,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to load Google SSO settings' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  const user = await getSessionAccount();
  if (!user) return NextResponse.json({ success: false, error: 'Sign in required.' }, { status: 401 });
  if (user.role !== 'admin') return NextResponse.json({ success: false, error: 'Admin access required.' }, { status: 403 });
  try {
    const body = await req.json();
    const clientId = (body.clientId || '').trim();
    const clientSecret = (body.clientSecret || '').trim();

    if (!clientId) {
      return NextResponse.json(
        { success: false, error: 'Google Client ID is required.' },
        { status: 400 }
      );
    }

    // Update in-memory environment variables immediately
    process.env.GOOGLE_CLIENT_ID = clientId;
    if (clientSecret) {
      process.env.GOOGLE_CLIENT_SECRET = clientSecret;
    }

    // Persist to .env.local
    let envContent = '';
    if (fs.existsSync(ENV_PATH)) {
      envContent = fs.readFileSync(ENV_PATH, 'utf-8');
    }

    const lines = envContent.split(/\r?\n/);
    const newLines: string[] = [];
    let foundClientId = false;
    let foundClientSecret = false;
    let foundNextAuthSecret = false;

    for (const line of lines) {
      if (line.startsWith('GOOGLE_CLIENT_ID=')) {
        newLines.push(`GOOGLE_CLIENT_ID=${clientId}`);
        foundClientId = true;
      } else if (line.startsWith('GOOGLE_CLIENT_SECRET=')) {
        if (clientSecret) {
          newLines.push(`GOOGLE_CLIENT_SECRET=${clientSecret}`);
        } else {
          newLines.push(line);
        }
        foundClientSecret = true;
      } else if (line.startsWith('NEXTAUTH_URL=')) {
        newLines.push(line);
      } else if (line.startsWith('NEXTAUTH_SECRET=')) {
        newLines.push(line);
        foundNextAuthSecret = true;
      } else {
        newLines.push(line);
      }
    }

    if (!foundClientId) {
      newLines.push(`GOOGLE_CLIENT_ID=${clientId}`);
    }
    if (!foundClientSecret && clientSecret) {
      newLines.push(`GOOGLE_CLIENT_SECRET=${clientSecret}`);
    }
    const generatedAuthSecret = !foundNextAuthSecret && !process.env.NEXTAUTH_SECRET
      ? randomBytes(32).toString('hex') : undefined;
    if (generatedAuthSecret) newLines.push(`NEXTAUTH_SECRET=${generatedAuthSecret}`);

    fs.writeFileSync(ENV_PATH, newLines.join('\n'), 'utf-8');
    if (generatedAuthSecret) process.env.NEXTAUTH_SECRET = generatedAuthSecret;

    return NextResponse.json({
      success: true,
      isConfigured: true,
      message: 'Google SSO credentials saved to .env.local and activated!',
    });
  } catch (error: any) {
    console.error('Error saving Google SSO settings:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to save Google SSO settings' },
      { status: 500 }
    );
  }
}
