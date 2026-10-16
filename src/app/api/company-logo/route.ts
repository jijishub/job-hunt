import { getSessionAccount } from '@/lib/session-account';
import { getCompanyDirectory } from '@/lib/company-directory';
import { getDatabaseClient } from '@/lib/database';
import { getApplicationById } from '@/lib/db';
import { ownsApplication } from '@/lib/ownership';

export async function GET(request: Request) {
  try { return await readLogo(request); }
  catch { return new Response(null, { status: 503 }); }
}

async function readLogo(request: Request) {
  const user = await getSessionAccount();
  if (!user) return new Response(null, { status: 401 });
  const params = new URL(request.url).searchParams;
  const companyId = params.get('company'), appId = params.get('application');
  if ((!companyId && !appId) || (companyId || appId || '').length > 200) return new Response(null, { status: 400 });
  let value: string | null | undefined;
  if (companyId) value = (await getCompanyDirectory(user, companyId))[0]?.logo_url;
  else {
    const sql = getDatabaseClient();
    if (sql) {
      const rows = await sql`
        SELECT coalesce(c.logo_url,a.company_logo) AS logo FROM applications a LEFT JOIN companies c ON c.id=a.company_id WHERE a.id=${appId} AND (lower(trim(coalesce(a.owner,''))) IN (${user.id.toLowerCase()},${user.email.toLowerCase()}) OR (${user.id === 'user_ji'} AND lower(trim(coalesce(a.owner,''))) IN ('','admin')))
        UNION ALL SELECT coalesce(c.logo_url,l.data->>'company_logo') FROM leads l LEFT JOIN companies c ON c.id=l.data->>'company_id' WHERE l.id=${appId} AND (lower(trim(coalesce(l.data->>'owner',''))) IN (${user.id.toLowerCase()},${user.email.toLowerCase()}) OR (${user.id === 'user_ji'} AND lower(trim(coalesce(l.data->>'owner',''))) IN ('','admin')));
      `;
      value = rows[0]?.logo;
    } else {
      const app = await getApplicationById(appId!, user);
      if (app && ownsApplication(app,user)) value = app.company_logo;
    }
  }
  const match = value?.match(/^data:(image\/(?:webp|png|jpeg|gif|avif|svg\+xml));base64,([A-Za-z0-9+/=]+)$/);
  if (!match) return new Response(null, { status: 404 });
  const bytes = Buffer.from(match[2], 'base64');
  return new Response(bytes, { headers: { 'Content-Type': match[1], 'Content-Length': String(bytes.length), 'Cache-Control': 'private, max-age=86400', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; sandbox", Vary: 'Cookie' } });
}
