<p align="center">
  <img src="public/job-hunt%20official%20text.png" alt="Job Hunt" width="360" />
</p>

<p align="center"><strong>🌸 Aim with High Precision.</strong></p>
<p align="center">Your job search, thoughtfully organized—with room for both ambition and analytics.</p>
<p align="center">
  <a href="https://jobhunt.jizellecasia.site">Open Job Hunt</a> ·
  <a href="#getting-started">Local setup</a> ·
  <a href="DEPLOYMENT.md">Deployment guide</a>
</p>

---

## Meet Job Hunt

**Job Hunt is a personalized job application and leads platform** that brings application tracking, AI resume tools, interactive analytics, salary insights, and two-way Notion sync into one workspace.

This public repository showcases a personal project and includes owner-specific job-application RPA kept for code backup. It is not maintained as a clone-and-run template; those workflows depend on personal configuration.

Save the roles that interest you, keep your notes close, and explore how your applications move through the hiring process. From your first internship to your next career move, your records grow into a picture you can actually learn from.

*Blush pink, soft white, and practical details throughout. A workspace you can make your own.*

### Why I built it

I built Job Hunt to bring application tracking, saved role assessments, and salary comparisons into one place. It grew into an invitation-only workspace that supports different kinds of job searches.

The analytics are the part I get excited about: which roles reach interviews, how fit ratings compare with outcomes, and how salary offers line up with expectations. Job Hunt gives those questions a place to live.

## ✧ Inside the workspace

| Feature | What it brings to your search |
| --- | --- |
| **Your application pipeline** | Switch between a table and board; keep job descriptions, personal notes, dates, and hiring stages together. Screening and interviews share a **Screening / Interview** column after Applied, including online and in-person assessments. |
| **Automatic progress and reversible archiving** | Analytics follows the highest recorded hiring phase. Not Proceeding archives locally without changing the recorded job status or Notion backup. Use Archive to review a record and uncheck Not Proceeding to restore it. Works for admins and members. |
| **A home for promising leads** | Browse Saved leads or Discover, and open Quick Add from the same toolbar to save a real posting in a modal. See each lead's profile-fit rating and click it to open that lead's details and saved assessment. |
| **AI when you need it** | Use your master resume for ATS matching and role-fit assessments, with explanations you can review. Switching tabs keeps the current ATS report available when you return. |
| **Analytics you can explore** | Follow submissions, interviews, offers, and rejections; compare job-title keywords, seniority, platforms, and saved fit ratings. Calculations, filters, and PDF exports work without an AI provider. |
| **Waiting time, made visible** | Review unanswered applications by age, drill into their records, and compare recorded employer responses over 7/14/30-day observation windows. Change age ranges in My preferences. |
| **Details that fit your search** | Seniority uses explicit title rules with manual overrides. Job-title keyword charts need no extra fields. Record a job platform, Referral, or Walk-in; these options are available to admins and members. |
| **Salary expectations, made visible** | Compare actual offers with what you asked for, including median amounts and offer gaps within the same currency and pay period. |
| **A view that grows with you** | Keep internships and regular employment together or separate. Save your default view, targets, and analytics mappings. |
| **Companies worth remembering** | Reuse company profiles and logos across applications and leads. |
| **Connected, personal records** | Sign in with Google to access your own data; administrator tools add two-way Notion sync and account management. |

### From a lead to an insight

1. **Find a role.** Explore search keywords or save a posting you already have.
2. **Keep the context.** Add the description, your notes, and your salary expectation.
3. **Track what happens.** Update hiring stages, record the actual first employer response date, and add an offer when it arrives.
4. **Explore your progress.** Review the patterns in Analytics and decide what to try next.

New leads and applications start at **Not started** without an applied date. When you first mark or save an application as **Applied**, today's date is automatically captured on **Date applied** and kept. When you receive screening or progression (moving from Applied to Screening, Assessment, Interview, or custom progression statuses configured in My preferences), the **First employer response** timestamp is automatically captured as the date of that status switch and retained. Both dates remain editable. Role-fit analysis runs when you request it. AI discovery provides search ideas to research, and leads stay separate until you mark them applied. Salary comparisons pair the same application with matching currency and pay period.

Use **Failed Assessment** for an unsuccessful assessment, whether online or in person. It belongs under **Archived / Rejected** on the board and retains **Screening** as its recruitment phase in analytics. The older **Failed Online Assessment** label is recognized as **Failed Assessment**.

Saved leads sort primarily by role fit and secondarily by priority, showing **Strong fit**, **Possible fit**, **Weak fit**, or **Unassessed**, using their saved role-fit data. Open a lead through its title or fit badge to review its details; AI Match opens the resume matcher for that role. Discover generates search keywords for LinkedIn, JobStreet, Indeed, and Google Jobs.

AI reports and search keywords stay available when switching tabs; failed retries preserve the last successful result.

For easy-add, use **Copy Prompt** with **Ask Gemini** in Chrome on the shared job-posting tab. Include the posting URL and full text if needed; the Gemini website is the fallback. Gemini extracts the posting directly, and the in-app **Guide** explains the steps.

The Guide starts with saving your master resume. When a newer deployment is available, a persistent update bar asks you to save any open draft and choose **Reload now**.

Use the bottom-right **Import job JSON** shortcut, paste Gemini's JSON, then choose **Fill draft & assess fit**. Review the filled draft and requested role-fit assessment before clicking **Create Application**. If AI fails, you can save as Unassessed.

Standard import remains available under **New App ? Job description (Information) ? Import job JSON ? Fill draft from JSON**, with no in-app AI request or browser automation required. Check the company, role, description, location, salary and dates against the posting. Keep **Not started** for a lead, or choose **Applied** after submitting. Neither import creates a record until you save.

The JSON prompt includes `seniority_level`, `job_platform`, and `first_response_at`. Gemini leaves seniority null; the importer derives it from the title using the application's rules and preserves existing manual seniority overrides in the draft. Platforms can come from explicit context or deterministic URL matching. Referral and Walk-in need explicit context. Response dates remain blank unless you supply the actual employer response time; job-posting dates and status update times are not used. Null or omitted response dates leave an existing recorded response unchanged.

Changing a role to **Weak fit** automatically sets priority to **Low**; changing it to **Strong fit** sets priority to **High**. You can then edit either field independently; changing priority or saving other details keeps your chosen fit and priority. Possible fit leaves priority unchanged.

The workspace adapts to mobile screens: lead cards fit the viewport, account menus stay on screen, long job titles leave room for modal actions, and AI model choices wrap inside their card. Account creation places the action below the icon picker on mobile.

Unknown posting facts stay unknown: JSON imports and new records no longer assume Full-time, On-site, or PHP when job type, work model, or advertised salary currency is missing. You can select these values in the form. Salary amounts without a currency are labeled **Currency unknown**. Offers and personal salary expectations keep their separate units.

Saved-role assessments preserve edits made while AI is running. If the record changes, reload it before assessing again.

The deployed extension API saves postings and extension-generated fits without fetching your server resume or rerunning AI. New roles start at **Not started**; duplicate imports preserve existing edits, ratings and priority. Server-side role fit and Gemini import remain available. Create a credential that stays valid until revoked in **My preferences → Job Hunt extension**. See the [capture contract](EXTENSION-CAPTURE-CONTRACT.md) for source preservation, provenance and delivery rules.

Check **Share saved preferences and live updates** when creating a new credential to allow read-only preference syncing. The extension must [subscribe to the preference API](EXTENSION-PREFERENCES-CONTRACT.md); existing fits stay unchanged. Authenticated production delivery and database-target equivalence remain unverified; see [deployment evidence and schema status](PRODUCTION-INTEGRATION.md). Usage savings have not been measured.

### Analytics from your saved records

Archived jobs remain included in Analytics with their recorded hiring history. Archiving alone does not count as rejection; roles you never applied to remain **Not submitted**.

Analytics reuses saved applications, assessments, and preferences. Loading the dashboard, changing scope, reviewing charts, and exporting a PDF never generate new AI assessments. Missing fit ratings stay **Unassessed**. The optional **Pipeline insights** card above the charts interprets computed statistics with your saved resume, assessments and preferences only after a click. Successful results are saved per scope, marked outdated after data changes, and preserved after failed retries.

The dashboard and PDF follow four readable sections: **Pipeline, Effectiveness, Timing, and Career insights**. The branded PDF refreshes saved data at export time, contains no AI interpretations, and normally fits four pages. Click dashboard charts to review their applications; long preference targets or extra salary units can add a PDF appendix.

In **My preferences → Analytics status mappings**, **Highest phase reached** records how far a status progressed; **Counts as rejection** records its outcome. A failed assessment can therefore reach Screening and count as a rejection without implying an interview took place. Rejection counting defaults to **Not Accepted** and **Failed Assessment**; existing saved selections remain in effect. Saving these mappings updates board placement immediately and persists after reload. **Not Proceeding** continues to use the separate archive workflow.

Seniority uses explicit title keywords: **Junior AI Engineer** is Junior, while **AI Engineer** is Unspecified. The eight categories run from Internship / Trainee through Lead / Principal, including Graduate / Entry-level, Junior, Associate, Mid-level, and Senior. Automatic seniority follows title edits; manual overrides stay intact until you reset them. Keyword charts count distinct submitted applications containing each title word or short phrase; counts overlap, and progression comparisons require at least five applications. The form's **Job platform** field accepts custom values alongside its suggestions, including **Referral** and **Walk-in** for all users.

Application age comes from the existing submission date and the reporting date; no age field is stored. The unanswered chart excludes closed and previously progressed applications, and keeps missing, invalid, or future dates under unknown age. Default ranges are **0–7, 8–14, 15–30, and 31+ days**. You can change the three boundaries in My preferences; they are display groups, not hiring benchmarks. Aging refreshes when the reporting day changes.

Callback averages and medians require an actual saved **First employer response** timestamp. Moving an application from Applied into a screening or progression status automatically captures this first response date (and respects custom status mappings from My preferences). Status-history dates record database saves, so other stage transitions do not overwrite your recorded first response date. The 7/14/30-day response rates exclude applications too recent to complete the window and report unknown timing separately. Time to interview remains unknown without a recorded interview event date. Counting rules and exclusions are available under **Data checks & counting rules** in Analytics.

## Built with

**Next.js 16** · **React 19** · **TypeScript** · **Tailwind CSS 4**

Neon PostgreSQL for storage, NextAuth for authentication, Notion for administrator sync, and a configurable AI endpoint for analysis.

## Getting started

Install Node.js and npm, then install dependencies and copy the environment template:

```powershell
npm install
Copy-Item .env.example .env.local
```

Set `NEXTAUTH_URL` to `http://localhost:3000` for local development, and add your configuration to `.env.local`:

| Purpose | Variables |
| --- | --- |
| Authentication | `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` |
| Database | `POSTGRES_URL` |
| Administrator | `ADMIN_EMAIL` |
| Optional AI features | `AI_BASE_URL`, `AI_API_KEY`, `AI_DEFAULT_MODEL` |
| Administrator Notion sync | `NOTION_API_KEY`, `NOTION_DATABASE_ID` |
| Optional Notion webhook | `NOTION_WEBHOOK_SECRET` |

`npm run dev` defaults to isolated local JSON storage even when production database URLs are configured. Use a separate `DEV_DATABASE_URL` and optional `DEV_DB_DRIVER` for PostgreSQL development. Set `DB_MODE=local` and `DB_LOCAL_DIR=.data/development` to explicitly isolate development from inherited production URLs. `DB_DRIVER=postgres` supports ordinary PostgreSQL; Neon remains the default driver. Keep credentials in your environment files, outside source control. See the [deployment guide](DEPLOYMENT.md) for hosting and Google OAuth setup.

An AI API key is required only for explicitly AI-powered features. Application tracking, deterministic analytics, filtering, and PDF export remain available without it.

Start the development server with `npm run dev`, then open [localhost:3000](http://localhost:3000). Google sign-in requires the OAuth configuration above.

When `DEV_DATABASE_URL` is configured, run `npm run db:migrate:dev` before local development. The generic `db:migrate` command targets the configured primary database and requires a separate approved change window. `npm run build` compiles without database migrations. Run migrations explicitly against an approved target; ordinary requests also skip schema maintenance.

Application saves finish after database persistence. Administrator Notion sync runs after the response, and company refresh runs without holding the form open. Failed Notion writes remain marked `ERROR`; pending or failed records can be retried with Sync Notion. Refresh the workspace to see completed background sync state.

## Useful commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start local development. |
| `npm run test:database` | Validate SQL projections, privacy, transactions, and offline logo preparation locally. |
| `npm run db:metrics -- LOG_FILE` | Summarize opt-in database/API metadata logs without connecting to the database. |
| `npm run build` | Create the production build without changing database schema or data. |
| `npm run db:migrate` | Apply database setup and migrations explicitly. |
| `npm run db:migrate:credentials` | Apply targeted extension credential expiry migration explicitly. |
| `npm run start` | Serve the production build. |
| `npm run test:pipeline` | Check analytics, application APIs, and persistence. |
| `npm run test:core` | Check pipeline, lead storage, Notion retry behavior, and secret configuration. |
| `npm run test:captures` | Check capture validation, credentials, atomic imports, replay/deduplication, unknown facts, and conditional assessments using local JSON and embedded PostgreSQL. |
| `npm run test:captures:ui` | Check credential creation, one-time display, closing preferences, and revocation against a local server. |
| `npm run test:pipeline:ui` | Check browser flows against a running local server. |
| `npm run test:analytics:ui` | Check aging drilldowns, configurable ranges, optional AI failures, application fields, and PDF export against a running local server. |
| `npm run test:job-platforms` | Check URL classification, account isolation, selected-platform preservation, and guarded backfill writes. |
| `npm run test:save:ui` | Verify a slow company refresh does not keep the save form open. |
| `npm run test:mobile:ui` | Check mobile and desktop layouts, Quick Add modal behavior, and clickable lead-fit badges. |
| `npm run test:report` | Check ATS report rendering and pagination in Chrome. |
| `npx tsc --noEmit` | Check TypeScript. |
| `npm run company-icons:preview` | List companies missing icons without changing records. |
| `npm run company-icons` | Research and fill missing company icons. |
| `npm run rpa:job-platforms:preview` | Preview missing job platforms inferred from saved URLs for the configured administrator account. |
| `npm run rpa:job-platforms` | Apply and verify that account's URL platform backfill in applications and leads. |

Browser checks use Chrome and `http://localhost:3100` by default. Start the app with `npx next dev -p 3100`, or set `PIPELINE_TEST_URL` to your local server.

The dashboard uses compact application summaries, paginated table views, complete-history analytics, and on-demand application details. Embedded company logos remain visible through cached image URLs. See [database operations](DATABASE-OPERATIONS.md) for diagnostics, provider adapters, offline logo migration preparation, recovery research, and approval boundaries.

The `scripts/` directory contains database migrations, company-icon tooling, personal application/profile helpers, diagnostics, and regression tests. See [RPA-COMMANDS.md](RPA-COMMANDS.md) for the concise automation overview and internal URL platform backfill. Detailed owner operating notes stay in ignored local reference guidance.

The platform backfill uses hostname rules and does not open job sites or call AI. It preserves selected platforms and leaves missing or unrecognized URLs unclassified. A posting URL identifies its destination platform; it cannot prove a referral or walk-in, so choose those manually. Reports and previous values stay local under `.data/job-platform-backfill-*`. Use the explicit account option in the RPA guide to process a member's records.

For troubleshooting, `npm run diagnose:ai` checks AI configuration and tests authentication with a small model request when using the app's default AI gateway. `npm run audit:duplicates` reads narrow application identity/status references and reports duplicate counts without changing database records; `--full-backup` explicitly requests a full local backup. These commands use the configured services; the audit keeps artifacts in `.data/`. Neither is needed for normal app startup.

### Company icons

The icon job requires a signed-in Codex CLI and `POSTGRES_URL` in `.env.local`. It researches official logos, fills empty icons, preserves existing ones, and skips uncertain matches. Backups and source references go to `.data/company-icons/`. It uses your signed-in Codex account separately from the app's AI API.

---

<p align="center">🤍 A personal project, built for a very real job search.</p>
<p align="center">Created by <a href="https://jizellecasia.site">Jizelle Casia</a> · <a href="https://jobhunt.jizellecasia.site">Visit Job Hunt</a></p>
