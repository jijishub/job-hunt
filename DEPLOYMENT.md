# 🚀 Complete Deployment Guide: Job Hunt & Leads Hub

This guide walks you through deploying the **Job Hunt & Leads** application to **Vercel** with your custom domain **`jizellecasia.site`** (or **`jobs.jizellecasia.site`**), connecting **Neon PostgreSQL**, configuring **Google OAuth SSO**, and enabling **Notion 2-Way Live Sync**.

---

## 📋 Table of Contents
1. [Architecture & Prerequisites](#1-architecture--prerequisites)
2. [Step 1: Push Latest Code to GitHub](#step-1-push-latest-code-to-github)
3. [Step 2: Database Setup (Free Serverless Postgres)](#step-2-database-setup-free-serverless-postgres)
4. [Step 3: Deploy to Vercel](#step-3-deploy-to-vercel)
5. [Step 4: Connect Custom Domain (`jizellecasia.site`)](#step-4-connect-custom-domain-jizellecasiasite)
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
| `NEXTAUTH_URL` | `https://jobs.jizellecasia.site` (or `https://jizellecasia.site`) | Full URL of your live production app |
| `NEXTAUTH_SECRET` | `generate-a-random-32-char-string` | Secret key for JWT signing |
| `ADMIN_EMAIL` | `jizellecasia@gmail.com` | Email automatically granted the 👑 Administrator role |
| `NOTION_API_KEY` | `YOUR_NOTION_API_KEY` | Your Notion Integration API Secret |
| `NOTION_DATABASE_ID` | `YOUR_NOTION_DATABASE_ID` | 32-character Notion Database ID |
| `GOOGLE_CLIENT_ID` | `xxxx.apps.googleusercontent.com` | Google Cloud OAuth Client ID (optional now; can also set via UI) |
| `GOOGLE_CLIENT_SECRET` | `GOCSPX-xxxx` | Google Cloud OAuth Client Secret |

> **Tip for `NEXTAUTH_SECRET`**: You can generate one via terminal with:
> ```bash
> openssl rand -base64 32
> ```

5. Click **Deploy**. Vercel will build and launch your application in under 1 minute!

---

## Step 4: Connect Custom Domain (`jizellecasia.site`)

### Recommendation: Use `jobs.jizellecasia.site`
> [!TIP]
> Setting up **`jobs.jizellecasia.site`** leaves your root `jizellecasia.site` free for your personal portfolio, resume, or blog in the future. If you prefer the root domain, use `jizellecasia.site` directly.

### On Vercel:
1. In your project on Vercel, go to **Settings** &rarr; **Domains**.
2. Enter your chosen domain:
   - For subdomain: enter `jobs.jizellecasia.site` &rarr; click **Add**.
   - For root domain: enter `jizellecasia.site` &rarr; click **Add** (Vercel will also suggest redirecting `www.jizellecasia.site`).

### In Your DNS Registrar (Namecheap, GoDaddy, Cloudflare, etc.):
Add the corresponding DNS record:

#### For Subdomain (`jobs.jizellecasia.site`):
| Type | Name / Host | Target / Value | TTL |
|---|---|---|---|
| **CNAME** | `jobs` | `cname.vercel-dns.com` | Automatic / 300 |

#### For Apex Root (`jizellecasia.site`):
| Type | Name / Host | Target / Value | TTL |
|---|---|---|---|
| **A** | `@` | `76.76.21.21` | Automatic / 300 |
| **CNAME** | `www` | `cname.vercel-dns.com` | Automatic / 300 |

Vercel will automatically verify the records and issue an **SSL Certificate** within 1–2 minutes!

---

## Step 5: Configure Google Cloud OAuth SSO

1. Go to [Google Cloud Console Credentials](https://console.cloud.google.com/apis/credentials).
2. Select your project (or create one named `Job Hunt`).
3. Click **+ Create Credentials** &rarr; **OAuth client ID**.
4. **Application type**: Select `Web application`.
5. **Name**: `Job Hunt Web Client`.
6. **Authorized JavaScript origins**:
   - Add: `https://jobs.jizellecasia.site` (or `https://jizellecasia.site`)
   - Add: `http://localhost:3000` (for local development)
7. **Authorized redirect URIs**:
   - Add: `https://jobs.jizellecasia.site/api/auth/callback/google` (or `https://jizellecasia.site/api/auth/callback/google`)
   - Add: `http://localhost:3000/api/auth/callback/google` (for local development)
8. Click **Create** and copy your **Client ID** and **Client Secret**.
9. In your live app:
   - Click your profile badge &rarr; **Google SSO Credentials** tab.
   - Paste the Client ID and Client Secret, then click **Save Google SSO Credentials**.
   - *Or* add them directly to your Vercel Environment Variables.

---

## Step 6: Notion 2-Way Live Sync Verification

1. Ensure your Notion Database has been shared with your integration:
   - Open your Notion Database: [https://app.notion.com/p/cloudji/YOUR_NOTION_DATABASE_ID](https://app.notion.com/p/cloudji/YOUR_NOTION_DATABASE_ID).
   - Click `··· (top right)` &rarr; **Connect to** &rarr; select **Job Tracker**.
2. **Optional Webhook for Instant Notion &rarr; Web Push**:
   - In your app, open **Notion Settings** (`⚙️` icon next to Notion Live badge).
   - Copy the Webhook endpoint:
     ```
     https://jobs.jizellecasia.site/api/notion/webhook
     ```
   - Connect this in your Notion automation or Zapier/Make webhook trigger.

---

## Step 7: Post-Deployment Smoke Test

Once deployed, run this quick 2-minute smoke test:

1. **Sign-In Verification**:
   - Open your live site (`https://jobs.jizellecasia.site`).
   - Click **Sign In with Google** &rarr; confirm that your Google name and picture populate your profile.
   - Confirm you have the **👑 ADMIN** badge.
2. **RBAC Isolation Verification**:
   - Open **Manage Accounts & RBAC**.
   - Confirm **Denise** is listed as **👤 MEMBER** with `Hospitality Management` focus and `Cloud DB` badge.
   - Click **Edit** next to Denise to verify you can update her name, industry, or avatar.
   - Switch active persona to Denise: confirm Notion buttons disappear and her view shows the Cloud DB badge.
3. **Notion Sync**:
   - Switch back to Ji (Admin).
   - Click **Sync Notion**: confirm existing Notion items pull into the tracker without affecting Denise's isolated records.
4. **Lead Explorer**:
   - Open **🎯 Find Leads** as Ji: verify live portfolio sync with `jizellecasia.vercel.app`.
   - Switch to Denise: verify tailored Hospitality launchpads and manual lead intake.

---

## 🛠️ Ongoing Maintenance & Updates

Any time you make improvements locally:
```bash
git add .
git commit -m "feat: your new feature"
git push origin main
```
Vercel will automatically build and deploy your update with **zero downtime**!
