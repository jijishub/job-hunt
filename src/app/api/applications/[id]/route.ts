import { applicationValidationError } from '@/lib/application-validation';
import { ANALYTICS_STAGES } from '@/lib/analytics-stages';
import { getSessionAccount } from '@/lib/session-account';
import { ownsApplication } from '@/lib/ownership';
import { validRoleFit } from '@/lib/role-fit';
import { NextResponse } from 'next/server';
import { getApplicationById, updateApplication, deleteApplication, getOrCreateCompany, getCandidatePreferences } from '@/lib/db';
import { applicationWorkflowUpdates, isArchivedApplication } from '@/lib/application-workflow';
import { scheduleApplicationNotionSync } from '@/lib/application-notion-sync';
import { normalizeOfferFields } from '@/lib/salary-offers';
import { analyticsFieldUpdates } from '@/lib/application-analytics-fields';

export const maxDuration = 60;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const user = await getSessionAccount();
    if (!user) return NextResponse.json({ success: false, error: 'Sign in required.' }, { status: 401 });
    const app = await getApplicationById(id, user);
    if (!app || !ownsApplication(app, user)) {
      return NextResponse.json({ success: false, error: 'Application not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: app });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const user = await getSessionAccount();
    if (!user) return NextResponse.json({ success: false, error: 'Sign in required.' }, { status: 401 });
    const body = await request.json();
    if (body?.summary_only) return NextResponse.json({ success: false, error: 'Load the complete application before editing.' }, { status: 400 });
    const validationError = applicationValidationError(body);
    if (validationError) return NextResponse.json({ success: false, error: validationError }, { status: 400 });
    Object.assign(body, normalizeOfferFields(body));
    if (body.analytics_stage != null && !ANALYTICS_STAGES.includes(body.analytics_stage)) return NextResponse.json({ success: false, error: 'Invalid analytics phase.' }, { status: 400 });
    if (body.not_proceeding != null && typeof body.not_proceeding !== 'boolean') return NextResponse.json({ success: false, error: 'Invalid Not Proceeding flag.' }, { status: 400 });
    if (Object.hasOwn(body, 'information') || Object.hasOwn(body, 'job_description')) { body.information = body.information ?? body.job_description; body.job_description = body.information; }

    const existingApp = await getApplicationById(id, user);
    if (!existingApp || !ownsApplication(existingApp, user)) {
      return NextResponse.json({ success: false, error: 'Application not found' }, { status: 404 });
    }
    delete body.id; delete body.owner; delete body.created_at; delete body.stage_history;
    Object.assign(body, analyticsFieldUpdates(existingApp, body));
    const preferences = await getCandidatePreferences(user.id);
    Object.assign(body, applicationWorkflowUpdates(existingApp, body, preferences?.analytics_status_stages));
    const localArchiveChange = isArchivedApplication(existingApp) !== isArchivedApplication({ ...existingApp, ...body });
    const ensureCompany = body.ensure_company === true;
    delete body.ensure_company;
    if (ensureCompany) body.company_name ||= existingApp.company_name;
    if (body.role_fit != null && !validRoleFit(body.role_fit)) return NextResponse.json({ success: false, error: 'Invalid role fit.' }, { status: 400 });
    if (body.role_fit === 'WEAK' && existingApp.role_fit !== 'WEAK' && body.priority == null) body.priority = 'LOW';
    if (body.role_fit === 'STRONG' && existingApp.role_fit !== 'STRONG' && body.priority == null) body.priority = 'HIGH';
    if (existingApp.status === 'LEAD' && body.status && body.status !== 'LEAD') {
      body.company_name ||= existingApp.company_name;
      body.date_applied ||= new Date().toISOString();
    }

    if (body.company_name) {
      const isLead = (body.status || existingApp?.status) === 'LEAD' || body.is_lead === true;
      if (!isLead || ensureCompany) {
        const company = await getOrCreateCompany(
          body.company_name,
          body.company_logo,
          body.company_website,
          existingApp.owner
        );
        body.company_id = company.id;
        body.company_name = company.name;
        if (company.logo_url) body.company_logo = company.logo_url;
      }
    }

    const updated = await updateApplication(id, {
      ...body,
      sync_status: localArchiveChange || isArchivedApplication({ ...existingApp, ...body }) ? existingApp.sync_status : 'PENDING',
    });

    if (!updated) {
      return NextResponse.json({ success: false, error: 'Application not found' }, { status: 404 });
    }

    if (!localArchiveChange && !isArchivedApplication(updated) && updated.status !== 'LEAD' && user.role === 'admin' && user.notion_enabled) {
      scheduleApplicationNotionSync(updated.id);
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const user = await getSessionAccount();
    if (!user) return NextResponse.json({ success: false, error: 'Sign in required.' }, { status: 401 });
    const app = await getApplicationById(id, user);
    if (!app || !ownsApplication(app, user)) return NextResponse.json({ success: false, error: 'Application not found.' }, { status: 404 });
    await deleteApplication(id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message }, { status: 500 });
  }
}
