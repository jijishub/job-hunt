import { NextResponse } from 'next/server';
import { pullApplicationsFromNotion } from '@/lib/notion';

export async function POST(request: Request) {
  try {
    const webhookSecret = process.env.NOTION_WEBHOOK_SECRET;
    if (webhookSecret) {
      const headerSecret = request.headers.get('x-notion-secret');
      if (headerSecret !== webhookSecret) {
        return NextResponse.json({ error: 'Unauthorized webhook request' }, { status: 401 });
      }
    }

    const payload = await request.json().catch(() => ({}));

    if (payload.verification_token) {
      return NextResponse.json({ verification_token: payload.verification_token });
    }

    const pullResult = await pullApplicationsFromNotion();

    return NextResponse.json({
      received: true,
      synced: pullResult.count,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Error handling Notion webhook:', error);
    return NextResponse.json({ error: error?.message || 'Webhook failed' }, { status: 500 });
  }
}

