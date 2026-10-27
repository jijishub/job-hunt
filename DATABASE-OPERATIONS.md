# Database efficiency, portability, and recovery

Status: local implementation and research, documentation reviewed October 18, 2026. No production database queries, migrations, logo uploads, cloud provisioning, replication, or provider switches were performed during this optimization work. A Git push may trigger the existing Vercel integration; builds now compile without migrating the database.

## Findings and implemented changes

The exhausted monthly allowance is a reported incident, not an established attribution. Query call counts and execution time do not reveal historical transfer bytes. Obtain the provider's time window and usage history before drawing conclusions.

| Confirmed code pattern | Change | Remaining limitation |
| --- | --- | --- |
| Full application and lead records loaded for the dashboard | Ownership-filtered summary endpoint excludes descriptions, contacts, full AI explanations, and image bytes; text previews are capped at 240 characters | The dashboard opts into `?view=summary`; complete compact history still loads for board columns, facets, and analytics |
| Large collections rendered as one table | Read-only page endpoint returns at most 100 summaries; table uses 25-row pages in current filtered/sorted order | The complete metadata snapshot remains available; page navigation is not claimed to eliminate that initial snapshot |
| Notes and information searched in the browser | Debounced server search checks full original text, returns compact matching records, and merges matching IDs with local filters | During a failed server search, an explicit warning identifies the summary-only fallback |
| Edits depended on list records containing every field | Detail, edit, analytics drill-down edit, and ATS selection fetch one complete record on demand | An unavailable detail endpoint blocks editing instead of submitting truncated previews |
| Logos repeated as base64 in application/company responses | Lists return versioned authenticated image URLs; browsers cache images privately for one day | A cold logo request still reads that image from PostgreSQL until an approved object-storage migration |
| Authentication loaded all users to find one email | Parameterized, explicit-column email/ID lookup | Additional per-request authentication reads remain; cross-user caching was intentionally avoided |
| Notion pull preloaded full applications; push reread users for every record | Pull preloads only identity/status fields; push reads pending records and reuses its user list | Actual Notion updates still read/return complete affected records |
| Sync response reloaded all applications and companies | Sync returns its result; client explicitly refreshes compact summaries | Manual sync still transfers changed descriptions where required |
| An empty/small list automatically triggered Notion sync | Removed that automatic recovery path; existing manual Sync remains | An empty database requires explicit synchronization |
| Builds automatically invoked maintenance migrations | `npm run build` now runs `next build` only; `npm run db:migrate` is explicit | Existing schema prerequisites must be confirmed before deployment |

For safe rolling deployments, the legacy `/api/applications` full-record contract remains available to old clients; new code explicitly requests `?view=summary`. This prevents an old editor from treating previews as complete descriptions. Legacy response metrics identify remaining callers so this compatibility path can be retired deliberately.

Analytics keep all history, custom status mappings, recorded and inferred stages, withdrawal handling, salary fields, and event dates. The dashboard reuses complete summaries instead of immediately downloading analytics metadata again. Server analytics use a reduced projection and retain the existing deterministic calculation rules. This is not a rewrite of every chart into SQL aggregation: a separately tested SQL rollup can be considered if compact metadata becomes significant.

## Capture foundations

Before deploying the capture foundations, apply the explicit schema migration to make job type/work model nullable, remove the advertised currency default, and add `applications.record_version BIGINT NOT NULL DEFAULT 0`. The build and normal requests do not apply it. Existing known facts are preserved. Local JSON storage needs no migration.

`updateApplication` advances the server-managed revision, ignoring client-supplied versions. `saveRoleFitIfCurrent` updates assessment fields only when the saved record revision and owner still match. It handles both JSON leads and application rows; promotion/demotion also advances the revision. The session role-fit endpoint returns `409` / `STALE_ASSESSMENT` after intervening edits or deletion. Direct SQL tooling that changes assessment inputs must also advance `record_version`; the conditional write depends on that invariant.

The same explicit migration now adds `extension_credentials` and `posting_captures`. Credentials store only SHA-256 hashes, stay valid until revoked (`expires_at: null`), and can be revoked from preferences. For an existing credential table, run `npm run db:migrate:credentials` against the target database before deploying non-expiring credentials: it makes expiry nullable and removes expiry from still-valid pilot credentials without reviving expired or revoked ones. This targeted command changes only credential expiry, runs atomically, and avoids the broad migration's user and duplicate maintenance. Use `npm run db:migrate` for full initial schema setup. Local JSON upgrades working credentials on the next capture-store read. The extension must accept `expires_at: null` as no expiry. Capture rows preserve original payloads, canonical request hashes, owner/review bindings, receipts and posting identity links. PostgreSQL request/opening advisory locks serialize duplicate imports; the lead and capture receipt commit in one transaction. Local JSON performs a synchronous check and one atomic file replacement. Failed persistence leaves no partial lead, and ambiguous lost responses retry the same capture UUID and immutable body.

Capture rows deliberately survive application deletion as request/identity tombstones: identical delivery replays its old receipt, and a new capture of that linked deleted opening returns `410` rather than recreating it. Backups and recovery must include `posting_captures` together with applications/leads; restoring only leads can lose deduplication/deletion history. Sources remain private account data. Do not log payloads, raw tokens, or database errors in capture responses.

The new capture flow can include an extension-generated fit result. Ingestion verifies its posting digest, bounds its fields and records resume/model/context hashes; it does not fetch the server resume/preferences, call an AI provider, or queue server AI. New leads receive that result in the same transaction. Existing ratings, edits and priority remain unchanged; the result is retained in capture history with a `stored_only` receipt. Other resume variants and full resume text stay in the extension. Existing server-side role fit remains available separately. This reduces those server AI calls and associated evidence reads, but does not establish why the previous Neon allowance was exhausted or guarantee free-tier operation; capture sources/results still use database storage and reads/transfers. Verify provider usage and account billing history rather than attributing the incident to model inference.

Run `npm run test:captures` to exercise schema upgrades, credential scope/expiry/revocation, validation, atomic ingestion, concurrent retries, account isolation, promotion, deletion and conditional assessment writes using embedded PostgreSQL and temporary local JSON. `npm run test:captures:ui` checks the credential controls against a running local server. These checks do not verify deployed endpoints, a scheduler, or live extension uploads. Evidence/preferences versions, PATCH corrections and queue execution remain future work in the [capture API contract](EXTENSION-CAPTURE-CONTRACT.md).

## Local configuration and driver interface

`src/lib/database.ts` owns tagged parameterized queries and transactions. Neon HTTP remains the default. `DB_DRIVER=postgres` selects `pg` for ordinary PostgreSQL, including a local server, a Google-hosted server, or a future physical server. Transactions reserve one connection for BEGIN, all statements, COMMIT/ROLLBACK, and release; creation of tagged queries is lazy. Drivers never automatically retry an ambiguous write or select another provider.

| Setting | Meaning |
| --- | --- |
| `DB_DRIVER=neon` | Existing Neon HTTP connection; no production configuration change required |
| `DB_DRIVER=postgres` | TCP PostgreSQL with a reusable process-local pool |
| `POSTGRES_URL` / `DATABASE_URL` | Existing precedence; server-side only |
| `DB_POOL_MAX=3` | Per-process pool cap, validated between 1 and 20; multiply by deployed instance count when budgeting connections |
| `DB_MODE=local` | Explicitly ignore inherited DB URLs during local development; rejected in production/Vercel |
| `DB_LOCAL_DIR=.data/development` | Separate local JSON data from existing personal snapshots |
| `DB_METRICS=1` | Enable metadata-only operation and response measurements |

`npm run dev` uses isolated local JSON by default, even if `.env.local` contains production URLs. Supply a distinct `DEV_DATABASE_URL` and optional `DEV_DB_DRIVER` to use a development PostgreSQL database; the launcher rejects an exact production-URL match. Direct `next dev` bypasses the launcher, so explicitly set `DB_MODE=local` when using it for tests. Use `npm run db:migrate:dev` for schema setup on `DEV_DATABASE_URL`; the generic migration command targets the primary connection and is not a safe substitute. Use a separately configured local database or JSON fixture directory for development. A second database or branch in the same metered project is not assumed to provide another allowance. Do not print URLs or credentials while comparing environments. Configure TLS certificate verification for a remote TCP server; do not disable it to make a connection succeed. `databaseHealth()` performs a bounded `SELECT 1` and returns driver/health/duration without connection details. No public health endpoint or automatic polling is enabled.

The pool adapter is tested with a simulated checked-out connection; queries are exercised against an embedded PostgreSQL engine. A real remote `pg` TLS/pooling connection and Cloud SQL have **not** been validated. See [node-postgres transactions](https://node-postgres.com/features/transactions) and [TLS configuration](https://node-postgres.com/features/ssl).

## Measurement and audit procedure

Enable `DB_METRICS=1` in an isolated local environment first. Query events contain a fixed hash of parameterized SQL, driver, duration, row count, JSON-result byte estimate, and success. They never include SQL, bound parameters, record contents, user IDs, resumes, or credentials. Neon transaction events contain total returned bytes and operation count. Selected API events contain a fixed operation name, response JSON bytes, and timestamp. Logging is opt-in; leave it off outside short measurement windows.

```powershell
npm run db:metrics -- .data/local-server-metrics.log
npm run test:database
```

Count query/API events over a known duration to measure frequency. Keep database and API totals separate. JSON sizes omit protocol overhead, compression, provider-side accounting, uninstrumented scripts, and activity before collection. They cannot reconstruct the previous month's 5 GB. Query timings are measured locally and include transport/driver time, not just server execution.

`scripts/audit_network_transfer.cjs` is an existing **live** aggregate audit. It returns byte estimates without downloading descriptions; `--verify` additionally exercises reads. Neither form was run for this work. Run only after a production read window is separately authorized. Avoid repeated full-table backups to investigate a transfer limit.

Current index review: ownership predicates normalize with `lower(trim(coalesce(...)))`, so a plain owner index may not match. First inspect `EXPLAIN (FORMAT JSON)` for ownership/date scans using disposable fixtures. Consider matching expression indexes on application owner + updated_at/id, lead JSON owner, and normalized user email only if workload plans justify them. Substring search may need a trigram index at scale; do not enable extensions or add indexes blindly for a small tracker. No production plans or index changes were executed.

### Npm/script transfer inventory

| Workflow | Database implications |
| --- | --- |
| `dev` | Isolated JSON by default; a separate explicit `DEV_DATABASE_URL` enables PostgreSQL |
| `start` | Production requests use configured storage; the idle server is not evidence of continuous DB reads |
| `build` | Compilation only; no automatic migration |
| `db:migrate` | Explicit schema/duplicate-maintenance operations; review target and backup first |
| `company-icons`, `company-icons:preview` | Live company reads, including logos; preview still transfers data |
| `audit:duplicates` | Narrow identity/status references by default; `--full-backup` explicitly downloads full records, and `--apply` backs up affected duplicate candidates |
| `rpa:job-platforms` and preview | Live application/lead reads; apply also verifies afterward |
| `test:database` | Synthetic embedded PostgreSQL and adapter mocks; no production connection |
| UI tests | Mock API calls; use `DB_MODE=local` as defense against an unmatched request |
| JobStreet/Bossjob application helpers | Primarily external-browser operations; inspect any future DB additions separately |
| `.data/*.cjs` maintenance scripts | Some perform full-table backups/live checks; ignored does not mean offline |

## Logo migration preparation and verification

Recommended candidate: R2 Standard for durable public company-brand assets, subject to owner approval and existing account suitability. Its published allowance is 10 GB-month storage, 1 million Class A and 10 million Class B operations monthly; direct egress is free, but request overages and attached services can cost money. [R2 pricing](https://developers.cloudflare.com/r2/pricing/).

Alternative: Google Cloud Storage is compatible with Vercel-served image URLs. The pricing page lists 5 GB-month Standard storage, 5,000 Class A, 50,000 Class B, and 100 GB eligible outbound transfer monthly, with US-region/destination restrictions. Confirm account-wide usage and China/Australia exclusions; do not confuse these allowances with Compute Engine networking. [Cloud Storage pricing](https://cloud.google.com/storage/pricing).

An existing compatible bucket is preferable to provisioning another service when its access, cache, and billing settings already fit. External employer logo URLs avoid storage management but can change, expire, deny hotlinking, or track requests. They are unsuitable as the sole recovery copy.

The shipped preparation script is **offline only**:

```powershell
npm run logos:prepare -- --input .data/existing-company-snapshot.json --output .data/logo-plan-NEW --base-url https://assets.example.com/company-logos/
```

Supply an already available private company snapshot; the command does not fetch production data. It inventories missing/external/emoji/embedded values, validates image decoding, writes original bytes under SHA-256 filenames, deduplicates equal assets, and creates `manifest.json` plus a recoverable `before.json`. It refuses an existing output directory. Original images are not recompressed. Corrupt or unsupported assets remain unchanged and are listed as failures. Keep manifests/backups private under `.data`.

The following remains blocked by the no-production/no-cloud constraint:

1. Approve a storage target and upload only validated assets with exact Content-Type and immutable cache headers.
2. Download uploaded bytes, compare SHA-256, decode them, and confirm displayed appearance.
3. Back up only affected values once. Apply URL changes with parameterized SQL guarded by company ID, previous logo, and previous updated_at; skip concurrent edits. Do not use an unconditional update.
4. Check logo relationships in lists, details, edits, and exports. Keep original manifests and object files for recovery. Only then plan any legacy application-logo cleanup.
5. Roll back an affected row only if its value still equals this migration's URL. Restore its original logo from `before.json`; preserve newer changes.

No upload or production-apply command is included that could accidentally run as part of build/test. Production apply and reverse-apply tooling should be finalized alongside the approved provider and verification process. The authenticated image route is an interim compatibility path, not a claim that images have already left PostgreSQL.

## Router, synchronization, and recovery design

Recommend one optimized writable PostgreSQL database plus independent recoverable backups first. A router does not manufacture a current copy of the data. Keep this reusable module in the existing backend; do not deploy another service now.

If a router is eventually justified, separate its control plane (provider registry, operator authentication, active-provider generation, approval audit log) from its data plane (bounded connections to exactly one approved writer). Readiness must include replication watermark, schema version, credentials/TLS, and a documented fencing mechanism. Store the authoritative writer generation somewhere that is not lost with the failed database. Health checks alone cannot grant write authority. Stop with an unavailable response when fencing or standby freshness cannot be established. Never fall back silently to JSON or an empty second database.

| Recovery method | Correctness/operational implications | Recommendation |
| --- | --- | --- |
| Scheduled backup + verified restore | Recovery-point objective is backup age; recovery-time objective includes restore and validation; deleted rows are reflected in a restored snapshot | First option for this small workload; frequency must fit transfer budget |
| Timestamp-based incremental copy | Misses deletions without tombstones and can miss concurrent changes without a consistent checkpoint | Do not implement a naive `updated_at` copier |
| Logical replication / CDC | Initial snapshot plus ongoing changes; requires compatible permissions, schema coordination, monitoring, and a bounded lag | Research only; do not enable on production |
| Active-active writes | Conflict resolution and split-brain risk | Out of scope |

Neon supports logical replication, but enabling its publishing setting is documented as irreversible. Replication starts with a snapshot; publisher availability is necessary for final catch-up. [Neon replication guide](https://neon.com/docs/guides/logical-replication-guide). Neon counts logical replication output in public transfer; quotas apply per project. [Neon plans](https://neon.com/docs/introduction/plans).

PostgreSQL logical replication does not copy DDL or sequence state automatically. Updates/deletes need a suitable replica identity. Provision compatible schema, verify sequence values before promotion, and test inserts, updates, deletes, JSON leads, ownership, and migrations. [PostgreSQL restrictions](https://www.postgresql.org/docs/current/logical-replication-restrictions.html).

Manual failover runbook: pause/fence old-primary writes; record its last confirmed checkpoint when available; verify candidate schema, completeness, lag, and backup; explicitly accept any unconfirmed data-loss window; promote one writer; update routing/configuration and drain stale pools; verify SSO, CRUD, archived leads, logos, analytics, imports/exports, and Notion exactly-once/retry behavior; record the new generation. If the old primary cannot be fenced or candidate freshness is unknown, remain unavailable rather than promoting unsafely.

Failback is a new controlled transition: keep the recovered database non-writable, reconcile changes from the current primary, verify deletes/sequences/schema, pause writes for final catch-up, fence the outgoing writer, change authority, drain old connections, and repeat validation. Never overwrite the newer database with an older snapshot. Fault tests for stale standby, partitioned primary, failed promotion, and failback remain future disposable-database work; no live failover system is claimed.

## Google Cloud feasibility and cost boundaries

The published Compute Engine allowance covers eligible e2-micro time in us-west1/us-central1/us-east1, 30 GB-month standard persistent disk, and 1 GB eligible outbound transfer monthly; destination restrictions apply. The trial offers $300/90 days and stops resources on expiry if not upgraded. Existing billing-account usage shares applicable quotas. [Google Cloud Free Program](https://cloud.google.com/free/docs/free-cloud-features).

An e2-micro has 1 GB RAM and shared CPU; benchmark with small connection pools and conservative PostgreSQL memory settings. Reserve memory for the OS, monitoring, and backups. Avoid configuring production tuning from generic defaults without observing load. [Machine specifications](https://docs.cloud.google.com/compute/docs/general-purpose-machines).

Do not promise a zero monthly bill: assess external IPv4, additional disk/snapshots, backups, network destinations, Vercel placement, and any proxy/VPN/connector. Model monthly cost as eligible compute minus remaining allowance + disk + address + outbound transfer + backups/operations. No account eligibility, trial balance, or deployment-region configuration was accessed here, so an account-specific dollar estimate remains unverified. Vercel-to-VM connectivity needs an approved TLS/network design; unrestricted public PostgreSQL is unacceptable. Cloud Run is not itself a durable PostgreSQL host.

| Option | Assessment |
| --- | --- |
| Optimized Neon only | Simplest first choice; verify transfer after deployment and budget independent backups |
| Google VM PostgreSQL only | Portable, but patching, TLS, disk recovery and on-call work become owner's responsibility |
| Neon primary + Google standby | Extra initial/ongoing transfer and operational work; freshness/fencing must be demonstrated |
| Google primary + Neon standby | Same replication/authority issues; outbound allowance and database size limits still matter |
| Future physical server + cloud recovery | Requires power/network reliability, offsite backups, and a tested restoration path |

No cloud resources were created. Google feasibility is research, not a tested deployment or a claim of free high availability.

## Validation, rollout, and rollback

`npm run test:database` executes real PostgreSQL SQL through local PGlite, tests parameter binding and one-connection transaction rollback through an adapter mock, checks privacy of diagnostics, and verifies offline image preparation. `npm run test:database:ui` browser tests exercise pagination, full-record hydration before save, search outside previews, archive/unarchive/delete, and custom platform persistence with mocked APIs. Core analytics/ownership/Notion tests remain required.

Synthetic benchmark: 60 applications and one archived lead with long duplicated descriptions, notes, fit explanations and a repeated PNG. Full JSON: 6,166,816 bytes; compact JSON: 95,722 bytes, a 98.45% reduction for this fixture. This is not measured production traffic or a prediction of monthly savings. The reproducible report is generated locally at `.data/database-fixture-benchmark.json`.

No new schema is required by these read-path changes. Build with `npm run build`; this no longer connects to PostgreSQL to migrate it. Run `npm run db:migrate` only in a separately approved change window after reviewing its existing duplicate maintenance and backup behavior. Confirm the existing nullable analytics/profile columns before deployment; a successful compilation does not prove schema readiness.

After approval/deployment: collect a short bounded metrics window, compare list/detail/search/analytics traffic and request frequency against the same workflow, then reconcile with provider usage over the matching period. Do not run repeated full dumps. Validate all workflows above, including own-vs-other account boundaries and full text preservation after editing.

Code rollback: revert this change and rebuild; no schema reversal or data restoration is needed for the read optimizations. Keep object migrations separate, with their own guarded rollback. Automatic router deployment, paid infrastructure, production replication, production schema/data changes, and credentials changes remain unperformed.

### Verification record

| Check | Result |
| --- | --- |
| `npm run test:core` | 79 passing tests |
| `npm run test:database` | 7 passing tests, including actual PostgreSQL SQL in local PGlite |
| `npm run test:pipeline:ui` | 13 passing browser tests |
| `npm run test:database:ui` | 5 passing checks for summaries, edits, search, archived leads, and custom platforms |
| Analytics UI tests | All 3 cases passed; the corrected Walk-in normalization case was rerun separately |
| `npm run test:company-icons` | 6 passing tests |
| `npm run test:job-platforms` | 4 passing tests |
| TypeScript and new-module ESLint | Passed |
| Next.js production build | Passed with database access disabled; no migration ran |

The initial regression run exposed outdated normalized-platform expectations, mock routes missing the new detail reads, and selectors matching hidden retained panels. Tests were corrected to exercise the current contracts and visible views; failures were rerun successfully. The first build also caught a duplicate import, which was removed before the successful final build.

Remaining verification: real production transfer and request metrics; actual account/provider cost eligibility; real TCP PostgreSQL TLS and cloud connectivity; object upload/hash verification and guarded URL apply/rollback; backup restoration and any future replication/failover drills. These require separate approved environments or access and were not substituted with claims based on mocks. Package installation reported dependency audit advisories; broad dependency upgrades/security remediation were outside this change and were not applied automatically.
