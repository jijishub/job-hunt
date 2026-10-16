import { getDatabaseClient } from './database';
import { getCompanies, getApplications } from '@/lib/db';
import { logoReference } from './application-summary';
import type { Company, UserAccount } from '@/types/job';

export async function getCompanyDirectory(user: Pick<UserAccount, 'id' | 'email' | 'role'>, logoId?: string) {
  const sql = getDatabaseClient();
  if (!sql) {
    const [companies, applications] = await Promise.all([getCompanies(), getApplications(true, user, 'company')]);
    return companies.filter(c => (!logoId || c.id === logoId) && (applications.some(a => a.company_id === c.id) || c.created_by === user.id || c.created_by?.toLowerCase() === user.email.toLowerCase() || user.id === 'user_ji' && !c.created_by)).map(c => ({ ...c, logo_url: logoId ? c.logo_url : logoReference(c.logo_url, c.id, undefined, c.updated_at), applicationCount: applications.filter(a => a.company_id === c.id).length }));
  }
  const rows = await sql`
    WITH company_refs AS (
      SELECT company_id FROM applications WHERE lower(trim(coalesce(owner,''))) IN (${user.id.toLowerCase()},${user.email.toLowerCase()})
        OR (${user.id === 'user_ji'} AND lower(trim(coalesce(owner,''))) IN ('','admin'))
      UNION ALL SELECT data->>'company_id' FROM leads WHERE lower(trim(coalesce(data->>'owner',''))) IN (${user.id.toLowerCase()},${user.email.toLowerCase()})
        OR (${user.id === 'user_ji'} AND lower(trim(coalesce(data->>'owner',''))) IN ('','admin'))
    ), counts AS (SELECT company_id,count(*)::int AS count FROM company_refs GROUP BY company_id)
    SELECT c.id,c.name,c.website,c.industry,c.created_by,c.created_at,c.updated_at,coalesce(counts.count,0) AS "applicationCount",
      CASE WHEN ${Boolean(logoId)} OR c.logo_url NOT LIKE 'data:%' THEN c.logo_url
        ELSE '/api/company-logo?company=' || c.id || '&v=' || c.updated_at::text END AS logo_url
    FROM companies c LEFT JOIN counts ON counts.company_id=c.id
    WHERE (${!logoId} OR c.id=${logoId || ''}) AND (counts.count>0 OR c.created_by=${user.id} OR lower(c.created_by)=${user.email.toLowerCase()} OR (${user.id === 'user_ji'} AND c.created_by IS NULL))
    ORDER BY c.name ASC;
  `;
  return rows as (Company & { applicationCount: number })[];
}
