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

Our app has built-in auto-migration for PostgreSQL (automatically creates `users`, `companies`, and `applications` tables upon first request).

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
   - **Build Command**: `next build` (default)
4. Expand **Environment Variables** and add:

| Key | Example Value | Description |
|---|---|---|
| `POSTGRES_URL` | `postgres://user:pass@ep-xyz.neon.tech/neondb?sslmode=require` | Neon or Vercel Postgres connection string |
| `NEXTAUTH_URL` | `https://jobhunt.jizellecasia.site` | Full URL of your live production app |
| `NEXTAUTH_SECRET` | `generate-a-random-32-char-string` | Secret key for JWT signing |
| `ADMIN_EMAIL` | `jizellecasia@gmail.com` | Email automatically granted the 👑 Administrator role |
| `NOTION_API_KEY` | `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` | Your Notion Integration API Secret |
| `NOTION_DATABASE_ID` | `30d77105180580919dfdef58eaed5a54` | 32-character Notion Database ID |
| `GOOGLE_CLIENT_ID` | `xxxx.apps.googleusercontent.com` | Google Cloud OAuth Client ID |
| `GOOGLE_CLIENT_SECRET` | `GOCSPX-xxxx` | Google Cloud OAuth Client Secret |
| `AI_BASE_URL` | `https://api.jizellecasia.site/v1` | OpenAI-compatible AI Proxy base URL |
| `AI_API_KEY` | `gds_live_Xd4MjLWy7-truOmzQm5KcnFVnpSTTn5A` | AI Proxy API Key |
| `AI_DEFAULT_MODEL` | `luna` | Default AI model (`luna`, `gemini-3.8-flash`, etc.) |

> **Tip for `NEXTAUTH_SECRET`**: You can generate one via terminal with:
> ```bash
> openssl rand -base64 32
> ```

5. Click **Deploy**. Vercel will build and launch your application in under 1 minute!

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
   - Open your Notion Database: [https://app.notion.com/p/cloudji/30d77105180580919dfdef58eaed5a54](https://app.notion.com/p/cloudji/30d77105180580919dfdef58eaed5a54).
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

Once deployed, run this quick 2-minute smoke test:

1. **Sign-In Verification**:
   - Open your live site (`https://jobhunt.jizellecasia.site`).
   - Notice the prominent, cute favicon emblem centered on the left side of the login page.
   - Click **Continue with Google** &rarr; authenticate with your authorized Google account.
   - Confirm you have the **👑 ADMIN** badge in the header.
2. **RBAC Isolation Verification**:
   - Open **Manage Accounts & RBAC**.
   - Confirm any other account (e.g. `Cloudji Test`, `cloudjimail@gmail.com`, `Denise`) is strictly assigned as **👤 MEMBER** with `Cloud DB` badge.
   - Switch active persona or test logging in as a member: confirm Notion buttons and user management are completely hidden, and member records remain completely isolated.
3. **Notion 2-Way Sync**:
   - As Ji (Admin), click **Notion Live** / sync button: confirm your Notion job database pulls in all records without error across all 15 stages.
4. **AI Resume & ATS Matcher**:
   - Navigate to the **AI Resume & ATS** tab.
   - Upload a test resume in PDF format (`.pdf`).
   - Select an existing job or paste a job description.
   - Select **ChatGPT 5.6 Luna** or **Antigravity 3.8 Flash** and click **Run Match Analysis**.
   - Verify real-time streaming output, match score %, missing keywords, and XYZ optimized bullets.
5. **Dedicated Leads Hub**:
   - Open the **🎯 Leads** tab.
   - Review incoming leads from portfolio or add a new lead.
   - Click **Promote to Applied**: verify the lead converts seamlessly into an active tracked application.

---

## 🛠️ Ongoing Maintenance & Updates

Any time you make improvements locally:
```bash
git add .
git commit -m "feat: your new feature"
git push origin main
```
Vercel will automatically build and deploy your update with **zero downtime**!
