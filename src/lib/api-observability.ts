import { NextResponse } from 'next/server';
import { resultJsonBytes } from './database';

// Fixed operation names only: never pass a URL, query, user identifier or body.
export function observedJson(operation: 'applications.list' | 'applications.legacy' | 'applications.page' | 'companies.list' | 'analytics.read', body: unknown, init?: ResponseInit) {
  if (process.env.DB_METRICS === '1') console.info(JSON.stringify({ event: 'api_response', operation, responseJsonBytes: resultJsonBytes(body), at: new Date().toISOString() }));
  return NextResponse.json(body, init);
}
