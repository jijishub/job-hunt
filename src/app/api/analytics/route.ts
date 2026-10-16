import { observedJson } from '@/lib/api-observability';
import { NextResponse } from 'next/server';
import { getSessionAccount } from '@/lib/session-account';
import { getAccountAnalytics } from '@/lib/analytics-service';

export async function GET(request: Request) {
  const user = await getSessionAccount();
  if (!user) return NextResponse.json({ success: false, error: 'Sign in required.' }, { status: 401 });
  const scope = new URL(request.url).searchParams.get('scope') || 'ALL';
  if (!['ALL', 'INTERNSHIP', 'OTHER'].includes(scope)) return NextResponse.json({ success: false, error: 'Invalid analytics scope.' }, { status: 400 });
  try {
    const { stats,applications,preferences } = await getAccountAnalytics(user, scope);
    const exportSnapshot=new URL(request.url).searchParams.get('format')==='export';
    const targets=preferences?{target_roles:preferences.target_roles,target_companies:preferences.target_companies,preferred_locations:preferences.preferred_locations,work_models:preferences.work_models,job_types:preferences.job_types,salary_min:preferences.salary_min,salary_currency:preferences.salary_currency,dealbreakers:preferences.dealbreakers,analytics_age_boundaries:preferences.analytics_age_boundaries,analytics_status_stages:preferences.analytics_status_stages,analytics_rejection_statuses:preferences.analytics_rejection_statuses}:undefined;
    return observedJson('analytics.read', { success: true, data: exportSnapshot?{stats,applications,preferences:targets}:stats }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch {
    return NextResponse.json({ success: false, error: 'Analytics could not be loaded.' }, { status: 500 });
  }
}
