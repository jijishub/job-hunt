import { setTimeout as delay } from 'node:timers/promises';
import { authenticateExtensionCredential } from '@/lib/capture-store';
import { captureFailure } from '@/lib/capture-http';
import { CaptureError } from '@/lib/capture-validation';
import { extensionPreferenceSnapshot } from '@/lib/extension-preferences';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: Request) {
  try {
    const user = await authenticateExtensionCredential(request, 'preferences:read');
    const initial = await extensionPreferenceSnapshot(user);
    let revision = initial.revision;
    let closed = false;
    const started = Date.now();
    const lifetime = new AbortController();
    const encoder = new TextEncoder();
    const frame = (event: string, data: unknown, id?: string) => encoder.encode(`${id ? `id: ${id}\n` : ''}event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    const abort = () => lifetime.abort();
    request.signal.addEventListener('abort', abort, { once: true });
    if (request.signal.aborted) abort();
    const cleanup = () => { closed = true; lifetime.abort(); request.signal.removeEventListener('abort', abort); };
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('retry: 2000\n\n'));
        controller.enqueue(frame('preferences.snapshot', initial, revision));
      },
      async pull(controller) {
        if (closed) return;
        try {
          await delay(10000, undefined, { signal: lifetime.signal });
          if (closed) return;
          // Recheck scope, expiry, account existence and revocation before every read.
          const currentUser = await authenticateExtensionCredential(request, 'preferences:read');
          if (closed) return;
          const current = await extensionPreferenceSnapshot(currentUser);
          if (closed) return;
          if (current.revision !== revision) {
            revision = current.revision;
            controller.enqueue(frame('preferences.changed', current, revision));
          } else controller.enqueue(encoder.encode(': heartbeat\n\n'));
          // Bounded streams work across serverless instances; reconnect gets latest state.
          if (Date.now() - started >= 45000) {
            controller.enqueue(frame('reconnect', { retry_ms: 2000 }));
            cleanup(); controller.close();
          }
        } catch (error) {
          if (closed) return;
          if (!request.signal.aborted) controller.enqueue(frame('stream.error', {
            code: error instanceof CaptureError ? error.code : 'PREFERENCES_UNAVAILABLE',
            retryable: !(error instanceof CaptureError && [401, 403].includes(error.status)),
          }));
          cleanup(); controller.close();
        }
      },
      cancel() { cleanup(); },
    });
    return new Response(stream, { headers: {
      'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'private, no-store, no-transform',
      'CDN-Cache-Control': 'no-store', 'Vercel-CDN-Cache-Control': 'no-store', 'X-Accel-Buffering': 'no',
    } });
  } catch (error) { return captureFailure(error); }
}
