import { authenticateExtensionConnection } from '@/lib/capture-store';
import { captureFailure, captureResponse } from '@/lib/capture-http';
import { MAX_CAPTURE_BYTES } from '@/lib/capture-validation';

export async function GET(request: Request) {
  try {
    const { user, expires_at, scopes } = await authenticateExtensionConnection(request, 'captures:read');
    return captureResponse({ account: { id: user.id, email: user.email }, expires_at,
      capabilities: { capture_uploads: true, extension_assessments: true, assessments: false, corrections: false, schema_versions: [1], preferences: scopes.includes('preferences:read'), preference_events: scopes.includes('preferences:read') },
      limits: { max_capture_bytes: MAX_CAPTURE_BYTES, max_status_ids: 50 } });
  } catch (error) { return captureFailure(error); }
}
