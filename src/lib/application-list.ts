import { ownsApplication } from './ownership';
import { getDatabaseClient } from './database';
import { getApplications } from '@/lib/db';
import { SUMMARY_FIELDS, applicationSummary, matchesApplicationSearch } from './application-summary';
import type { JobApplication, UserAccount } from '@/types/job';

export async function getApplicationList(user: Pick<UserAccount, 'id' | 'email' | 'role'>, options: { search?: string; ids?: string[]; limit?: number; offset?: number } = {}) {
  const search = (options.search || '').trim().toLowerCase();
  const limit = Math.max(1, Math.min(500, options.limit || 500));
  const offset = Math.max(0, options.offset || 0);
  const sql = getDatabaseClient();
  if (!sql) {
    const records = (await getApplications(true, user)).filter(app => ownsApplication(app,user)).filter(app => matchesApplicationSearch(app, search) && (!options.ids || options.ids.includes(app.id))).sort((a,b) => b.updated_at.localeCompare(a.updated_at) || a.id.localeCompare(b.id));
    return { data: records.slice(offset, offset + limit).map(applicationSummary), total: records.length, limit, offset };
  }
  const rows = await sql`
    WITH owned AS (
      SELECT to_jsonb(a) || jsonb_build_object('company_logo', coalesce(c.logo_url,a.company_logo), 'logo_company',c.logo_url IS NOT NULL, 'logo_version',coalesce(c.updated_at::text,a.updated_at::text)) AS data
      FROM applications a LEFT JOIN companies c ON c.id=a.company_id
      WHERE lower(trim(coalesce(a.owner,''))) IN (${user.id.toLowerCase()},${user.email.toLowerCase()})
        OR (${user.id === 'user_ji'} AND lower(trim(coalesce(a.owner,''))) IN ('','admin'))
      UNION ALL
      SELECT l.data || jsonb_build_object('company_logo',coalesce(c.logo_url,l.data->>'company_logo'),'logo_company',c.logo_url IS NOT NULL,'logo_version',coalesce(c.updated_at::text,l.data->>'updated_at')) FROM leads l LEFT JOIN companies c ON c.id=l.data->>'company_id'
      WHERE lower(trim(coalesce(l.data->>'owner',''))) IN (${user.id.toLowerCase()},${user.email.toLowerCase()})
        OR (${user.id === 'user_ji'} AND lower(trim(coalesce(l.data->>'owner',''))) IN ('','admin'))
    ), matched AS (
      SELECT data FROM owned WHERE
        (${!options.ids} OR data->>'id'=ANY(${options.ids || []}::text[]))
        AND (${!search} OR strpos(lower(concat_ws(' ',data->>'role_title',data->>'company_name',data->>'notes',data->>'location',data->>'service',data->>'job_description',data->>'information',data->>'notion_status',data->>'status',CASE WHEN data->>'not_proceeding'='true' THEN 'Not Proceeding' ELSE '' END)),${search})>0)
    ), page AS (
      SELECT data FROM matched ORDER BY data->>'updated_at' DESC, data->>'id' ASC LIMIT ${limit} OFFSET ${offset}
    ), summaries AS (
      SELECT (SELECT jsonb_object_agg(key,value) FROM jsonb_each(data) WHERE key=ANY(${[...SUMMARY_FIELDS]}::text[]))
        || jsonb_build_object('summary_only',true,'notes',left(data->>'notes',240),'information',left(data->>'information',240),
          'company_logo',CASE WHEN data->>'company_logo' LIKE 'data:%' THEN
            '/api/company-logo?' || CASE WHEN data->>'logo_company'='true' THEN 'company=' || (data->>'company_id') ELSE 'application=' || (data->>'id') END || '&v=' || coalesce(data->>'logo_version','')
            ELSE data->>'company_logo' END,
          'role_fit_analysis',CASE WHEN jsonb_typeof(data->'role_fit_analysis')='object' THEN jsonb_build_object('fit',data->'role_fit_analysis'->'fit','preference_alignment',data->'role_fit_analysis'->'preference_alignment') ELSE NULL END) AS data
      FROM page
    ) SELECT (SELECT count(*)::int FROM matched) AS total, coalesce(jsonb_agg(data ORDER BY data->>'updated_at' DESC,data->>'id' ASC),'[]'::jsonb) AS items FROM summaries;
  `;
  return { data: (rows[0]?.items || []) as JobApplication[], total: Number(rows[0]?.total || 0), limit, offset };
}
