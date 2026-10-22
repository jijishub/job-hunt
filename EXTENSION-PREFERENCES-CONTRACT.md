# Extension preference snapshots and live events (v1)

Canonical origin: `https://jobhunt.jizellecasia.site`. This API lets the extension read saved Job Hunt preferences before assessing a role and receive subsequent changes. It never loads the server master resume, runs AI, alters a fit or modifies a frozen upload.

## Pairing and permissions

In **My preferences → Job Hunt extension**, check **Share saved preferences and live updates** before creating a credential. The signed-in same-origin issuance request is `{ "label": "My browser", "share_preferences": true }`. This adds the read-only `preferences:read` scope to the existing capture scopes. Unchecked or omitted leaves capture-only behavior unchanged. Existing tokens do not gain access; revoke the old credential before creating a replacement. Credentials stay valid until revoked, the secret is displayed once, and account ownership comes exclusively from the token.

`GET /api/v1/connection` adds boolean `capabilities.preferences` and `capabilities.preference_events`, true only when that credential has the scope. No preference write, resume read or account administration scope exists.

## Snapshot

`GET /api/v1/preferences`, with `Authorization: Bearer <scoped credential>`, returns:

```json
{
  "schema_version": 1,
  "account": { "id": "account-id", "email": "account@example.com" },
  "revision": "sha256-of-canonical-preferences-json",
  "preferences": {},
  "assessment_preferences": {},
  "preferences_hash": "sha256-of-canonical-assessment-preferences-json"
}
```

`preferences` contains all saved preference form fields with validated defaults: targets, locations, work models, job types, salary, dealbreakers, portfolio summary, default view, custom platforms and analytics settings. It excludes resume text, AI keys, credentials and other account data. Only **saved** changes are observable; draft keystrokes, master-resume edits and credential management are separate operations.

`assessment_preferences` contains exactly `target_companies`, `target_roles`, `preferred_locations`, `work_models`, `job_types`, `salary_min` (number or null), `salary_currency`, `dealbreakers`, `portfolio_summary`. It excludes analytics/display settings so those changes do not invalidate fits. Its hash uses the capture contract's canonical JSON SHA-256 convention. Use this exact object as the AI preference context and bind the resulting assessment to `preferences_hash`. If local overrides are merged, hash the final effective context instead; do not claim the tracker hash for modified inputs.

The response includes `ETag: "<revision>"`; matching `If-None-Match` returns 304 without a body, after authenticating. Snapshots are private/no-store.

## Event stream

`GET /api/v1/preferences/events`, with the same Bearer header, returns `text/event-stream` with private/no-store/no-transform headers. Use streaming `fetch`; native `EventSource` cannot set the Authorization header. Never put tokens in query strings. Extension host permissions authorize access; token issuance remains same-origin only.

Events:

- `preferences.snapshot`: immediate full snapshot, including on every reconnect.
- `preferences.changed`: full snapshot when the saved preference revision changes. `id` is the current revision.
- Comment heartbeat when nothing changed.
- `reconnect`: reconnect after `retry_ms` (2000). Streams end after approximately 50 seconds within the 60-second serverless route budget.
- `stream.error`: `{ code, retryable }`; stop and request re-pairing for authentication/scope failures. For transient failures, use bounded exponential backoff and jitter.

The stream checks persisted preferences every 10 seconds and rechecks token expiry, revocation, scope and account existence before each snapshot read. Authentication failures before streaming retain JSON 401/403; storage failures return JSON 503. After headers are sent, failures use `stream.error` and close. The endpoint works across serverless instances without process-local listeners or a migration. Only keep a stream open while the extension UI needs updates; stop it on disconnect, account/origin change or browser suspension. Each active stream performs database reads about every 10 seconds; this is not a zero-query push service.

This is a latest-state stream, not a durable audit log: multiple saves within a polling interval may coalesce. `Last-Event-ID` is not a history cursor; reconnect always sends the authoritative current snapshot. Refetch immediately before starting an assessment to cover suspension/disconnection. A changed assessment preference hash invalidates pending/cached fit inputs; it must not silently mutate a frozen/delivered capture, change its UUID, or launch AI automatically. Existing saved fits remain unchanged until the user requests reassessment.

## Extension adoption and release evidence

The extension must implement the scoped pairing, snapshot fetch, streaming parser and preference-context binding above. Adding this tracker API alone does not make the current extension automatically consume it. Keep selected local resume behavior and upload/AI queues separate.

No database migration is required: preferences and credential scopes use existing JSONB columns. No additional test suites are run for this release; production build and anonymous endpoint checks do not prove authenticated live event delivery. Confirm the released commit through `/api/version` and Vercel's successful production deployment status.
