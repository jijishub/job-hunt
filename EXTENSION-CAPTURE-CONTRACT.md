# Extension capture API — version 1

Handoff for Job Hunt · Fill's capture integration. **Tracker credential management, capture POST/GET, and importing extension-generated fit results are deployed at https://jobhunt.jizellecasia.site.** Vercel reports successful production deployment of implementation commit `5d513e84b8d31c91f8aa786b76485e74115699c0`; live unauthenticated routes return JSON/private/no-store with preserved status codes. Authenticated production import has not been verified. Required schema exists on the configured primary connection, but its equivalence to Vercel's production connection has not been established. See [production integration evidence](PRODUCTION-INTEGRATION.md).

The new capture flow uses the extension's selected resume and direct AI gateway; the tracker validates/persists its result without running AI or loading a server resume. Existing on-demand server-side role fit remains available. Correction PATCH and server-queued capture assessment are not implemented. The extension handoff now specifies an explicit allowlist for this HTTPS production origin plus loopback development. Keep Gemini JSON import and form filling available.

## Pivot context for the extension repository

The reported Neon free-tier overage prompted this change. The extension already holds multiple resume variants and a configured AI gateway, so new captures should be assessed there against the user's selected resume before delivery. The tracker receives the reviewed posting and chosen result together, validates them, and persists them without loading server-side resume/preferences or calling AI. Preserve existing on-demand server role fit, Gemini JSON import, and extension form filling.

The extension owns AI orchestration; inference still runs at its configured provider. Keep a persistent AI queue separate from the upload outbox, start with one AI request at a time, and reuse the saved result for delivery retries. Persist enough state to resume after reopening the browser; do not promise execution while it is closed. Resume selection, posting, preferences, model, or prompt changes invalidate the local result before delivery. Upload only the chosen result and bounded provenance, not full resumes or other variants.

Historical local verification is recorded in the extension report (48 unit tests, actual-route interoperability, and five browser suites using mocked AI). No additional test suites were run for production verification. Production deployment and anonymous API checks are evidenced separately; they do not prove an authenticated capture receipt. This design aims to reduce server AI orchestration and associated evidence reads, but the cause of the Neon overage is unverified. Capture evidence/results still consume database storage and traffic; measure those costs before assuming a return to the free tier.

## Implemented foundations

- Missing job type, work model, and advertised salary currency are stored as `null`, displayed as unknown, and remain unknown when editing. Existing known values are preserved. Offers and personal salary expectations retain their separately selected units.
- `parseJobImport` normalizes posting fields but does not establish requirements completeness.
- Applications and leads have a server-managed `record_version`. Legacy records start at zero. Saves, assessments, and promotion/demotion advance the version.
- The session-authenticated `/api/role-fit` atomically applies results only to the saved record version it evaluated. A changed/deleted record returns `409` / `STALE_ASSESSMENT`. Forced reassessment cannot bypass this check. Draft analysis does not persist a record.
- Evidence/preferences version checks, assessment generations, and explicit oversized-input handling remain worker prerequisites. The synchronous endpoint still caps requirements at 30,000 characters.

## Implemented pilot authentication

The private pilot uses a tracker token that stays valid until revoked scoped to `captures:write` and `captures:read`. It grants no assessment or application-edit scope. An explicit sharing checkbox can additionally grant read-only `preferences:read`; see [preference snapshots and events](EXTENSION-PREFERENCES-CONTRACT.md). Token issuance requires a signed-in tracker session and a same-origin browser request. Only SHA-256 token hashes are persisted; the secret is returned once and held in the preferences card until hidden or closed. New issuance requires no existing active credential for the account; otherwise POST returns `409 CREDENTIAL_LIMIT`. Existing working pilot credentials become non-expiring during migration; expired and revoked credentials stay invalid. Accounts with multiple working pilot credentials keep those pairings until individually revoked. A later authorization-code/PKCE flow can replace manual token entry.

In **My preferences → Job Hunt extension**, create a labeled credential, copy it once, or revoke it. `GET /api/extension-credentials` lists only the signed-in account's active credential metadata, excluding expired and revoked entries. `POST` with `{ "label": "My browser" }` issues a credential, and `DELETE ?id=<credential UUID>` revokes it. POST/DELETE require an `Origin` matching the tracker request URL. Credential responses are private/no-store. Deleting an account also makes its credentials unusable because each capture request checks the account still exists.

The credential identifies one account; ownership is always server-derived. It is unrelated to the extension's AI gateway key. Bind the local outbox to the tracker origin and connected account, pause on authentication failure/account change, and send credentials only from trusted extension contexts to that tracker origin. `GET /api/v1/connection` returns top-level `expires_at: null` for non-expiring credentials. The extension must treat null as valid until revoked and must not schedule an expiry or require a new key. A UTC ISO timestamp remains supported for legacy credentials. Server 401 remains authoritative.

## Capture endpoints

| Endpoint | Status and behavior |
| --- | --- |
| `GET /api/v1/connection` | Implemented: verify bearer credential and return account ID/email, capabilities and payload/status limits |
| `POST /api/v1/captures` | Implemented: validate and atomically persist source, receipt, identity link and optional Not started lead |
| `GET /api/v1/captures?ids=<comma-separated UUIDs>` | Implemented: return owned receipts; maximum 50 IDs |
| `PATCH /api/v1/captures/:id` | Planned: correct posting/source using `If-Match`; preserve original source |
| `POST /api/v1/captures/:id/assessment` | Planned: idempotently request assessment/retry of eligible current inputs |

Responses use `Cache-Control: private, no-store`. Batch reads omit other-account or unknown IDs. Capture POST requires an `Idempotency-Key` UUID matching `capture_id`; canonical key ordering does not change request identity, but changed values return `409`. Identical requests replay their original receipt. The future single-capture endpoints will return `404` for inaccessible IDs; the future correction endpoint will return `428`/`412` for missing/stale preconditions. Those routes are not available yet. Do not resend edited content under an already delivered capture UUID; retain the original delivery snapshot and wait for PATCH support or create a distinct new capture.

**No server AI on capture imports:** POST requires `request_assessment: false`. A true value returns `409` / `ASSESSMENTS_DISABLED` without saving anything. `assessment.state: "disabled"` describes the server task, even when an optional `extension_assessment` result is supplied. No provider request, server queue row, company creation, or Notion write occurs. A successful authenticated receipt is required before claiming a production import; anonymous route checks alone do not verify delivery.

## Create request

Headers: `Authorization: Bearer <tracker-token>`, `Idempotency-Key: <capture UUID>`, `Content-Type: application/json`.

```json
{
  "schema_version": 1,
  "capture_id": "a1b2c3d4-1111-4222-8333-123456789abc",
  "captured_at": "2026-10-18T06:00:00Z",
  "posting": {
    "role_title": "Support Engineer",
    "company_name": "Example",
    "description": "Actual posting text with headings and requirements preserved.",
    "qualifications": ["Actual requirement from the posting"],
    "location": null,
    "work_model": null,
    "job_type": null,
    "salary_min": null,
    "salary_max": null,
    "salary_currency": null,
    "salary_period": null,
    "salary_pay_period": null,
    "job_url": "https://example.com/jobs/123",
    "seniority_level": null,
    "job_platform": null,
    "first_response_at": null
  },
  "source": {
    "method": "jsonld+dom",
    "adapter_id": "generic-jobposting",
    "adapter_version": "1",
    "extractor_version": "posting-pilot-v1",
    "page_url": "https://example.com/jobs/123",
    "candidate_index": 0,
    "requisition_id": "123",
    "employer_key": "example.com",
    "variants": [{ "id": "rendered", "method": "dom", "text": "Original rendered posting text." }],
    "field_provenance": { "description": { "method": "dom", "variant_id": "rendered", "locator": ".description" } },
    "corrections": {},
    "warnings": []
  },
  "review": { "reviewed_at": null, "resolutions": [] },
  "request_assessment": false
}
```

Proposed limit: 256 KiB of UTF-8 JSON. Require schema version, UUID matching the create idempotency key, timestamp with timezone, posting URL, source metadata, and an explicit assessment request flag. Nullable posting facts may be omitted and normalize to null. Title/company may be null for an incomplete capture draft. Reject unknown keys, invalid enums and unsupported facts. Render all source text safely and treat it as untrusted data throughout extraction and assessment.

| Field | Rules |
| --- | --- |
| `work_model` | `ON_SITE`, `HYBRID`, `REMOTE`, or null |
| `job_type` | `FULL_TIME`, `PART_TIME`, `CONTRACT`, `INTERNSHIP`, or null |
| Salary amounts | Finite nonnegative numbers or null; maximum cannot be below minimum |
| `salary_currency` | Three-letter currency code or null; never inferred from location |
| `salary_period` | Raw stated text, such as `YEAR`; preserve without conversion, including unsupported periods |
| `salary_pay_period` | `HOURLY`, `DAILY`, `WEEKLY`, `MONTHLY`, `ANNUAL`, or null; preserve as capture metadata without silent conversion |
| `job_url` | Absolute HTTP(S) URL of the selected posting; retain the original |
| `seniority_level` | Must be null; tracker derives it from the title |
| `first_response_at` | Must be null for posting capture |
| `job_platform` | Source-supplied platform or deterministic URL match; posting capture cannot claim Referral/Walk-in |
| `source.method` | `jsonld`, `dom`, `jsonld+dom`, or `ai+source` |
| `source.warnings` | Objects with capture-local `id`, stable `code`, readable `message`, and optional `field` and `variant_ids`; the server determines blocking behavior |
| `review.reviewed_at` | Timestamp of an explicit review action, or null; never copied from page markup |

Never accept page-supplied candidate data, owner, status, priority, fit ratings, application dates, or record versions. A valid company/title allows creation of a `LEAD` / `Not started` record with no application or employer-response date. Otherwise save a selected capture draft without a linked application. Zero-candidate and unresolved multiple-candidate captures stay local, as specified below.

## Review, identity, and responses

The server validates identity, requirements and supported adapter/review state independently; `request_assessment` cannot bypass review. During the pilot, every capture needs explicit user review. Missing salary alone does not block experience-fit assessment. Missing/ambiguous requirements, unresolved conflicts, unreviewed captures, and oversized requirements block automatic assessment. A valid JSON object or AI confidence score does not prove completeness.

```json
{
  "capture_id": "a1b2c3d4-1111-4222-8333-123456789abc",
  "application_id": "app_example",
  "revision": 1,
  "disposition": "created",
  "review": { "state": "needs_review", "reasons": ["pilot_review_required"] },
    "assessment": { "id": null, "state": "disabled", "attempts": 0, "next_retry_at": null }
}
```

Capture `revision` is separate from application `record_version`. Current POST returns `ETag: "1"`; future corrections will advance it. Disposition is `created`, `existing`, or `draft`; application ID is null for a draft. Review state is `ready` or `needs_review`. The ingestion-only assessment state is `disabled`; future worker states are `blocked_review`, `blocked_evidence`, `queued`, `running`, `retry_wait`, `succeeded`, `failed`, `stale`, and `skipped_manual`. Batch reads return `{ "captures": [...] }` and add `record_deleted: true` when a linked record is deleted or no longer owned by the connected account. Replayed POST receipts remain unchanged, even after deletion.

| Status | Meaning |
| --- | --- |
| `201` | New capture persisted, including drafts or links to existing openings |
| `200` | Identical replay, correction, already-requested assessment, or status read |
| `202` | Assessment request durably queued |
| `400` | Malformed request |
| `401` / `403` | Missing/expired credential / insufficient scope |
| `409` | Key reused with different content, or assessment blocked by current state |
| `412` / `428` | Stale / missing correction precondition |
| `413` / `422` | Payload exceeds limit / semantically invalid facts or unsupported schema |
| `429` | Throttled; include `Retry-After` |
| `410` | An earlier capture links this opening to a deleted record; new delivery cannot recreate it |
| `415` | Request content type is not `application/json` |
| `503` | Storage unavailable; retain the local snapshot and retry the same immutable request later |

Errors use `{ "error": { "code": "...", "message": "...", "fields": [{ "path": "posting.work_model", "message": "..." }] } }`.

Separate upload retry identity from posting identity. An account-scoped capture UUID plus request hash prevents duplicate retries. A new capture UUID for an existing opening links to that record without resetting hiring status, edited text or fit, and without automatically reassessing it. Identify openings by account + platform/employer tenant + requisition ID, or a validated normalized URL. Keep identity-bearing query parameters/fragments. Company/title alone and cross-platform matches are review signals. Preserve mappings through promotion and retain deletion tombstones so late uploads cannot recreate records.

Implemented identity is conservative: query/fragment-free Greenhouse and Lever detail URLs yield URL-verified tenant/requisition keys; all other URLs retain the entire URL, including query and fragment. Client-supplied tenant/requisition claims are evidence, never trusted identity keys. Previously captured links survive promotion; exact existing owned posting URLs can link records created through other workflows. Broader URL equivalence and cross-platform deduplication are not implemented. Capture receipts, source bundles and identity links commit in the same transaction as a new lead, using PostgreSQL transaction-scoped request/opening locks. Local JSON uses one atomic file replacement. Capture rows remain as idempotency/deletion tombstones when a linked application is deleted.

Current runtime field limits also require credential-free HTTP(S) URLs of at most 8,000 UTF-16 units and candidate indexes 0–19. Body limits are enforced against actual streamed bytes, not a claimed Content-Length. Read status is receipt-only; it does not return source bodies or credentials. PATCH and asynchronous assessment are not available in this release.

## Pilot reconciliation — tracker-side decisions

These decisions incorporate the extension's `docs/extraction-pilot.md`, `docs/offline-transport.md`, and inspected local capture/serializer code. The extension has an offline serializer; the final clarifications below settle its reported schema questions. Local exports remain separate from transport. No live extraction or installed-extension tests were rerun as part of this tracker contract review.

### Select locally, then upload one posting

Keep captures with zero candidates, an unresolved selection, or `posting: null` local. A create request contains exactly one selected posting object; `source.candidate_index` identifies its original nonnegative local index. A selected posting with missing company/title may upload as a capture draft, without creating an application. Do not send unrelated candidates or fabricate a selection. Changing the selected candidate creates a new capture UUID/idempotency key; an already delivered capture cannot be reassigned to a different opening through PATCH.

### Keep original source variants and corrections separate

Replace the earlier single `requirements_text` field with `source.variants`: one or two immutable original text variants with distinct IDs `rendered` and `structured`. Each has `id`, `method` (`dom` or `jsonld`), and `text`. Preserve both when both exist, even if they disagree. The current corrected `posting.description` is separate and never rewrites either source. Allow `source.structured_facts` for the extractor's allowlisted original posting facts; reject arbitrary structured-data keys, full page HTML, and profile/form data.

`source.field_provenance` describes original extracted fields as `{ method, locator, variant_id? }`, where method is `dom`, `jsonld`, `browser`, or `url`. Referenced variant IDs must exist. Preserve saved user corrections separately as `source.corrections`, keyed only by posting fields, with `{ method: "user", updated_at }`. These values describe the origin of facts; they do not establish completeness or resolve a conflict by themselves.

PATCH may change corrected posting facts, corrections, and review metadata. Original variants, extracted provenance, original structured facts, candidate index, captured time and source URL are immutable; recapture to replace them. This also removes the earlier ambiguity in the PATCH endpoint's broad reference to editable "source" data.

### Preserve raw salary period and normalize only explicit units

Map the pilot's `posting.salary_period` directly to the raw API field. `salary_pay_period` is a separate nullable normalized value, checked/derived by the server only for exact, case-insensitive unit aliases: `HOUR`/`HOURLY`, `DAY`/`DAILY`, `WEEK`/`WEEKLY`, `MONTH`/`MONTHLY`, and `YEAR`/`YEARLY`/`ANNUAL`. Trim surrounding whitespace; do not infer hours or convert amounts. Unrecognized units stay raw with normalized null. Reject conflicting supplied raw/normalized units. Both fields remain capture metadata until proper advertised-period support exists in application persistence; preserve them during promotion and include them explicitly in any future assessment facts.

### Make warnings and review independent

The offline transport pilot now emits stable codes at the original detection sites; do not classify warnings by parsing English messages. Keep original text in `message`. Merge snapshot and selected-candidate warnings, assign distinct capture-local IDs, and preserve them after review. Unmapped legacy messages use `unclassified_warning`, which requires review and cannot automatically qualify for assessment.

| Warning code | Server assessment behavior |
| --- | --- |
| `unknown_work_model`, `unknown_job_type`, `unknown_salary_currency`, `unknown_salary_period`, `unsupported_employment_type` | Informational; not an experience-fit blocker on their own |
| `conflicting_sources`, `unverified_layout`, `structured_only`, `requirements_unverified`, `unclassified_warning` | Block until an explicit current-revision resolution and review |
| `collapsed_content`, `frames_not_read` | Block until recapture or explicit correction/review establishes that required content is included |
| `source_truncated`, `extraction_limit_reached`, `malformed_structured_data`, `structured_block_skipped`, `unsupported_qualifications` | Block until the omitted material is supplied or a specific review resolution explains why it is irrelevant |
| `missing_requirements` | Block until requirements are supplied; acknowledgement alone is insufficient |
| `missing_role_title`, `missing_company_name` | Block application creation and assessment while the corrected field is blank; retain historical warnings after correction without requiring an acknowledgement |
| `invalid_salary_range` | Invalid current amounts reject the request; a historical range warning can clear with a saved correction and valid current range, as specified below |
| `oversized_requirements` | Block while composed assessment input exceeds 30,000 UTF-16 code units |

Missing company/title blocks application creation and assessment, while allowing a selected capture draft. Multiple unresolved candidates are blocked locally rather than uploaded as a warning-only single posting. An iframe warning is not proof that requirements are missing, but requires an explicit decision about that content.

Replace `source.reviewed_by_user` with top-level `review: { reviewed_at, resolutions }`. A resolution is `{ warning_id, action, note }`; actions are `use_rendered`, `use_structured`, `corrected`, or `verified_irrelevant`. Require a nonblank explanation. Chosen source variants must exist and correspond to the corrected posting; `verified_irrelevant` cannot waive missing requirements or oversized inputs. Preserve unresolved warnings and server-derived reasons. A checkbox alone never resolves the Lever source conflict.

Review is an authenticated user assertion about the submitted revision, not proof of extraction accuracy. The client clears review after edits. The server binds accepted review/resolutions to a hash of the current selected posting and immutable source bundle, records server receipt time/account, and invalidates eligibility after any relevant correction unless an explicit fresh review is submitted. A client-provided timestamp is advisory and cannot waive server checks. `review.state: ready` means review blockers are resolved, not that evidence exists or an assessment has succeeded.

### Separate capture and assessment limits

Keep the 256 KiB UTF-8 serialized request limit for the first transport pilot. Check bytes with `TextEncoder` before enqueueing upload. If too large, keep the full local capture and show that it was not uploaded; do not trim text, discard a source variant, or retry the same oversized body automatically. The server returns `413` / `CAPTURE_TOO_LARGE` with `max_bytes: 262144`. Separate source attachments are deferred; source bundles larger than the limit remain local for now.

Within that byte limit, cap each variant and corrected description at 120,000 UTF-16 code units, variants at two, qualifications at 200 items of at most 4,000 units, and warning/resolution entries at 100 each. Locator, warning message and resolution note are capped at 2,000 units; ID/code fields at 100. Reject violations explicitly. A successful capture receipt means storage succeeded; it never means full requirements were assessed. Any extractor-side truncation remains recorded and requires resolution even when the resulting body fits.

For assessment, preserve the full description. A separate qualifications array may legitimately be empty. Compose requirements deterministically by appending qualifications except those whose whitespace-normalized text exactly matches an existing paragraph or list item; do not deduplicate using substring or semantic matching. Preserve all originals in capture storage. Check the final composed input against the 30,000-unit limit before queueing, never by silently slicing. This composition belongs in a capture-specific normalizer; the existing Gemini importer is not an upload serializer.

### Keep user channels outside posting-derived facts

If a saved user correction supplies Referral or Walk-in, set `posting.job_platform` to the URL-derived platform or null and use optional top-level `user_context: { application_channel: "Referral" | "Walk-in", supplied_at }`. Only an explicit saved user correction can create this context. Ownership still comes from the token. The server stores the channel separately from extracted platform facts; reject Referral/Walk-in in posting-derived fields. These context fields are proposed transport additions, not existing tracker fields.

### Local-to-transport mapping

| Local pilot value | Proposed request value |
| --- | --- |
| `id`, `snapshot.captured_at` | `capture_id`/create idempotency key, `captured_at` |
| `candidate_index`, selected `posting` | `source.candidate_index`, corrected `posting`; unresolved selection stays local |
| Candidate `adapter`, `adapter_version`; snapshot `extractor_version` | `source.adapter_id`, `adapter_version`, `extractor_version` |
| `snapshot.page_url`; selected source `employer_key`, `requisition_id` | Exact `source.page_url`, `source.employer_key`, `source.requisition_id`; validate tenant namespace server-side |
| Candidate source `rendered_text`, `structured_text`, `structured_data` | Immutable variants and allowlisted `source.structured_facts` |
| Candidate `provenance`; capture `corrections` | Extracted `source.field_provenance`; separate user `source.corrections` |
| Snapshot/candidate warning strings | Stable structured warning records; legacy strings remain `unclassified_warning` |
| `reviewed_at` | Advisory `review.reviewed_at`; explicit new resolution UI supplies `review.resolutions` |
| `local_schema_version` and complete local export | Never forwarded as an API object; serialize an allowlisted v1 request |

## Final offline transport clarifications

### Exact original structured facts schema

The authoritative nested schema is [capture-structured-facts.v1.schema.json](contracts/capture-structured-facts.v1.schema.json). `source.structured_facts` is optional; when present it is an object with only these optional keys:

| Original key | Accepted value |
| --- | --- |
| `title`, `company`, `location`, `salary_period` | String or null |
| `description` | String of at most 120,000 UTF-16 units, or null |
| `qualifications`, `employmentType` | Array of at most 200 strings, each at most 4,000 UTF-16 units |
| `salary_min`, `salary_max` | Finite nonnegative number or null |
| `salary_currency` | Three ASCII letters or null |

Retain original `title`, `company`, and raw `employmentType` names/values; do not rename them to normalized posting fields. Preserve unknown employment labels. Do not copy `role_title`, `company_name`, normalized classifications, channel context, or arbitrary JSON-LD into this original-facts object. Current extractor snapshots use the keys above. If a future source adds a fact, revise the contract explicitly rather than silently dropping it during transport. Unknown keys in an incoming API object reject validation.

The corrected `posting` still uses normalized field names and validates maximum >= minimum. Original evidence may retain a reversed nonnegative range: do not silently correct its numbers. JSON Schema `maxLength` counts Unicode code points, so server and client must also check the stated UTF-16 limits and overall UTF-8 body budget. The runtime validator implements this schema's allowlist and bounds directly; the JSON Schema file remains a portable interoperability artifact.

### Textless selected captures remain local

For v1, require at least one original variant with non-whitespace text. Keep title-only/textless candidates local with `SOURCE_VARIANTS_REQUIRED`; the server returns `422` with that code for zero variants or only whitespace. Do not manufacture a variant from corrections or upload an empty source. Missing-identity server drafts are supported only when a real original text variant exists. Recapture a full posting or use the existing Gemini workflow for textless cases. This retains the serializer's conservative behavior while clarifying whitespace-only inputs.

### Freeze exact composition with golden fixtures

The reference implementation is `src/lib/capture-requirements.ts`; portable examples are [capture-requirements.v1.fixtures.json](contracts/capture-requirements.v1.fixtures.json). These define the extension and future server's composition convention:

1. Preserve description verbatim in the output, including original line endings. Split on LF for boundary detection and remove one trailing CR only for marker detection; whitespace normalization consumes CR in comparison text too. The extension's offline transport documentation now records this CRLF-safe convention and its regression fixture; server interoperability remains untested.
2. Blank lines flush the current paragraph/item. A line matching `^\s*(?:[-*\u2022]|\d+[.)])\s+(.+)$` starts a new item and removes its marker for comparison. Following nonblank unmarked lines continue the current block; indentation does not create a semantic hierarchy.
3. Compare blocks and qualifications after replacing every ECMAScript `\s+` run with one space and trimming. Comparison is case-sensitive. No substring, Unicode-normalization, semantic, or nested-list interpretation is allowed.
4. Ignore blank qualifications when composing, but retain them in storage. Keep repeated new qualifications; compare each only with the original description's blocks.
5. If anything remains, append exactly two LF characters, `Qualifications:`, one LF, then each original qualification prefixed with `- ` and separated by LF. With an empty description, omit the leading two LF characters. With no remaining qualifications, return description unchanged.
6. Count the complete result in UTF-16 units before eligibility checks. Empty/whitespace requirements remain blocked. Nonempty input below the old synchronous route's 30-character minimum requires review rather than filler; the future worker needs its own explicit short-input policy. The reference function is not wired into that existing route yet.

### Non-description conflicts do not gain source-choice actions

Do not add per-variant normalized fact bundles in v1. Variants carry original text; structured facts and provenance remain distinct evidence. Permit `use_rendered`/`use_structured` only for a `conflicting_sources` warning whose field is `description`, with the corrected description exactly matching that variant. Reject these actions on company, location, work model, or other fields with `422` / `INVALID_RESOLUTION`.

For non-description conflicts, use `corrected` with a real saved correction to the affected field, or `verified_irrelevant` with an explanation when current evidence shows the conflict does not affect the chosen posting. The server verifies correction structure and current values without pretending it has independently reread the site. Review does not erase the original warning. Per-variant field facts are a future contract extension if source-choice actions become necessary for those fields.

### Missing identity and historical salary warnings

`missing_role_title` and `missing_company_name` are current-state checks: whitespace-only or null values block record creation/assessment, while allowing the selected, text-bearing capture draft. Once corrected values are nonblank, retain original warnings as history without demanding a resolution solely to dismiss them; fresh review is still required after corrections.

If corrected `posting` amounts are negative, nonfinite, or reversed, reject the request with `422` / `INVALID_SALARY` and field paths. A review checkbox or `verified_irrelevant` cannot waive invalid current values. Null means unknown; both amounts may be cleared explicitly rather than guessed.

If an immutable source records `invalid_salary_range` but current amounts validate, require user correction metadata for `salary_min` or `salary_max` plus a current `corrected` resolution and review. Otherwise leave that warning unresolved. The range may be corrected using actual posting evidence or explicitly cleared to unknown; preserve its original numbers and warning. This matches the pilot's explicit-resolution model instead of silently clearing a historical source error.

## Extension-generated role fit

For the new flow, assess in the extension using its selected resume variant and configured AI gateway, then include one optional top-level `extension_assessment` alongside `request_assessment: false`:

```json
{
  "schema_version": 1,
  "assessment_id": "22222222-3333-4444-8555-666666666666",
  "model": "configured-model-id",
  "prompt_version": "role-fit-v1",
  "analyzed_at": "2026-10-18T06:05:00Z",
  "posting_hash": "<64 lowercase SHA-256 hex characters>",
  "resume": {
    "id": "resume-slot-a",
    "label": "General resume",
    "sha256": "<64 lowercase SHA-256 hex characters>"
  },
  "preferences_hash": null,
  "result": {
    "fit": "POSSIBLE",
    "explanation": "Evidence-based comparison of this resume with the requirements.",
    "strengths": ["Relevant experience supported by the selected resume"],
    "gaps": ["A requirement not supported by that resume"],
    "preference_alignment": "UNKNOWN",
    "preference_notes": ""
  }
}
```

This is an additional nested object, not a standalone POST body. It accepts exactly those keys. Resume ID is nonblank text up to 100 UTF-16 units, optional/null label up to 200, and SHA-256 is the exact selected resume text's UTF-8 digest. Model is nonblank text up to 100 units; prompt version must be `role-fit-v1`; assessment ID must be a UUID and analyzed time must be an ISO timestamp with timezone. `preferences_hash` is null/absent when no explicit preference context was used, otherwise a lowercase SHA-256 digest of that context's canonical JSON. Never upload complete resume text, other variants, candidate profile, gateway keys, or prompts in this object. Additional keys reject validation.

`posting_hash` is SHA-256 over UTF-8 canonical JSON of the **final serialized `posting` object**: sort object keys lexicographically at every level, retain array order, use compact JSON without extra whitespace. Compute after salary normalization and user-channel projection. Whitespace inside text remains significant. Hash mismatch returns `422` / `STALE_EXTENSION_ASSESSMENT`. The server verifies this posting binding; resume/preference/model provenance is an authenticated client assertion, not server-side reevaluation. Keep separate bindings locally for selected resume text, preferences, model and prompt version, and invalidate results when any input changes.

Results accept only `fit`, `explanation`, `strengths`, `gaps`, `preference_alignment`, and `preference_notes`. Fit is `STRONG`, `POSSIBLE`, or `WEAK`. Explanation is required/nonblank and at most 4,000 units. Strengths/gaps are required arrays with at most 20 strings of 1,000 units each. Optional preference notes are at most 2,000 units. Preference alignment is `ALIGNED`, `MIXED`, `MISALIGNED`, or `UNKNOWN`; it must be UNKNOWN/absent without a preferences hash. Scores, offer predictions, invented experience, and additional report fields are not part of this contract.

Attach results only after current capture review/identity blockers are resolved; otherwise the server returns `422` / `ASSESSMENT_REQUIRES_REVIEW`. Save unresolved captures without the result if needed. Failed AI calls must not prevent saving a valid capture as Unassessed. The total 256 KiB request limit still includes this object.

For a **new** Not started lead, the result is saved atomically with the capture: `role_fit_source: "ai"`, analysis `origin: "extension"`, and bounded provenance in `extension_context`. Strong/Weak defaults priority to High/Low; Possible keeps Medium. Details identify the selected resume label and model. The response adds `extension_assessment: { assessment_id, disposition: "applied" }`.

For an **existing** opening, keep all existing fields, status, ratings and priority. Preserve the submitted result in the immutable capture payload and return `extension_assessment.disposition: "stored_only"`; never imply the existing record was re-rated. User-approved updates need a future revision-protected endpoint. Identical delivery retries return the original receipt with no AI rerun. Adding/replacing an assessment on an already delivered capture UUID is a changed body and returns `409`; prepare the chosen result before freezing delivery, or keep later comparisons local until update support exists.

`GET /api/v1/connection` advertises `extension_assessments: true`, `assessments: false`, and `corrections: false`. Extension AI scheduling/retry and upload delivery are distinct local queues. Persist selected inputs and validated results so browser suspension cannot lose work, start with one AI request at a time, and never rerun AI just to retry an upload. Compare multiple resume variants locally if desired and upload the chosen result only.

## Optional server worker and pilot gates

The extension-fit pivot does not require a server AI worker. Existing on-demand server role fit remains independent and uses the account's server-side evidence. The following worker requirements apply only if server-queued capture assessments are introduced later.

Capture/identity/lead/queue decisions must commit in one PostgreSQL transaction. A scheduled worker, independent of browser lifetime, claims jobs with expiring leases. Start with one active provider assessment across instances; bound retries, add backoff/jitter, respect `Retry-After`, and stop retrying permanent errors. The extension's persistent outbox owns upload delivery, not server assessment execution.

Before enabling the worker, add evidence/preferences versions, assessment generations, conditional completion checks and explicit oversized-input handling. Apply a result only when the record, evidence/preferences versions and generation still match. Manual ratings and priority edits invalidate old work. Share assessment logic with the synchronous path. Preserve jobs and previous successful assessments after failures.

Pilot 20–30 representative postings against actual source requirements and Gemini output. Exercise duplicate uploads, browser/worker restarts, lost responses and edits during assessment. Enable automatic assessment only after extraction review, authenticated persistence, scheduler deployment and recovery tests pass. Adapter selection follows the actual backlog, not assumed site compatibility.
