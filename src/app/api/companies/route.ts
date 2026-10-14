import { getSessionAccount } from '@/lib/session-account';
import { ownsApplication } from '@/lib/ownership';
import { NextResponse } from 'next/server';
import { getCompanies, getOrCreateCompany, getApplications, updateCompany, deleteCompany } from '@/lib/db';
import { pullApplicationsFromNotion, getNotionConfig } from '@/lib/notion';

export async function GET() {
  try {
    const user = await getSessionAccount();
    if (!user) return NextResponse.json({ success: false, error: 'Sign in required.' }, { status: 401 });
    const isAdmin = user.role === 'admin';
    let companies = await getCompanies();
    let applications = (await getApplications(true, user, 'company')).filter(app => ownsApplication(app, user));
    companies = companies.filter(company => applications.some(app => app.company_id === company.id)
      || company.created_by === user.id || company.created_by?.toLowerCase() === user.email.toLowerCase()
      || (user.id === 'user_ji' && !company.created_by));
    if (companies.length === 0 && applications.length === 0 && isAdmin) {
      const config = getNotionConfig();
      if (config.isConfigured) {
        await pullApplicationsFromNotion();
        companies = (await getCompanies()).filter(company => company.created_by === user.id || company.created_by === user.email || (user.id === 'user_ji' && !company.created_by));
        applications = (await getApplications(true, user, 'company')).filter(app => ownsApplication(app, user));
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
    const user = await getSessionAccount();
    if (!user) return NextResponse.json({ success: false, error: 'Sign in required.' }, { status: 401 });
    const { id, name, logo_url, website, industry } = await request.json();
    if (typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ success: false, error: 'Company name is required' }, { status: 400 });
    }

    const ownsCompany = (company: { created_by?: string }) => company.created_by === user.id
      || company.created_by?.toLowerCase() === user.email.toLowerCase() || (user.id === 'user_ji' && !company.created_by);
    let company;
    if (id) {
      const existing = (await getCompanies()).find(item => item.id === id);
      if (!existing || !ownsCompany(existing)) return NextResponse.json({ success: false, error: 'This shared company can only be edited by its creator.' }, { status: 403 });
      company = await updateCompany(id, { name: name.trim(), logo_url, website, industry });
    } else {
      company = await getOrCreateCompany(name, logo_url, website, user.id);
      if (ownsCompany(company)) company = await updateCompany(company.id, { logo_url, website, industry }) || company;
    }

    return NextResponse.json({ success: true, data: company }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await getSessionAccount();
    if (!user) return NextResponse.json({ success: false, error: 'Sign in required.' }, { status: 401 });
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ success: false, error: 'Company ID is required' }, { status: 400 });
    }
    const company = (await getCompanies()).find(company => company.id === id);
    const apps = (await getApplications()).filter(app => app.company_id === id);
    if (!company || apps.some(app => !ownsApplication(app, user))
      || (company.created_by !== user.id && company.created_by?.toLowerCase() !== user.email.toLowerCase() && !(user.id === 'user_ji' && !company.created_by))) {
      return NextResponse.json({ success: false, error: 'This company is shared or belongs to another account.' }, { status: 403 });
    }
    await deleteCompany(id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message }, { status: 500 });
  }
}

