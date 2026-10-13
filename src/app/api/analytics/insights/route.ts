import { NextResponse } from 'next/server';
import { getSessionAccount } from '@/lib/session-account';
import { getPipelineInsight } from '@/lib/db';
import { insightScope, pipelineInsightContext } from '@/lib/pipeline-insight-context';
export async function GET(request: Request) {
    const user = await getSessionAccount();
    if (!user)
        return NextResponse.json({ success: false, error: 'Sign in required.' }, { status: 401 });
    const scope = insightScope(new URL(request.url).searchParams.get('scope'));
    if (!scope)
        return NextResponse.json({ success: false, error: 'Invalid analytics scope.' }, { status: 400 });
    try {
        const [report, context] = await Promise.all([getPipelineInsight(user.id, scope), pipelineInsightContext(user, scope)]);
        return NextResponse.json({ success: true, data: { report, currentVersion: context.snapshotVersion, outdated: Boolean(report && report.snapshotVersion !== context.snapshotVersion) } }, { headers: { 'Cache-Control': 'private, no-store' } });
    }
    catch {
        return NextResponse.json({ success: false, error: 'Saved insights could not be loaded. Your analytics remain available.' }, { status: 503 });
    }
}
