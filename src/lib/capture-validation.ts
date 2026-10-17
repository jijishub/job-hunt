import { createHash } from 'node:crypto';
import { composeCaptureRequirements } from './capture-requirements';
import { validateFitAnalysis } from './role-fit';
import type { RoleFitAnalysis } from '@/types/job';

export const MAX_CAPTURE_BYTES = 262144;
export const POSTING_FIELDS = ['role_title', 'company_name', 'description', 'qualifications', 'location', 'work_model', 'job_type', 'salary_min', 'salary_max', 'salary_currency', 'salary_period', 'salary_pay_period', 'job_url', 'seniority_level', 'job_platform', 'first_response_at'] as const;
type Data = Record<string, any>;
export class CaptureError extends Error {
  constructor(public status: number, public code: string, message: string, public path?: string, public details?: { reasons: string[] }) { super(message); }
}
function invalid(path: string, message = 'Invalid field.', code = 'INVALID_FIELD'): never { throw new CaptureError(422, code, message, path); }
function object(value: unknown, path: string, keys: readonly string[]): Data {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid(path, 'Expected an object.');
  for (const key of Object.keys(value)) if (!keys.includes(key)) invalid(`${path}.${key}`, 'Unknown field.');
  return value as Data;
}
function text(value: unknown, path: string, max = MAX_CAPTURE_BYTES, nullable = true): string | null {
  if (value == null && nullable) return null;
  if (typeof value !== 'string' || value.length > max) invalid(path, `Expected text of at most ${max} UTF-16 units${nullable ? ' or null' : ''}.`);
  return value;
}
function stamp(value: unknown, path: string): string {
  const result = text(value, path, 100, false)!;
  if (!/^\d{4}-\d\d-\d\dT(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.test(result) || !Number.isFinite(Date.parse(result)) || new Date(result.slice(0, 10)).toISOString().slice(0, 10) !== result.slice(0, 10)) invalid(path, 'Expected an ISO timestamp with timezone.');
  return result;
}
export const captureUuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
function url(value: unknown, path: string): string {
  const result = text(value, path, 8000, false)!;
  try { const parsed = new URL(result); if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) invalid(path, 'Expected an HTTP(S) URL without credentials.'); }
  catch { invalid(path, 'Expected an HTTP(S) URL without credentials.'); }
  return result;
}
function list(value: unknown, path: string, max: number): any[] {
  if (!Array.isArray(value) || value.length > max) invalid(path, `Expected at most ${max} items.`);
  return value;
}
function amount(value: unknown, path: string) {
  if (value != null && (typeof value !== 'number' || !Number.isFinite(value) || value < 0)) invalid(path, 'Expected a finite nonnegative amount or null.', 'INVALID_SALARY');
}
export function normalizeCaptureSalaryPeriod(raw: string | null) {
  const aliases: Record<string, string> = { HOUR: 'HOURLY', HOURLY: 'HOURLY', DAY: 'DAILY', DAILY: 'DAILY', WEEK: 'WEEKLY', WEEKLY: 'WEEKLY', MONTH: 'MONTHLY', MONTHLY: 'MONTHLY', YEAR: 'ANNUAL', YEARLY: 'ANNUAL', ANNUAL: 'ANNUAL' };
  const key = (raw || '').trim().toUpperCase();
  return Object.hasOwn(aliases, key) ? aliases[key] : null;
}
export function canonicalCaptureJson(value: any): string {
  if (Array.isArray(value)) return `[${value.map(canonicalCaptureJson).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalCaptureJson(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
export const captureHash = (value: unknown) => createHash('sha256').update(canonicalCaptureJson(value)).digest('hex');

export async function readCaptureJson(request: Request) {
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') throw new CaptureError(415, 'JSON_REQUIRED', 'Use application/json.');
  const reader = request.body?.getReader();
  if (!reader) throw new CaptureError(400, 'INVALID_JSON', 'A JSON body is required.');
  const chunks: Uint8Array[] = []; let bytes = 0;
  try {
    while (true) {
      const chunk = await reader.read(); if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > MAX_CAPTURE_BYTES) { await reader.cancel().catch(() => {}); throw new CaptureError(413, 'CAPTURE_TOO_LARGE', 'Capture exceeds the 262144-byte limit. Keep the full capture locally.'); }
      chunks.push(chunk.value);
    }
    const body = new Uint8Array(bytes); let offset = 0;
    for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.length; }
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(body)) as unknown;
  } catch (error) {
    if (error instanceof CaptureError) throw error;
    throw new CaptureError(400, 'INVALID_JSON', 'Expected valid UTF-8 JSON.');
  } finally { reader.releaseLock(); }
}

export function validateCapture(input: unknown, key: string | null) {
  const body = object(input, 'capture', ['schema_version', 'capture_id', 'captured_at', 'posting', 'source', 'review', 'request_assessment', 'user_context', 'extension_assessment']);
  if (body.schema_version !== 1) invalid('schema_version', 'Only capture schema version 1 is supported.');
  if (!captureUuid(body.capture_id) || key !== body.capture_id) invalid('capture_id', 'The UUID must match Idempotency-Key.');
  stamp(body.captured_at, 'captured_at');
  if (typeof body.request_assessment !== 'boolean') invalid('request_assessment', 'An explicit boolean is required.');
  if (body.request_assessment) throw new CaptureError(409, 'ASSESSMENTS_DISABLED', 'Server-side assessment requests are disabled for capture imports. Submit request_assessment: false.');
  const p = object(body.posting, 'posting', POSTING_FIELDS);
  for (const field of POSTING_FIELDS) {
    if (['salary_min', 'salary_max', 'qualifications'].includes(field)) continue;
    text(p[field], `posting.${field}`, field === 'description' ? 120000 : MAX_CAPTURE_BYTES);
  }
  for (const [field, values] of [['work_model', ['ON_SITE', 'HYBRID', 'REMOTE']], ['job_type', ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP']]] as const) {
    if (p[field] != null && !(values as readonly string[]).includes(p[field])) invalid(`posting.${field}`);
  }
  const qualifications = p.qualifications ?? [];
  list(qualifications, 'posting.qualifications', 200).forEach((item, index) => text(item, `posting.qualifications.${index}`, 4000, false));
  for (const field of ['salary_min', 'salary_max']) amount(p[field], `posting.${field}`);
  if (p.salary_min != null && p.salary_max != null && p.salary_max < p.salary_min) invalid('posting.salary_max', 'Maximum cannot be below minimum.', 'INVALID_SALARY');
  if (p.salary_currency != null && !/^[A-Za-z]{3}$/.test(p.salary_currency)) invalid('posting.salary_currency');
  if (p.salary_pay_period != null && p.salary_pay_period !== normalizeCaptureSalaryPeriod(p.salary_period ?? null)) invalid('posting.salary_pay_period', 'Raw and normalized periods conflict.');
  if (p.seniority_level != null || p.first_response_at != null) invalid('posting', 'Seniority and first response must remain null.');
  if (typeof p.job_platform === 'string' && ['REFERRAL', 'WALKIN'].includes(p.job_platform.toUpperCase().replace(/[\s_-]/g, ''))) invalid('posting.job_platform', 'User channels belong in user_context.');
  url(p.job_url, 'posting.job_url');
  const s = object(body.source, 'source', ['method', 'adapter_id', 'adapter_version', 'extractor_version', 'page_url', 'candidate_index', 'employer_key', 'requisition_id', 'variants', 'structured_facts', 'field_provenance', 'corrections', 'warnings']);
  if (!['dom', 'jsonld', 'jsonld+dom', 'ai+source'].includes(s.method)) invalid('source.method');
  for (const field of ['adapter_id', 'adapter_version', 'extractor_version']) if (!text(s[field], `source.${field}`, 100, false)?.trim()) invalid(`source.${field}`);
  for (const field of ['employer_key', 'requisition_id']) text(s[field], `source.${field}`, 100);
  url(s.page_url, 'source.page_url');
  if (!Number.isSafeInteger(s.candidate_index) || s.candidate_index < 0 || s.candidate_index >= 20) invalid('source.candidate_index');
  const variants = list(s.variants, 'source.variants', 2), ids = new Set<string>();
  for (const [index, value] of variants.entries()) {
    const v = object(value, `source.variants.${index}`, ['id', 'method', 'text']);
    if (!['rendered', 'structured'].includes(v.id) || ids.has(v.id) || v.method !== (v.id === 'rendered' ? 'dom' : 'jsonld')) invalid(`source.variants.${index}`);
    ids.add(v.id); text(v.text, `source.variants.${index}.text`, 120000, false);
  }
  if (!variants.some(v => v.text.trim())) invalid('source.variants', 'At least one original text variant is required.', 'SOURCE_VARIANTS_REQUIRED');
  if (s.structured_facts !== undefined) {
    const f = object(s.structured_facts, 'source.structured_facts', ['title', 'company', 'description', 'qualifications', 'location', 'employmentType', 'salary_min', 'salary_max', 'salary_currency', 'salary_period']);
    for (const [field, value] of Object.entries(f)) {
      if (['qualifications', 'employmentType'].includes(field)) list(value, `source.structured_facts.${field}`, 200).forEach(item => text(item, `source.structured_facts.${field}`, 4000, false));
      else if (['salary_min', 'salary_max'].includes(field)) amount(value, `source.structured_facts.${field}`);
      else text(value, `source.structured_facts.${field}`, field === 'description' ? 120000 : MAX_CAPTURE_BYTES);
    }
    if (f.salary_currency != null && !/^[A-Za-z]{3}$/.test(f.salary_currency)) invalid('source.structured_facts.salary_currency');
  }
  const provenance = object(s.field_provenance, 'source.field_provenance', POSTING_FIELDS);
  for (const [field, value] of Object.entries(provenance)) {
    const item = object(value, `source.field_provenance.${field}`, ['method', 'locator', 'variant_id']);
    if (!['dom', 'jsonld', 'browser', 'url'].includes(item.method)) invalid(`source.field_provenance.${field}.method`);
    text(item.locator, `source.field_provenance.${field}.locator`, 2000, false);
    if (item.variant_id !== undefined && !ids.has(item.variant_id)) invalid(`source.field_provenance.${field}.variant_id`);
  }
  const corrections = object(s.corrections, 'source.corrections', POSTING_FIELDS);
  for (const [field, value] of Object.entries(corrections)) {
    const item = object(value, `source.corrections.${field}`, ['method', 'updated_at']);
    if (item.method !== 'user') invalid(`source.corrections.${field}.method`);
    if (['first_response_at', 'seniority_level', 'salary_pay_period'].includes(field)) invalid(`source.corrections.${field}`, 'This field is derived or protected.');
    stamp(item.updated_at, `source.corrections.${field}.updated_at`);
  }
  const warnings = list(s.warnings, 'source.warnings', 100), warningIds = new Set<string>();
  for (const [index, value] of warnings.entries()) {
    const w = object(value, `source.warnings.${index}`, ['id', 'code', 'message', 'field', 'variant_ids']);
    for (const field of ['id', 'code']) if (!text(w[field], `source.warnings.${index}.${field}`, 100, false)?.trim()) invalid(`source.warnings.${index}.${field}`);
    if (warningIds.has(w.id)) invalid(`source.warnings.${index}.id`, 'Warning IDs must be unique.'); warningIds.add(w.id);
    text(w.message, `source.warnings.${index}.message`, 2000, false);
    if (w.field !== undefined && !POSTING_FIELDS.includes(w.field)) invalid(`source.warnings.${index}.field`);
    if (w.variant_ids !== undefined) list(w.variant_ids, `source.warnings.${index}.variant_ids`, 2).forEach(id => { if (!ids.has(id)) invalid(`source.warnings.${index}.variant_ids`); });
  }
  const review = object(body.review, 'review', ['reviewed_at', 'resolutions']);
  if (review.reviewed_at != null) stamp(review.reviewed_at, 'review.reviewed_at');
  const resolutions = list(review.resolutions, 'review.resolutions', 100), resolved = new Set<string>();
  for (const [index, value] of resolutions.entries()) {
    const r = object(value, `review.resolutions.${index}`, ['warning_id', 'action', 'note']);
    const w = warnings.find(w => w.id === r.warning_id);
    if (!w || resolved.has(r.warning_id)) invalid(`review.resolutions.${index}.warning_id`);
    resolved.add(r.warning_id);
    if (!text(r.note, `review.resolutions.${index}.note`, 2000, false)?.trim()) invalid(`review.resolutions.${index}.note`);
    if (!['corrected', 'verified_irrelevant', 'use_rendered', 'use_structured'].includes(r.action)) invalid(`review.resolutions.${index}.action`);
    if (r.action.startsWith('use_')) {
      const v = variants.find(v => v.id === r.action.slice(4));
      if (w.code !== 'conflicting_sources' || w.field !== 'description' || !v || p.description !== v.text) invalid(`review.resolutions.${index}`, 'Source choice is limited to matching description conflicts.', 'INVALID_RESOLUTION');
    }
    const changed = w.code === 'invalid_salary_range' ? corrections.salary_min || corrections.salary_max
      : ['missing_requirements', 'oversized_requirements'].includes(w.code) ? corrections.description || corrections.qualifications
      : w.field ? corrections[w.field] : corrections.description || corrections.qualifications;
    if (r.action === 'corrected' && !changed) invalid(`review.resolutions.${index}`, 'A saved correction is required.', 'INVALID_RESOLUTION');
    if (r.action === 'verified_irrelevant' && ['missing_requirements', 'oversized_requirements', 'missing_role_title', 'missing_company_name', 'invalid_salary_range'].includes(w.code)) invalid(`review.resolutions.${index}`, 'This warning cannot be waived.', 'INVALID_RESOLUTION');
  }
  for (const w of warnings.filter(w => w.code === 'invalid_salary_range')) {
    if (!(corrections.salary_min || corrections.salary_max) || !review.reviewed_at || !resolutions.some(r => r.warning_id === w.id && r.action === 'corrected')) invalid('review', 'Historical invalid salaries require amount correction, resolution and review.', 'HISTORICAL_SALARY_REVIEW_REQUIRED');
  }
  if (body.user_context !== undefined) {
    const c = object(body.user_context, 'user_context', ['application_channel', 'supplied_at']);
    if (!['Referral', 'Walk-in'].includes(c.application_channel) || !corrections.job_platform) invalid('user_context', 'A saved explicit user channel is required.');
    stamp(c.supplied_at, 'user_context.supplied_at');
    if (c.supplied_at !== corrections.job_platform.updated_at) invalid('user_context.supplied_at', 'Must match the saved channel correction.');
  }
  const requirements = composeCaptureRequirements(p);
  const reasons = new Set<string>();
  if (!p.role_title?.trim()) reasons.add('missing_role_title');
  if (!p.company_name?.trim()) reasons.add('missing_company_name');
  if (!review.reviewed_at) reasons.add('pilot_review_required');
  if (!['greenhouse-dom', 'lever-dom'].includes(s.adapter_id) && !warnings.some(w => ['unverified_layout', 'structured_only'].includes(w.code) && resolved.has(w.id))) reasons.add('unverified_layout');
  if (variants.length === 2 && variants[0].text.replace(/\s+/g, ' ').trim() !== variants[1].text.replace(/\s+/g, ' ').trim()
    && !warnings.some(w => w.code === 'conflicting_sources' && w.field === 'description' && resolved.has(w.id))) reasons.add('conflicting_sources');
  if (!requirements.trim()) reasons.add('missing_requirements');
  else if (requirements.trim().length < 100 && !warnings.some(w => w.code === 'requirements_unverified' && resolved.has(w.id))) reasons.add('requirements_unverified');
  if (requirements.length > 30000) reasons.add('oversized_requirements');
  const informational = new Set(['unknown_work_model', 'unknown_job_type', 'unknown_salary_currency', 'unknown_salary_period', 'unsupported_employment_type']);
  for (const w of warnings) {
    if (w.code === 'missing_role_title' && p.role_title?.trim() || w.code === 'missing_company_name' && p.company_name?.trim()) continue;
    if (!informational.has(w.code) && !resolved.has(w.id)) reasons.add(w.code);
  }
  let extensionFit: RoleFitAnalysis | null = null;
  if (body.extension_assessment !== undefined) {
    const e = object(body.extension_assessment, 'extension_assessment', ['schema_version', 'assessment_id', 'model', 'prompt_version', 'analyzed_at', 'posting_hash', 'resume', 'preferences_hash', 'result']);
    if (e.schema_version !== 1 || !captureUuid(e.assessment_id) || e.prompt_version !== 'role-fit-v1') invalid('extension_assessment', 'Unsupported extension assessment schema or prompt version.');
    if (!text(e.model, 'extension_assessment.model', 100, false)?.trim()) invalid('extension_assessment.model');
    stamp(e.analyzed_at, 'extension_assessment.analyzed_at');
    const digest = (value: unknown, path: string) => { if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value)) invalid(path, 'Expected a lowercase SHA-256 digest.'); };
    digest(e.posting_hash, 'extension_assessment.posting_hash');
    if (e.posting_hash !== captureHash(p)) invalid('extension_assessment.posting_hash', 'The assessment belongs to different posting facts.', 'STALE_EXTENSION_ASSESSMENT');
    const resume = object(e.resume, 'extension_assessment.resume', ['id', 'label', 'sha256']);
    if (!text(resume.id, 'extension_assessment.resume.id', 100, false)?.trim()) invalid('extension_assessment.resume.id');
    text(resume.label, 'extension_assessment.resume.label', 200);
    digest(resume.sha256, 'extension_assessment.resume.sha256');
    if (e.preferences_hash != null) digest(e.preferences_hash, 'extension_assessment.preferences_hash');
    const result = object(e.result, 'extension_assessment.result', ['fit', 'explanation', 'strengths', 'gaps', 'preference_alignment', 'preference_notes']);
    if (e.preferences_hash == null && result.preference_alignment != null && result.preference_alignment !== 'UNKNOWN') invalid('extension_assessment.result.preference_alignment', 'Preference alignment requires an explicit preferences context hash.');
    text(result.explanation, 'extension_assessment.result.explanation', 4000, false);
    for (const field of ['strengths', 'gaps']) list(result[field], `extension_assessment.result.${field}`, 20).forEach(value => text(value, `extension_assessment.result.${field}`, 1000, false));
    text(result.preference_notes, 'extension_assessment.result.preference_notes', 2000);
    try { extensionFit = validateFitAnalysis(result); } catch { invalid('extension_assessment.result', 'Invalid role-fit result.'); }
    if (reasons.size) throw new CaptureError(422, 'ASSESSMENT_REQUIRES_REVIEW', 'Resolve capture review and identity blockers before attaching a fit result.', 'extension_assessment', { reasons: [...reasons] });
    extensionFit = { ...extensionFit!, analyzed_at: e.analyzed_at, origin: 'extension', extension_context: {
      assessment_id: e.assessment_id, model: e.model, prompt_version: e.prompt_version, posting_hash: e.posting_hash,
      resume_id: resume.id, resume_label: resume.label ?? null, resume_hash: resume.sha256, preferences_hash: e.preferences_hash ?? null,
    } };
  }
  return { payload: body, requirements, reasons: [...reasons], extensionFit, requestHash: captureHash(body), reviewHash: review.reviewed_at ? captureHash({ posting: p, source: s, review }) : null };
}
