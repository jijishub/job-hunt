# RPA quick reference

Run commands from the project root. Personal browser helpers are owner-specific workflows, not a general-purpose application bot or a clone-and-run setup.

## Personal application and profile helpers

| Command | Purpose |
| --- | --- |
| `npm run rpa:bossjob` | Prepare an owner-configured profile update helper. |
| `npm run rpa:jobstreet` | Prepare an owner-configured profile and resume update helper. |
| `npm run rpa:bytedance` | Open a dedicated browser profile and fill a configured application for review. |
| `npm run rpa:appficiency` | Prepare a configured application helper for review. |

These workflows depend on the owner's resume and application configuration. Profile helpers can save edits; application submission requires manual review. Generated helpers, browser profiles, and reports belong in the ignored `.data/` directory. Personal inputs should be backed up privately rather than included in a public showcase.

Detailed owner operating notes are kept locally at `references/rpa/RPA-OPERATIONS.md`, outside the public documentation. That ignored file is not included in a clone of the repository. Browser tests use local fixtures and do not verify a live account.

Validation: `npm run test:bossjob` and `npm run test:jobstreet`.

## Internal job-platform backfill

This helper reads saved URLs without opening job sites or calling AI.

| Command | Purpose |
| --- | --- |
| `npm run rpa:job-platforms:preview` | Preview missing platforms for the configured administrator account. |
| `npm run rpa:job-platforms` | Apply and verify recognized platforms in that account's applications and leads. |
| `npm run test:job-platforms` | Check matching, account isolation, preservation, and guarded writes. |

To target a particular account, preview first and then apply:

```powershell
node scripts/backfill_job_platforms.cjs --owner ACCOUNT_ID_OR_EMAIL
node scripts/backfill_job_platforms.cjs --owner ACCOUNT_ID_OR_EMAIL --apply
```

The default account matches `ADMIN_EMAIL`. Storage uses configured PostgreSQL (`POSTGRES_URL` or `DATABASE_URL`), or `.data/db.json` when neither is set. Existing selections and other accounts are preserved; concurrent edits are skipped. Only platform values and update timestamps change. Missing URLs, email addresses, short links, and unknown hosts remain unclassified. Referral and Walk-in require manual selection.

The helper adds only the platform column if needed; deployment migrations remain separate. Reports and prior values are saved under `.data/job-platform-backfill-*`, with a full pre-update backup for local JSON storage. See [ANALYTICS.md](ANALYTICS.md) for calculation and backfill details.
