import { NextResponse } from 'next/server';
import { getApplications, createApplication, getOrCreateCompany } from '@/lib/db';
import { pushApplicationToNotion } from '@/lib/notion';

export async function GET() {
  try {
    const apps = await getApplications();
    return NextResponse.json({ success: true, data: apps });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to fetch applications' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      company_name,
      company_logo,
      company_website,
      role_title,
      status = 'LEAD',
      priority = 'MEDIUM',
      job_type = 'FULL_TIME',
      work_model = 'REMOTE',
      location,
      salary_min,
      salary_max,
      salary_currency = 'USD',
      job_url,
      contact_name,
      contact_email,
      date_applied,
      follow_up_date,
      notes,
    } = body;

    if (!role_title || !company_name) {
      return NextResponse.json(
        { success: false, error: 'Role title and Company name are required' },
        { status: 400 }
      );
    }

    const company = await getOrCreateCompany(
      company_name,
      company_logo,
      company_website
    );

    const newApp = await createApplication({
      company_id: company.id,
      company_name: company.name,
      company_logo: company.logo_url || company_logo,
      role_title,
      status,
      priority,
      job_type,
      work_model,
      location,
      salary_min: salary_min ? Number(salary_min) : undefined,
      salary_max: salary_max ? Number(salary_max) : undefined,
      salary_currency,
      job_url,
      contact_name,
      contact_email,
      date_applied,
      follow_up_date,
      notes,
      sync_status: 'PENDING',
    });

    try {
      await pushApplicationToNotion(newApp);
    } catch (notionErr) {
      console.warn('Notion push background warning:', notionErr);
    }

    return NextResponse.json({ success: true, data: newApp }, { status: 201 });
  } catch (error: any) {
    console.error('Error in POST /api/applications:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to create application' },
      { status: 500 }
    );
  }
}

