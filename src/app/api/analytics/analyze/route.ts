import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { getSessionAccount } from '@/lib/session-account';
import { claimPipelineInsight, savePipelineInsight, releasePipelineInsight } from '@/lib/db';
import { insightScope, pipelineInsightContext } from '@/lib/pipeline-insight-context';
import { PIPELINE_INSIGHT_PROMPT, validatePipelineInsight } from '@/lib/pipeline-insights';
import { callGeminiJSON } from '@/lib/ai';
import { OPTIONAL_AI_TIMEOUT_MS } from '@/lib/ai-request-limits';
export const maxDuration = 60;
export async function POST(request: Request) {
    const user = await getSessionAccount();
    if (!user)
        return NextResponse.json({ success: false, error: 'Sign in required.' }, { status: 401 });
    let scope;
    try {
        const body = await request.json();
        if (!body || typeof body !== 'object' || Array.isArray(body))
            throw Error();
        scope = insightScope(body.scope);
    }
    catch {
        return NextResponse.json({ success: false, error: 'Provide a valid analytics request.' }, { status: 400 });
    }
    if (!scope)
        return NextResponse.json({ success: false, error: 'Invalid analytics scope.' }, { status: 400 });
    const token = randomUUID();
    let claimed = false;
    try {
        const context = await pipelineInsightContext(user, scope);
        if (!context.applications.length)
            return NextResponse.json({ success: false, error: 'Track applications before analyzing your pipeline.' }, { status: 422 });
        claimed = await claimPipelineInsight(user.id, scope, token);
        if (!claimed)
            return NextResponse.json({ success: false, error: 'An analysis is already running for this scope. Please wait before trying again.' }, { status: 409 });
        const raw = await callGeminiJSON<unknown>(PIPELINE_INSIGHT_PROMPT, JSON.stringify(context.payload), undefined, { timeoutMs: OPTIONAL_AI_TIMEOUT_MS, maxOutputTokens: 2200 });
        const report = validatePipelineInsight(raw, context.catalog, { scope, generatedAt: new Date().toISOString(), snapshotVersion: context.snapshotVersion, reportingDate: context.stats.asOf }, context.limitations);
        if (!await savePipelineInsight(user.id, scope, report, token))
            throw new Error('The insight could not be saved. Your last successful analysis is still available.');
        const current = await pipelineInsightContext(user, scope);
        return NextResponse.json({ success: true, data: { report, currentVersion: current.snapshotVersion, outdated: current.snapshotVersion !== report.snapshotVersion } }, { headers: { 'Cache-Control': 'private, no-store' } });
    }
    catch (error) {
        const message = error instanceof Error && ['TimeoutError', 'AbortError'].includes(error.name) ? 'AI did not respond in time. Your analytics remain available; try again later.' : error instanceof Error && /AI returned an (invalid insight|unsupported numerical claim)|insight could not be saved/.test(error.message) ? error.message : 'AI insights are unavailable right now. Your analytics and last successful analysis remain available.';
        return NextResponse.json({ success: false, error: message }, { status: 502 });
    }
    finally {
        if (claimed)
            await releasePipelineInsight(user.id, scope, token).catch(() => { });
    }
}
