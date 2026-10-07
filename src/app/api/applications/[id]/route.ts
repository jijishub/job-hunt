import { NextResponse } from 'next/server';
import { getApplicationById, updateApplication, deleteApplication, getOrCreateCompany } from '@/lib/db';
import { pushApplicationToNotion } from '@/lib/notion';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const app = await getApplicationById(id);
    if (!app) {
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
    const body = await request.json();

    if (body.company_name) {
      const existingApp = await getApplicationById(id);
      const isLead = (body.status || existingApp?.status) === 'LEAD' || body.is_lead === true;
      if (!isLead) {
        const company = await getOrCreateCompany(
          body.company_name,
          body.company_logo,
          body.company_website
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

    try {
      await pushApplicationToNotion(updated);
    } catch (notionErr) {
      console.warn('Notion push background warning:', notionErr);
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
    await deleteApplication(id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message }, { status: 500 });
  }
}

