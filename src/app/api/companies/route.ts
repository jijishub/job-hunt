import { observedJson } from '@/lib/api-observability';
import { getSessionAccount } from '@/lib/session-account';
import { getCompanyDirectory } from '@/lib/company-directory';
import { ownsApplication } from '@/lib/ownership';
import { NextResponse } from 'next/server';
import { getCompanies, getOrCreateCompany, getApplications, updateCompany, deleteCompany } from '@/lib/db';
import { pullApplicationsFromNotion, getNotionConfig } from '@/lib/notion';

export async function GET() {
  try {
    const user = await getSessionAccount();
    if (!user) return NextResponse.json({ success: false, error: 'Sign in required.' }, { status: 401 });
    const enriched = await getCompanyDirectory(user);

    return observedJson('companies.list', { success: true, data: enriched }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getSessionAccount();
    if (!user) return NextResponse.json({ success: false, error: 'Sign in required.' }, { status: 401 });
    const { id, name, website, industry, logo_url: suppliedLogo } = await request.json();
    // Cached presentation URLs must never replace the underlying image value.
    const logo_url = typeof suppliedLogo === 'string' && suppliedLogo.startsWith('/api/company-logo?') ? undefined : suppliedLogo;
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

