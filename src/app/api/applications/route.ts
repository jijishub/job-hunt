import { NextResponse } from 'next/server';
import { getApplications, createApplication, getOrCreateCompany, getCompanies } from '@/lib/db';
import { pushApplicationToNotion, pullApplicationsFromNotion, getNotionConfig } from '@/lib/notion';

export async function GET() {
  try {
    let apps = await getApplications();
    if (apps.length === 0) {
      const config = getNotionConfig();
      if (config.isConfigured) {
        const pull = await pullApplicationsFromNotion();
        if (pull.success) {
          apps = await getApplications();
        }
      }
    }
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

    const isLead = status === 'LEAD' || body.is_lead === true;
    let company: any = null;

    if (!isLead) {
      company = await getOrCreateCompany(
        company_name,
        company_logo,
        company_website,
        body.owner
      );
    } else {
      // For leads: reuse existing company if it already exists, but DO NOT create a new company row
      const existingCompanies = await getCompanies();
      company =
        existingCompanies.find(
          (c) => c.name.toLowerCase().trim() === company_name.toLowerCase().trim()
        ) || null;
    }

    const newApp = await createApplication({
      company_id: company?.id || undefined,
      company_name: company?.name || company_name.trim(),
      company_logo: company?.logo_url || company_logo,
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
      owner: body.owner,
      source: body.source,
      notion_status: body.notion_status,
      sync_status: 'PENDING',
    });

    if (!isLead) {
      try {
        await pushApplicationToNotion(newApp);
      } catch (notionErr) {
        console.warn('Notion push background warning:', notionErr);
      }
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
