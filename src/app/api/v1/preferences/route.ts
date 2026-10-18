import { authenticateExtensionCredential } from '@/lib/capture-store';
import { captureFailure, captureResponse } from '@/lib/capture-http';
import { extensionPreferenceSnapshot } from '@/lib/extension-preferences';

export async function GET(request: Request) {
  try {
    const user = await authenticateExtensionCredential(request, 'preferences:read');
    const snapshot = await extensionPreferenceSnapshot(user);
    const etag = `"${snapshot.revision}"`;
    if (request.headers.get('if-none-match') === etag) return new Response(null, { status: 304, headers: { ETag: etag, 'Cache-Control': 'private, no-store' } });
    return captureResponse(snapshot, 200, { ETag: etag });
  } catch (error) { return captureFailure(error); }
}
