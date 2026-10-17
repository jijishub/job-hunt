import { getSessionAccount } from '@/lib/session-account';
import { issueExtensionCredential, listExtensionCredentials, revokeExtensionCredential } from '@/lib/capture-store';
import { captureFailure, captureResponse, requireSameOrigin } from '@/lib/capture-http';
import { CaptureError, captureUuid, readCaptureJson } from '@/lib/capture-validation';

export async function GET() {
  try {
    const user = await getSessionAccount();
    if (!user) throw new CaptureError(401, 'SIGN_IN_REQUIRED', 'Sign in to manage extension credentials.');
    return captureResponse({ success: true, data: await listExtensionCredentials(user.id) });
  } catch (error) { return captureFailure(error); }
}
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const user = await getSessionAccount();
    if (!user) throw new CaptureError(401, 'SIGN_IN_REQUIRED', 'Sign in to manage extension credentials.');
    const body = await readCaptureJson(request) as Record<string, unknown>;
    if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => key !== 'label') || typeof body.label !== 'string' || !body.label.trim() || body.label.length > 100) throw new CaptureError(422, 'INVALID_LABEL', 'Enter a label of 1–100 characters.');
    return captureResponse({ success: true, ...await issueExtensionCredential(user.id, body.label.trim()), account: { id: user.id, email: user.email }, capabilities: { capture: true, extension_assessments: true, assessments: false } }, 201);
  } catch (error) { return captureFailure(error); }
}
export async function DELETE(request: Request) {
  try {
    requireSameOrigin(request);
    const user = await getSessionAccount();
    if (!user) throw new CaptureError(401, 'SIGN_IN_REQUIRED', 'Sign in to manage extension credentials.');
    const id = new URL(request.url).searchParams.get('id');
    if (!captureUuid(id)) throw new CaptureError(422, 'INVALID_ID', 'Choose a valid credential.');
    if (!await revokeExtensionCredential(user.id, id)) throw new CaptureError(404, 'NOT_FOUND', 'Credential not found.');
    return captureResponse({ success: true });
  } catch (error) { return captureFailure(error); }
}
