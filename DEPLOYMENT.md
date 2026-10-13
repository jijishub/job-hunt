# 🚀 Complete Deployment Guide: Job Hunt & Leads Hub

This guide walks you through deploying the **Job Hunt & Leads** application to **Vercel** with your custom domain **`jobhunt.jizellecasia.site`**, connecting **Neon PostgreSQL**, configuring **Google OAuth SSO**, and enabling **Notion 2-Way Live Sync**.

---

## 📋 Table of Contents
1. [Architecture & Prerequisites](#1-architecture--prerequisites)
2. [Step 1: Push Latest Code to GitHub](#step-1-push-latest-code-to-github)
3. [Step 2: Database Setup (Free Serverless Postgres)](#step-2-database-setup-free-serverless-postgres)
4. [Step 3: Deploy to Vercel](#step-3-deploy-to-vercel)
5. [Step 4: Connect Custom Domain (`jobhunt.jizellecasia.site` on Cloudflare)](#step-4-connect-custom-domain-jobhuntjizellecasiasite-on-cloudflare)
6. [Step 5: Configure Google Cloud OAuth SSO](#step-5-configure-google-cloud-oauth-sso)
7. [Step 6: Notion 2-Way Live Sync Verification](#step-6-notion-2-way-live-sync-verification)
8. [Step 7: Post-Deployment Smoke Test](#step-7-post-deployment-smoke-test)

---

## 1. Architecture & Prerequisites

- **Frontend & API**: Next.js 16 (App Router + Turbopack) on Vercel.
- **Database**: PostgreSQL (Neon Serverless Postgres / Vercel Postgres).
- **Authentication**: NextAuth.js with Google OAuth SSO + RBAC (`admin` / `member`).
- **Sync Engine**: Notion API (`@notionhq/client`) for Admin; Cloud DB isolation for Members.
- **Accounts Needed**:
  - [GitHub Account](https://github.com) (Repository: `jijishub/job-hunt`)
  - [Vercel Account](https://vercel.com)
  - [Neon Account](https://neon.tech) (or Vercel Postgres storage tab)
  - [Google Cloud Console Account](https://console.cloud.google.com)
  - DNS Registrar managing `jizellecasia.site` (Namecheap, GoDaddy, Cloudflare, etc.)

---

## Step 1: Push Latest Code to GitHub

Before deploying, ensure all latest commits with RBAC, user editing, and Google SSO settings are pushed to GitHub:

```bash
git add .
git commit -m "feat: complete RBAC, user editing, Google SSO UI, and separated navigation"
git push origin main
```

Verify your repository is updated at: [https://github.com/jijishub/job-hunt](https://github.com/jijishub/job-hunt)

---

## Step 2: Database Setup (Free Serverless Postgres)

Database migrations run before the production build through `npm run build`. They create and update the tables and preserve archived duplicates; normal application requests no longer run schema maintenance. For a local PostgreSQL database, run `npm run db:migrate` after configuring the environment and before starting the app. Local JSON storage does not require a migration.

The analytics changes require nullable application columns for `seniority_level`, `seniority_level_source`, `role_family`, `role_family_source`, `job_platform`, and `first_response_at`, plus filtering indexes. The role-family columns are historical compatibility data; new drafts and current analytics no longer derive or use them. Keyword analytics requires no new columns or migration. Preferences store configurable application-age boundaries in their existing JSON. Saved optional pipeline reports require the nullable `candidate_profiles.pipeline_insights` JSONB column, added by the same migration. Keep `npm run build` as the deployment command so the required migrations run before the new application code is served. Running `next build` directly checks compilation but does not verify or apply database migrations. The URL platform backfill adds only its platform column when needed and is not a substitute for this full migration.

### Option A: Neon Serverless Postgres (Recommended - Generous Free Tier)
1. Go to [Neon.tech](https://neon.tech) and create a free project named `job-hunt-prod`.
2. In the Neon Dashboard, copy the connection string:
   ```
   postgres://username:password@ep-xyz.region.aws.neon.tech/neondb?sslmode=require
   ```
3. Save this as your `POSTGRES_URL`.

### Option B: Vercel Postgres
1. In your Vercel Dashboard, go to **Storage** &rarr; **Create Database** &rarr; **Postgres**.
2. Name it `job-hunt-db`.
3. Vercel will automatically expose `POSTGRES_URL` to your project environment variables.

---

## Step 3: Deploy to Vercel

1. Navigate to [vercel.com/new](https://vercel.com/new).
2. Click **Import** next to `jijishub/job-hunt`.
3. In **Project Settings**:
   - **Framework Preset**: `Next.js`
   - **Root Directory**: `./`
   - **Build Command**: `npm run build` (set by `vercel.json`, includes database migrations)
4. Expand **Environment Variables** and add:

| Key | Example Value | Description |
|---|---|---|
| `POSTGRES_URL` | `postgres://user:pass@ep-xyz.neon.tech/neondb?sslmode=require` | Neon or Vercel Postgres connection string |
| `NEXTAUTH_URL` | `https://jobhunt.jizellecasia.site` | Full URL of your live production app |
| `NEXTAUTH_SECRET` | `generate-a-random-32-char-string` | Secret key for JWT signing |
| `ADMIN_EMAIL` | `admin@example.com` | Email automatically granted the 👑 Administrator role |
| `NOTION_API_KEY` | `YOUR_NOTION_API_KEY` | Your Notion Integration API Secret |
| `NOTION_DATABASE_ID` | `YOUR_NOTION_DATABASE_ID` | 32-character Notion Database ID |
| `GOOGLE_CLIENT_ID` | `xxxx.apps.googleusercontent.com` | Google Cloud OAuth Client ID |
| `GOOGLE_CLIENT_SECRET` | `GOCSPX-xxxx` | Google Cloud OAuth Client Secret |
| `AI_BASE_URL` | `https://api.jizellecasia.site/v1` | Optional AI endpoint for explicitly requested AI features |
| `AI_API_KEY` | `YOUR_AI_API_KEY` | Required for AI-powered features, not for application tracking or analytics |
| `AI_DEFAULT_MODEL` | `luna` | Optional default model for AI requests |

> **Tip for `NEXTAUTH_SECRET`**: You can generate one via terminal with:
> ```bash
> openssl rand -base64 32
> ```

Analytics uses persisted application data and saved fit results. Loading, scope changes, comparisons, age-range changes, and PDF export must work with the AI key missing or the provider unavailable. **Analyze my pipeline with AI** is the optional exception and runs only after a click. An AI error must leave the dashboard and exports usable.

The optional admin RPA helper requires a server-side `RPA_PROFILE_JSON` containing its private profile when deployed. Its local fallback file is Git-ignored and will not be present in a Git-based deployment. Do not use a `NEXT_PUBLIC_` variable for this data. Without a configured profile, the helper returns a configuration error while the application and analytics remain available. Keep personal inputs and credentials out of public source control; ignore rules do not remove earlier commits.

5. Click **Deploy** and check the build logs for both migration completion and a successful production build. Then perform the smoke checks below.

---

## Step 4: Connect Custom Domain (`jobhunt.jizellecasia.site` on Cloudflare)

### 1. In Cloudflare DNS (`jizellecasia.site`):
Add a single CNAME record with **DNS only (Grey Cloud)**:

| Type | Name | Target / Content | Proxy status | TTL |
|---|---|---|---|---|
| **CNAME** | `jobhunt` | `cname.vercel-dns.com` | **DNS only (Grey Cloud ⚪)** | Auto |

> [!WARNING]
> **Cloudflare Proxy must be OFF (Grey Cloud)**:
> In Cloudflare, make sure the orange cloud is switched to **DNS only (Grey Cloud)**. If Cloudflare Proxy is enabled during setup, Vercel will fail to issue the SSL certificate or trigger an infinite redirect loop.

### 2. In Vercel Project Settings:
1. In your project on Vercel, go to **Settings** &rarr; **Domains**.
2. Type **`jobhunt.jizellecasia.site`** and click **Add**.
3. Vercel will immediately see the CNAME pointing to `cname.vercel-dns.com` and automatically generate your free **SSL Certificate**!

---

## Step 5: Configure Google Cloud OAuth SSO

Because your domain is `jobhunt.jizellecasia.site`, Google OAuth requires this domain in its whitelist:

1. Go to [Google Cloud Console Credentials](https://console.cloud.google.com/apis/credentials).
2. Click your OAuth 2.0 Web Client ID.
3. Under **Authorized JavaScript origins**, ensure you have:
   - `https://jobhunt.jizellecasia.site`
   - `http://localhost:3000` (for local dev)
4. Under **Authorized redirect URIs**, add:
   - `https://jobhunt.jizellecasia.site/api/auth/callback/google`
   - `http://localhost:3000/api/auth/callback/google` (for local dev)
5. Click **Save**.
6. In Vercel **Settings** &rarr; **Environment Variables**:
   - Set `NEXTAUTH_URL` to `https://jobhunt.jizellecasia.site`
   - Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` (if not already set)
   - Redeploy or click **Redeploy** on the latest deployment so the new `NEXTAUTH_URL` takes effect.

---

## Step 6: Notion 2-Way Live Sync Verification

1. Ensure your Notion Database has been shared with your integration:
   - Open your Notion Database: [https://app.notion.com/p/cloudji/YOUR_NOTION_DATABASE_ID](https://app.notion.com/p/cloudji/YOUR_NOTION_DATABASE_ID).
   - Click `··· (top right)` &rarr; **Connect to** &rarr; select **Job Tracker**.
2. **Optional Webhook for Instant Notion &rarr; Web Push**:
   - In your app, open **Notion Settings** (`⚙️` icon next to Notion Live badge).
   - Copy the Webhook endpoint:
     ```
     https://jobhunt.jizellecasia.site/api/notion/webhook
     ```
   - Connect this in your Notion automation or Zapier/Make webhook trigger.

---

## Step 7: Post-Deployment Smoke Test

Once deployed, run these smoke checks:

1. **Sign-In Verification**:
   - Open your live site (`https://jobhunt.jizellecasia.site`).
   - Notice the prominent, cute favicon emblem centered on the left side of the login page.
   - Click **Continue with Google** &rarr; authenticate with your authorized Google account.
   - Confirm you have the **👑 ADMIN** badge in the header.
2. **RBAC Isolation Verification**:
   - Open **Manage Accounts & RBAC**.
   - Confirm a non-administrator test account is assigned as **MEMBER** with the Cloud DB badge.
   - Sign in separately as that member: confirm Notion buttons and user management are hidden and records remain isolated.
3. **Notion 2-Way Sync**:
   - As an administrator, use Sync Notion and confirm records and configured statuses synchronize without error.
4. **AI Resume & ATS Matcher (optional)**:
   - Navigate to the **AI Resume & ATS** tab.
   - Save a test master resume in My preferences, using PDF upload or resume text.
   - Select an existing job or paste a job description.
   - Select a configured model and click **Run AI ATS Match & Pitch**.
   - Verify the returned score, missing keywords, and generated report. Skip this check when AI is intentionally unconfigured.
   - Detailed ATS reports use a 150-second AI deadline and a 180-second route budget; keep [Vercel Fluid Compute](https://vercel.com/docs/functions/configuring-functions/duration) enabled for this longer runtime. A timeout should show a retry message and preserve an existing report. Short role-fit assessments retain their separate 25-second deadline. Use `npm run test:ats:ui` for these browser checks.
5. **Dedicated Leads Hub**:
   - Open the **🎯 Leads** tab.
   - Review incoming leads from portfolio or add a new lead.
   - Click **Promote to Applied**: verify the lead converts seamlessly into an active tracked application.
6. **Application fields for admins and members**:
   - Open an application and confirm **Referral** and **Walk-in** are suggested in Job platform; custom values remain available.
   - Confirm **Junior AI Engineer** derives as Junior and **AI Engineer** as Unspecified. Set a manual seniority or role-family override, change the title, and verify it persists. Reset to Automatic and verify the title rules take over.
   - Record an actual first employer response date, save, reopen, and confirm it is retained. The form uses local time and stores UTC.
   - Test the bottom-right **Import job JSON** shortcut for an admin and a member: the paste box should open immediately, **Fill draft & assess fit** should request fit only for that draft, and **Create Application** should remain available after an AI failure. Closing without creating must not save a record.

7. **AI-independent analytics and PDF**:
   - Check the matching Pipeline, Effectiveness, Timing, and Career insights sections. A normal export should have four readable pages; long preference targets or extra salary units may add an appendix. Verify chart sample sizes and click through to the corresponding records.
   - Use a preview environment without an AI key, or block the AI endpoint in a test browser. Confirm Analytics loads and internship/regular-employment scope changes update charts without assessment requests.
   - Review role-family, seniority, platform, saved-fit and cohort comparisons. Missing assessments should remain Unassessed; missing response dates should remain unknown.
   - Change age boundaries in My preferences and verify the unanswered chart, age drilldowns and PDF use the same non-overlapping ranges. Closed or previously progressed records must not appear as unanswered.
   - Verify the 7/14/30-day response windows exclude applications too recent to complete each window and report unknown timing separately. Callback time must use recorded first responses, not save timestamps or pending age; time to interview remains unknown without an actual event date.
   - Inspect the exported PDF: the actual logo should render on each A4 page, with readable labels and no AI text or placeholders. Save a new application from another session before exporting and confirm the fresh saved totals are included.
   - Confirm Pipeline insights appears above charts. Click **Analyze my pipeline with AI** explicitly. A failure must leave filtering and PDF export available; a failed retry must preserve the last successful interpretation. Reload and verify the saved scope-specific report remains; change an application, preference or resume and verify the outdated label appears without a new AI request.

Local verification commands are `npm run test:core`, `npm run test:job-platforms`, and `npm run test:analytics:ui`. Browser tests need a running local server at `http://localhost:3100` (or `PIPELINE_TEST_URL`). A successful local build or mocked browser test does not establish that a live deployment has passed these smoke checks. See [RPA-COMMANDS.md](RPA-COMMANDS.md) for optional URL platform backfill instructions.

---

## 🛠️ Ongoing Maintenance & Updates

Any time you make improvements locally:
```bash
git add .
git commit -m "feat: your new feature"
git push origin main
```
With Git deployment configured, commits on the deployment branch trigger the build and deployment. Confirm the migration and build results in the deployment logs, then repeat the smoke checks for changed functionality.
