import { NextResponse } from 'next/server';
import { getCompanies, getOrCreateCompany, getApplications, updateCompany, deleteCompany } from '@/lib/db';
import { pullApplicationsFromNotion, getNotionConfig } from '@/lib/notion';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userParam = searchParams.get('user') || undefined;

    let companies = await getCompanies(userParam);
    let applications = await getApplications();

    if (companies.length === 0 && applications.length === 0) {
      const config = getNotionConfig();
      if (config.isConfigured) {
        await pullApplicationsFromNotion();
        companies = await getCompanies(userParam);
        applications = await getApplications();
      }
    }

    const countsByCompanyId: Record<string, number> = {};
    applications.forEach((app) => {
      countsByCompanyId[app.company_id] = (countsByCompanyId[app.company_id] || 0) + 1;
    });

    const enriched = companies.map((c) => ({
      ...c,
      applicationCount: countsByCompanyId[c.id] || 0,
    }));

    return NextResponse.json({ success: true, data: enriched });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { name, logo_url, website, industry, created_by } = await request.json();
    if (!name || !name.trim()) {
      return NextResponse.json({ success: false, error: 'Company name is required' }, { status: 400 });
    }

    const company = await getOrCreateCompany(name, logo_url, website, created_by);
    if (industry) {
      await updateCompany(company.id, { industry });
    }

    return NextResponse.json({ success: true, data: company }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ success: false, error: 'Company ID is required' }, { status: 400 });
    }
    await deleteCompany(id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message }, { status: 500 });
  }
}

