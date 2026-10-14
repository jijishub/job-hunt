import { applicationValidationError } from '@/lib/application-validation';
import { ANALYTICS_STAGES } from '@/lib/analytics-stages';
import { getSessionAccount } from '@/lib/session-account';
import { ownsApplication } from '@/lib/ownership';
import { validRoleFit } from '@/lib/role-fit';
import { NextResponse } from 'next/server';
import { getApplications, hasApplications, createApplication, getOrCreateCompany, getCompanies, getCandidatePreferences } from '@/lib/db';
import { stageForStatus } from '@/lib/analytics-stages';
import { isArchivedApplication } from '@/lib/application-workflow';
import { pullApplicationsFromNotion, getNotionConfig } from '@/lib/notion';
import { scheduleApplicationNotionSync } from '@/lib/application-notion-sync';
import { normalizeOfferFields } from '@/lib/salary-offers';
import { analyticsFieldUpdates } from '@/lib/application-analytics-fields';

export const maxDuration = 60;

export async function GET() {
  try {
    const user = await getSessionAccount();
    if (!user) return NextResponse.json({ success: false, error: 'Sign in required.' }, { status: 401 });
    let apps = await getApplications(true, user);
    if (apps.length === 0 && user.role === 'admin' && user.notion_enabled && !(await hasApplications())) {
      const config = getNotionConfig();
      if (config.isConfigured) {
        const pull = await pullApplicationsFromNotion();
        if (pull.success) {
          apps = await getApplications(true, user);
        }
      }
    }
    return NextResponse.json({ success: true, data: apps.filter(app => ownsApplication(app, user)) });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to fetch applications' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await getSessionAccount();
    if (!user) return NextResponse.json({ success: false, error: 'Sign in required.' }, { status: 401 });
    const body = await request.json();
    const validationError = applicationValidationError(body);
    if (validationError) return NextResponse.json({ success: false, error: validationError }, { status: 400 });
    Object.assign(body, normalizeOfferFields(body));
    if (body.analytics_stage != null && !ANALYTICS_STAGES.includes(body.analytics_stage)) return NextResponse.json({ success: false, error: 'Invalid analytics phase.' }, { status: 400 });
    if (body.not_proceeding != null && typeof body.not_proceeding !== 'boolean') return NextResponse.json({ success: false, error: 'Invalid Not Proceeding flag.' }, { status: 400 });
    body.owner = user.id;
    if (body.role_fit != null && !validRoleFit(body.role_fit)) return NextResponse.json({ success: false, error: 'Invalid role fit.' }, { status: 400 });
    const {
      company_name,
      company_logo,
      company_website,
      role_title,
      status = 'LEAD',
      priority = body.role_fit === 'WEAK' ? 'LOW' : body.role_fit === 'STRONG' ? 'HIGH' : 'MEDIUM',
      job_type = 'FULL_TIME',
      work_model = 'ON_SITE',
      location,
      salary_min,
      salary_max,
      salary_currency = 'PHP',
      job_url,
      contact_name,
      contact_email,
      date_applied,
      follow_up_date,
      notes,
    } = body;

    if (!role_title?.trim() || !company_name?.trim()) {
      return NextResponse.json(
        { success: false, error: 'Role title and Company name are required' },
        { status: 400 }
      );
    }

    const isLead = status === 'LEAD' || body.is_lead === true;
    let company: any = null;

    if (!isLead || body.ensure_company === true) {
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

    const preferences = await getCandidatePreferences(user.id);
    const newApp = await createApplication({
      ...analyticsFieldUpdates(null, body),
      company_id: company?.id || undefined,
      company_name: company?.name || company_name.trim(),
      company_logo: company?.logo_url || company_logo,
      role_title,
      information: body.information ?? body.job_description,
      job_description: body.information ?? body.job_description,
      analytics_stage: stageForStatus(body.notion_status || status, status, preferences?.analytics_status_stages),
      not_proceeding: Boolean(body.not_proceeding),
      role_fit: body.role_fit || null,
      role_fit_source: body.role_fit ? (body.role_fit_source === 'ai' ? 'ai' : 'manual') : null,
      role_fit_analysis: body.role_fit_analysis || null,
      status,
      priority,
      job_type,
      work_model,
      location,
      salary_min: salary_min != null && salary_min !== '' ? Number(salary_min) : undefined,
      salary_max: salary_max != null && salary_max !== '' ? Number(salary_max) : undefined,
      salary_currency,
      job_url,
      offer_amount: body.offer_amount ?? null,
      offer_currency: body.offer_currency || 'PHP',
      offer_pay_period: body.offer_pay_period || 'MONTHLY',
      expected_salary_amount: body.expected_salary_amount ?? null,
      expected_salary_currency: body.expected_salary_currency || 'PHP',
      expected_salary_pay_period: body.expected_salary_pay_period || 'MONTHLY',
      contact_name,
      contact_email,
      date_applied,
      follow_up_date,
      notes,
      owner: body.owner,
      source: body.source,
      notion_status: body.notion_status || (status === 'LEAD' ? 'Not started' : undefined),
      sync_status: 'PENDING',
    });

    if (!isArchivedApplication(newApp) && !isLead && user.role === 'admin' && user.notion_enabled) {
      scheduleApplicationNotionSync(newApp.id);
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
