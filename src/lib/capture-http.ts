import { NextResponse } from 'next/server';
import { CaptureError, MAX_CAPTURE_BYTES } from './capture-validation';

export function captureResponse(value: unknown, status = 200, headers: Record<string, string> = {}) {
  return NextResponse.json(value, { status, headers: { 'Cache-Control': 'private, no-store', ...headers } });
}
export function captureFailure(error: unknown) {
  if (error instanceof CaptureError) return captureResponse({ error: { code: error.code, message: error.message,
    ...(error.path ? { fields: [{ path: error.path, message: error.message }] } : {}),
    ...(error.details?.reasons ? { reasons: error.details.reasons } : {}),
    ...(error.code === 'CAPTURE_TOO_LARGE' ? { max_bytes: MAX_CAPTURE_BYTES } : {}) } }, error.status);
  // Do not expose driver errors, request text or credential material.
  return captureResponse({ error: { code: 'CAPTURE_UNAVAILABLE', message: 'Capture storage is unavailable. Keep the capture locally and retry later.' } }, 503);
}
export function requireSameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  if (!origin || origin !== new URL(request.url).origin) throw new CaptureError(403, 'ORIGIN_REQUIRED', 'Create or revoke credentials from the signed-in tracker.');
}
