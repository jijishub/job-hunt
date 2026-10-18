import { randomBytes, randomUUID, createHash } from 'node:crypto';
import type { JobApplication, UserAccount } from '@/types/job';
import { analyticsFieldUpdates } from './application-analytics-fields';
import { jobPlatformFromUrl } from './job-platform';
import { getDatabaseClient } from './database';
import { readLocalCaptureDatabase, writeLocalCaptureDatabase, getUserById } from './db';
import { CaptureError, captureUuid, type validateCapture } from './capture-validation';

export interface ExtensionCredential {
  id: string; owner: string; label: string; token_hash: string; scopes: string[];
  created_at: string; expires_at: string; revoked_at: string | null;
}
export interface CaptureRecord {
  owner: string; capture_id: string; request_hash: string; identity_key: string; application_id: string | null;
  payload: Record<string, any>; receipt: Record<string, any>; review_hash: string | null;
  reviewed_by: string | null; reviewed_received_at: string | null; created_at: string;
}
const secretHash = (secret: string) => createHash('sha256').update(secret).digest('hex');
const publicCredential = ({ id, owner, label, scopes, created_at, expires_at, revoked_at }: ExtensionCredential) => ({ id, owner, label, scopes, created_at, expires_at, revoked_at });

export async function issueExtensionCredential(owner: string, label: string, sharePreferences = false) {
  const secret = `jh_capture_${randomBytes(32).toString('base64url')}`;
  const now = new Date(), sql = getDatabaseClient();
  const credential: ExtensionCredential = { id: randomUUID(), owner, label, token_hash: secretHash(secret),
    scopes: ['captures:read', 'captures:write', ...(sharePreferences ? ['preferences:read'] : [])], created_at: now.toISOString(), expires_at: new Date(now.getTime() + 86400000).toISOString(), revoked_at: null };
  if (sql) {
    const result = await sql.transaction([
      sql`SELECT pg_advisory_xact_lock(hashtextextended(${'capture-credentials:' + owner},0));`,
      sql`INSERT INTO extension_credentials(id,owner,label,token_hash,scopes,created_at,expires_at)
        SELECT ${credential.id},${owner},${label},${credential.token_hash},${JSON.stringify(credential.scopes)}::jsonb,${credential.created_at},${credential.expires_at}
        WHERE (SELECT count(*) FROM extension_credentials WHERE owner=${owner} AND revoked_at IS NULL AND expires_at>NOW()) < 5 RETURNING id;`,
    ]);
    if (!result[1].length) throw new CaptureError(409, 'CREDENTIAL_LIMIT', 'Revoke an active credential before creating another.');
  } else {
    const db = readLocalCaptureDatabase();
    if ((db.extension_credentials || []).filter(c => c.owner === owner && !c.revoked_at && c.expires_at > credential.created_at).length >= 5) throw new CaptureError(409, 'CREDENTIAL_LIMIT', 'Revoke an active credential before creating another.');
    (db.extension_credentials ??= []).push(credential); writeLocalCaptureDatabase(db);
  }
  return { credential: publicCredential(credential), token: secret };
}
export async function listExtensionCredentials(owner: string) {
  const sql = getDatabaseClient();
  const rows = sql ? await sql`SELECT id,owner,label,scopes,created_at,expires_at,revoked_at FROM extension_credentials WHERE owner=${owner} ORDER BY created_at DESC;`
    : (readLocalCaptureDatabase().extension_credentials || []).filter(c => c.owner === owner).map(publicCredential);
  return rows;
}
export async function revokeExtensionCredential(owner: string, id: string) {
  const sql = getDatabaseClient();
  if (sql) return (await sql`UPDATE extension_credentials SET revoked_at=COALESCE(revoked_at,NOW()) WHERE owner=${owner} AND id=${id} RETURNING id;`).length > 0;
  const db = readLocalCaptureDatabase(), credential = db.extension_credentials?.find(c => c.owner === owner && c.id === id);
  if (!credential) return false;
  credential.revoked_at ||= new Date().toISOString(); writeLocalCaptureDatabase(db); return true;
}
export async function authenticateExtensionCredential(request: Request, scope: string): Promise<UserAccount> {
  return (await authenticateExtensionConnection(request, scope)).user;
}
export async function authenticateExtensionConnection(request: Request, scope: string): Promise<{ user: UserAccount; expires_at: string; scopes: string[] }> {
  const header = request.headers.get('authorization') || '';
  if (!/^Bearer jh_capture_[A-Za-z0-9_-]{43}$/.test(header)) throw new CaptureError(401, 'INVALID_CREDENTIAL', 'An extension capture credential is required.');
  const hash = secretHash(header.slice(7)), sql = getDatabaseClient();
  const credential = sql ? (await sql`SELECT owner,scopes,expires_at FROM extension_credentials WHERE token_hash=${hash} AND revoked_at IS NULL AND expires_at>NOW();`)[0]
    : readLocalCaptureDatabase().extension_credentials?.find(c => c.token_hash === hash && !c.revoked_at && Date.parse(c.expires_at) > Date.now());
  if (!credential) throw new CaptureError(401, 'INVALID_CREDENTIAL', 'The extension credential has expired or was revoked.');
  if (!credential.scopes.includes(scope)) throw new CaptureError(403, 'INSUFFICIENT_SCOPE', 'Credential does not allow this action.');
  const user = await getUserById(credential.owner);
  if (!user) throw new CaptureError(401, 'INVALID_CREDENTIAL', 'The connected account is unavailable.');
  return { user, expires_at: new Date(credential.expires_at).toISOString(), scopes: credential.scopes };
}

/** URL identity is deliberately conservative: never discard a query or fragment.
 * Known ATS requisitions additionally include a URL-verified employer tenant.
 */
export function captureIdentity(jobUrl: string) {
  const parsed = new URL(jobUrl), parts = parsed.pathname.split('/').filter(Boolean);
  const host = parsed.hostname.toLowerCase();
  if (['boards.greenhouse.io', 'job-boards.greenhouse.io'].includes(host) && parts.length === 3 && parts[1] === 'jobs' && /^\d+$/.test(parts[2]) && !parsed.search && !parsed.hash) return `greenhouse:${parts[0]}:${parts[2]}`;
  if (host === 'jobs.lever.co' && parts.length === 2 && captureUuid(parts[1]) && !parsed.search && !parsed.hash) return `lever:${parts[0]}:${parts[1].toLowerCase()}`;
  return `url:${parsed.href}`;
}
export async function persistCapture(user: UserAccount, validated: ReturnType<typeof validateCapture>) {
  const { payload, requestHash, reviewHash, reasons, requirements, extensionFit } = validated;
  const now = new Date().toISOString(), identity = captureIdentity(payload.posting.job_url);
  const id = `app_${randomUUID()}`, p = payload.posting;
  const hasIdentity = Boolean(p.role_title?.trim() && p.company_name?.trim());
  const app: JobApplication = { id, company_id: null, company_name: p.company_name?.trim() || '', role_title: p.role_title?.trim() || '',
    information: requirements, job_description: requirements, owner: user.id, status: 'LEAD', notion_status: 'Not started', priority: 'MEDIUM',
    job_type: p.job_type ?? null, work_model: p.work_model ?? null, location: p.location || undefined,
    salary_min: p.salary_min ?? undefined, salary_max: p.salary_max ?? undefined, salary_currency: p.salary_currency ?? null,
    job_url: p.job_url, job_platform: jobPlatformFromUrl(p.job_url).platform || p.job_platform || null, source: 'OTHER',
    role_fit: extensionFit?.fit ?? null, role_fit_source: extensionFit ? 'ai' : null, role_fit_analysis: extensionFit, first_response_at: null, analytics_stage: 'NOT_SUBMITTED',
    stage_history: [{ status: 'LEAD', notion_status: 'Not started', at: now }], sync_status: 'PENDING', record_version: 1, created_at: now, updated_at: now,
    ...analyticsFieldUpdates(null, { role_title: p.role_title || '' }) };
  if (extensionFit?.fit === 'STRONG') app.priority = 'HIGH';
  if (extensionFit?.fit === 'WEAK') app.priority = 'LOW';
  const receipt = { capture_id: payload.capture_id, application_id: null, revision: 1, disposition: 'draft',
    review: { state: reasons.length ? 'needs_review' : 'ready', reasons },
    assessment: { id: null, state: 'disabled', attempts: 0, next_retry_at: null } };
  const sql = getDatabaseClient();
  if (sql) {
    // Locks serialize both immutable request IDs and opening identities. The
    // following statement starts after the lock wait, with a fresh snapshot.
    const result = await sql.transaction([
      sql`SELECT pg_advisory_xact_lock(hashtextextended(${'capture-request:' + user.id + ':' + payload.capture_id},0));`,
      sql`SELECT pg_advisory_xact_lock(hashtextextended(${'capture-opening:' + user.id + ':' + identity},0));`,
      sql`WITH prior AS (
        SELECT * FROM posting_captures WHERE owner=${user.id} AND capture_id=${payload.capture_id}
      ), opening AS (
        SELECT application_id AS id FROM posting_captures WHERE owner=${user.id} AND identity_key=${identity} AND application_id IS NOT NULL ORDER BY created_at LIMIT 1
      ), legacy AS (
        SELECT id FROM applications WHERE lower(trim(coalesce(owner,''))) IN (${user.id.toLowerCase()},${user.email.toLowerCase()}) AND job_url IN (${p.job_url},${new URL(p.job_url).href})
        UNION ALL SELECT id FROM leads WHERE lower(trim(coalesce(data->>'owner',''))) IN (${user.id.toLowerCase()},${user.email.toLowerCase()}) AND data->>'job_url' IN (${p.job_url},${new URL(p.job_url).href})
      ), decision AS (
        SELECT COALESCE((SELECT id FROM opening),(SELECT id FROM legacy ORDER BY id LIMIT 1)) AS existing_id,
          EXISTS(SELECT 1 FROM opening WHERE NOT EXISTS(SELECT 1 FROM applications WHERE applications.id=opening.id AND lower(trim(coalesce(owner,''))) IN (${user.id.toLowerCase()},${user.email.toLowerCase()}))
            AND NOT EXISTS(SELECT 1 FROM leads WHERE leads.id=opening.id AND lower(trim(coalesce(data->>'owner',''))) IN (${user.id.toLowerCase()},${user.email.toLowerCase()}))) AS deleted
      ), lead_write AS (
        INSERT INTO leads(id,data) SELECT ${id},${JSON.stringify(app)}::jsonb FROM decision
        WHERE ${hasIdentity} AND existing_id IS NULL AND NOT deleted AND NOT EXISTS(SELECT 1 FROM prior) RETURNING id
      ), capture_write AS (
        INSERT INTO posting_captures(owner,capture_id,request_hash,identity_key,application_id,payload,receipt,review_hash,reviewed_by,reviewed_received_at,created_at)
        SELECT ${user.id},${payload.capture_id},${requestHash},${identity},COALESCE(existing_id,CASE WHEN ${hasIdentity} THEN ${id} ELSE NULL END),${JSON.stringify(payload)}::jsonb,
          ${JSON.stringify(receipt)}::jsonb || jsonb_build_object('application_id',COALESCE(existing_id,CASE WHEN ${hasIdentity} THEN ${id} ELSE NULL END),
            'disposition',CASE WHEN existing_id IS NOT NULL THEN 'existing' WHEN ${hasIdentity} THEN 'created' ELSE 'draft' END)
            || CASE WHEN ${Boolean(extensionFit)} THEN jsonb_build_object('extension_assessment',jsonb_build_object('assessment_id',${extensionFit?.extension_context?.assessment_id ?? null}::text,
              'disposition',CASE WHEN existing_id IS NULL AND ${hasIdentity} THEN 'applied' ELSE 'stored_only' END)) ELSE '{}'::jsonb END,
          ${reviewHash},${reviewHash ? user.id : null},${reviewHash ? now : null}::timestamptz,${now}::timestamptz
        FROM decision WHERE NOT deleted AND NOT EXISTS(SELECT 1 FROM prior) RETURNING receipt
      ) SELECT receipt,TRUE AS created,NULL::text AS error FROM capture_write
        UNION ALL SELECT receipt,FALSE,NULL::text FROM prior WHERE request_hash=${requestHash}
        UNION ALL SELECT NULL,FALSE,'IDEMPOTENCY_CONFLICT' FROM prior WHERE request_hash<>${requestHash}
        UNION ALL SELECT NULL,FALSE,'RECORD_DELETED' FROM decision WHERE deleted AND NOT EXISTS(SELECT 1 FROM prior);`,
    ]);
    const value = result[2][0];
    if (!value) throw new Error('Capture persistence returned no result.');
    if (value.error) throw new CaptureError(value.error === 'RECORD_DELETED' ? 410 : 409, value.error, value.error === 'RECORD_DELETED' ? 'This captured opening was deleted. A late upload cannot recreate it.' : 'Capture UUID was already used with different content.');
    return value as { receipt: Record<string, any>; created: boolean };
  }
  const db = readLocalCaptureDatabase();
  const captures = db.posting_captures ??= [];
  const prior = captures.find(c => c.owner === user.id && c.capture_id === payload.capture_id);
  if (prior) {
    if (prior.request_hash !== requestHash) throw new CaptureError(409, 'IDEMPOTENCY_CONFLICT', 'Capture UUID was already used with different content.');
    return { receipt: prior.receipt, created: false };
  }
  const own = (record: JobApplication) => [user.id.toLowerCase(), user.email.toLowerCase()].includes((record.owner || '').trim().toLowerCase());
  const records = [...db.applications, ...(db.leads || [])].filter(own);
  const previous = captures.find(c => c.owner === user.id && c.identity_key === identity && c.application_id);
  if (previous && !records.some(r => r.id === previous.application_id)) throw new CaptureError(410, 'RECORD_DELETED', 'This captured opening was deleted. A late upload cannot recreate it.');
  const existing = previous?.application_id || records.find(r => r.job_url === p.job_url || r.job_url === new URL(p.job_url).href)?.id;
  const applicationId = existing || (hasIdentity ? id : null);
  const savedReceipt = { ...receipt, application_id: applicationId, disposition: existing ? 'existing' : hasIdentity ? 'created' : 'draft',
    ...(extensionFit ? { extension_assessment: { assessment_id: extensionFit.extension_context!.assessment_id, disposition: existing ? 'stored_only' : 'applied' } } : {}) };
  if (hasIdentity && !existing) (db.leads ??= []).unshift(app);
  captures.push({ owner: user.id, capture_id: payload.capture_id, request_hash: requestHash, identity_key: identity, application_id: applicationId,
    payload, receipt: savedReceipt, review_hash: reviewHash, reviewed_by: reviewHash ? user.id : null, reviewed_received_at: reviewHash ? now : null, created_at: now });
  writeLocalCaptureDatabase(db);
  return { receipt: savedReceipt, created: true };
}
export async function getCaptureReceipts(owner: string, ids: string[]) {
  const sql = getDatabaseClient();
  if (sql) return (await sql`SELECT c.receipt || jsonb_build_object('record_deleted', c.application_id IS NOT NULL
    AND NOT EXISTS(SELECT 1 FROM applications a WHERE a.id=c.application_id AND lower(trim(coalesce(a.owner,''))) IN (lower(c.owner),(SELECT lower(trim(email)) FROM users WHERE id=c.owner)))
    AND NOT EXISTS(SELECT 1 FROM leads l WHERE l.id=c.application_id AND lower(trim(coalesce(l.data->>'owner',''))) IN (lower(c.owner),(SELECT lower(trim(email)) FROM users WHERE id=c.owner)))) AS receipt
    FROM posting_captures c WHERE c.owner=${owner} AND c.capture_id=ANY(${ids}::text[]) ORDER BY c.created_at DESC;`).map(r => r.receipt);
  const db = readLocalCaptureDatabase();
  const email = db.users.find(user => user.id === owner)?.email.toLowerCase();
  return (db.posting_captures || []).filter(c => c.owner === owner && ids.includes(c.capture_id)).map(c => ({ ...c.receipt, record_deleted: Boolean(c.application_id && ![...db.applications, ...(db.leads || [])].some(r => r.id === c.application_id && [owner.toLowerCase(), email].includes((r.owner || '').trim().toLowerCase()))) }));
}
