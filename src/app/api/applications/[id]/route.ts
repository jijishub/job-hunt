import { getSessionAccount } from '@/lib/session-account';
import { ownsApplication } from '@/lib/ownership';
import { validRoleFit } from '@/lib/role-fit';
import { NextResponse } from 'next/server';
import { getApplicationById, updateApplication, deleteApplication, getOrCreateCompany } from '@/lib/db';
import { pushApplicationToNotion } from '@/lib/notion';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const user = await getSessionAccount();
    if (!user) return NextResponse.json({ success: false, error: 'Sign in required.' }, { status: 401 });
    const app = await getApplicationById(id);
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
    const existingApp = await getApplicationById(id);
    if (!existingApp || !ownsApplication(existingApp, user)) {
      return NextResponse.json({ success: false, error: 'Application not found' }, { status: 404 });
    }
    delete body.id; delete body.owner; delete body.created_at; delete body.stage_history;
    if (body.role_fit != null && !validRoleFit(body.role_fit)) return NextResponse.json({ success: false, error: 'Invalid role fit.' }, { status: 400 });
    if (existingApp.status === 'LEAD' && body.status && body.status !== 'LEAD') {
      body.company_name ||= existingApp.company_name;
      body.date_applied ||= new Date().toISOString();
    }

    if (body.company_name) {
      const isLead = (body.status || existingApp?.status) === 'LEAD' || body.is_lead === true;
      if (!isLead) {
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
      sync_status: 'PENDING',
    });

    if (!updated) {
      return NextResponse.json({ success: false, error: 'Application not found' }, { status: 404 });
    }

    let syncError: string | undefined;
    try {
    const user = await getSessionAccount();
    if (!user) return NextResponse.json({ success: false, error: 'Sign in required.' }, { status: 401 });
      await pushApplicationToNotion(updated, (message) => { syncError = message; });
    } catch (notionErr) {
      console.warn('Notion push background warning:', notionErr);
    }

    return NextResponse.json({ success: true, data: await getApplicationById(id) || updated, sync_error: syncError });
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
    const app = await getApplicationById(id);
    if (!app || !ownsApplication(app, user)) return NextResponse.json({ success: false, error: 'Application not found.' }, { status: 404 });
    await deleteApplication(id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message }, { status: 500 });
  }
}
