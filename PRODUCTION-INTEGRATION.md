# Production extension integration

Verified October 18, 2026 (Asia/Shanghai). Canonical origin: **https://jobhunt.jizellecasia.site**.

## Deployment evidence

- Implementation commit: `5d513e84b8d31c91f8aa786b76485e74115699c0`.
- GitHub production deployment ID: `7144879038`, created `2026-10-17T19:48:44Z`; Vercel reported `success` / "Deployment has completed" at `2026-10-17T19:48:45Z`.
- [Vercel deployment](https://vercel.com/jizellecasia/job-hunt/4d8JaHXt7ZvNXuLBdhZ2BhWe4wcC).
- Canonical `/api/version` returned `200` with build version `94e91ab0-1c93-4747-b7e3-64375cc2f830` before this documentation update. The immutable deployment URL requires Vercel authentication, so this build could not be independently matched to that URL. Subsequent builds expose the Vercel Git commit in `/api/version` to allow direct canonical-origin confirmation.

Live checks, without creating credentials or records:

| Request | Observed response |
| --- | --- |
| GET `/api/v1/connection`, no bearer | 401 `INVALID_CREDENTIAL` |
| GET `/api/v1/connection`, nonexistent correctly shaped bearer and extension Origin | 401 `INVALID_CREDENTIAL` (credential lookup completed, rather than storage-unavailable) |
| GET `/api/v1/captures?ids=4bfdbb6d-33fa-4ef9-a262-bb1d19743e72`, no bearer | 401 `INVALID_CREDENTIAL` |
| POST `/api/v1/captures`, no bearer and extension Origin | 401 `INVALID_CREDENTIAL` |
| GET `/api/extension-credentials`, no session | 401 `SIGN_IN_REQUIRED` |
| POST `/api/extension-credentials`, canonical Origin, no session | 401 `SIGN_IN_REQUIRED` |
| POST `/api/extension-credentials`, unrelated Origin | 403 `ORIGIN_REQUIRED` |

All protected responses above were JSON with `Cache-Control: private, no-store`, no redirect, and no login HTML. No permissive credential-issuance CORS was added. These checks do not establish authenticated issuance, capabilities, fit persistence, replay or revocation behavior in production.

## Schema readiness and migration boundary

A bounded, read-only catalog inspection of the existing `.env.local` primary `POSTGRES_URL` confirmed:

- `extension_credentials`: all nine expected columns, primary key, unique token hash and owner index.
- `posting_captures`: all eleven expected columns, owner/capture composite primary key and owner/identity index.
- `applications.record_version`: bigint, not null, default zero.
- `applications.job_type` and `work_model`: nullable; `salary_currency`: nullable, no default.
- Existing role-fit fields, seniority fields, job platform, first response, profile preferences and pipeline insights are present.

No missing capture schema was found on that connection. No migration, setup, reset, reseed, account change, duplicate maintenance or data backfill was run. This repository does not keep a migration ledger; catalog state does not identify who applied a migration or when.

**Unresolved target confirmation:** no Vercel CLI authentication or production environment export was available to compare the configured connection with the live production target. The live valid-shaped-bearer lookup confirms the production credential table is accessible, but does not prove the entire schema or connection equivalence.

If the authoritative production target differs and lacks prerequisites, the existing migration entrypoint is `npm run db:migrate` (`scripts/migrate_db.cjs` → `migrateDatabase` in `src/lib/db.ts`, including `migrateCaptureSchema` in `src/lib/capture-schema.ts`). Target it only at the approved Vercel **production** `POSTGRES_URL`/`DATABASE_URL`, never the development database. The exact capture changes are the four application ALTER statements for nullability, currency default and record version, plus the two CREATE TABLE and two CREATE INDEX statements in `capture-schema.ts`. Review the full entrypoint before execution: it also seeds/updates users, deletes a legacy demo user, moves legacy leads and archives duplicate rows. The repository requires a separately approved migration window; the extension handoff explicitly preserves that requirement. Do not run this broad migration merely to reconfirm already-present capture objects.

## Credential creation and imports

Sign in at the canonical origin, then open **My preferences → Job Hunt extension → Create extension credential**. Copy the one-time secret into the extension's tracker pairing UI. It is separate from the AI key, lasts 24 hours, and grants `captures:read` and `captures:write`, with optional read-only `preferences:read` when sharing is selected; see [the preference API](EXTENSION-PREFERENCES-CONTRACT.md). The same card lists metadata and supports revocation. Keep secrets out of chat and reports.

The deployed implementation requires `request_assessment:false`, validates optional completed `extension_assessment`, and saves capture/receipt/new lead atomically. It does not load a server resume/preferences, call AI, or enqueue an assessment. Supplied fit applies only to a new Not started role; an existing opening keeps all fields and stores fit provenance with `stored_only`.

No signed-in browser session or scoped bearer was available for authenticated production verification. No production capture POST was made and no capture receipt is claimed. The owner's sample UUID was not uploaded or changed. Its unresolved `collapsed_content` warning must remain `needs_review`, and without a supplied fit it must remain Unassessed. Do not use that sample to claim posting-plus-fit integration.

No additional test suites were run. Deployment builds and bounded live/catalog inspection are distinct from authenticated end-to-end verification.
