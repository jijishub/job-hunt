import { authenticateExtensionCredential, persistCapture, getCaptureReceipts } from '@/lib/capture-store';
import { captureFailure, captureResponse } from '@/lib/capture-http';
import { CaptureError, captureUuid, readCaptureJson, validateCapture } from '@/lib/capture-validation';

export const maxDuration = 60;
export async function POST(request: Request) {
  try {
    const user = await authenticateExtensionCredential(request, 'captures:write');
    const validated = validateCapture(await readCaptureJson(request), request.headers.get('idempotency-key'));
    const result = await persistCapture(user, validated);
    return captureResponse(result.receipt, result.created ? 201 : 200, { ETag: '"1"' });
  } catch (error) { return captureFailure(error); }
}
export async function GET(request: Request) {
  try {
    const user = await authenticateExtensionCredential(request, 'captures:read');
    const ids = new URL(request.url).searchParams.get('ids')?.split(',') || [];
    if (!ids.length || ids.length > 50 || ids.some(id => !captureUuid(id))) throw new CaptureError(422, 'INVALID_IDS', 'Supply 1–50 capture UUIDs.');
    return captureResponse({ captures: await getCaptureReceipts(user.id, [...new Set(ids)]) });
  } catch (error) { return captureFailure(error); }
}
