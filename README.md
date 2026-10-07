# 🌸 Job Hunt & Leads Hub

> A high-performance Job Application Tracker, Inbound Lead Pipeline, AI Resume & ATS Matcher, and Bi-directional Notion 2-Way Sync engine built with **Next.js 16**, **React 19**, **Tailwind CSS v4**, and **Neon Serverless PostgreSQL**.

Live Production: **[https://jobhunt.jizellecasia.site](https://jobhunt.jizellecasia.site)**  
Designed with an executive **Pink aesthetic** (`#FAF7F9`, `#FF7AB3`, `#F1DDE9`, `#9D3C5E`) providing a delightful, focused, and high-precision career command center.

---

## ✨ Core Features

### 🤖 AI Resume & ATS Matcher (Luna 5.6 & Antigravity)
- **Multi-Model AI Gateway**: Built on high-performance proxy (`https://api.jizellecasia.site/v1`).
  - **ChatGPT 5.6 Luna (`luna`)**: Default flagship model for in-depth ATS match scoring, keyword gap extraction, and Google XYZ-style bullet rewriting.
  - **Antigravity 3.8 Flash (`gemini-3.8-flash`)**: Ultra-fast latency for instant resume scanning.
  - **Antigravity 3.1 Pro High (`gemini-3.1-pro-high`)**: Complex multi-step reasoning for executive-level resume critiques.
- **Real-Time Streaming**: Streamed SSE analysis with resilient markdown/JSON extraction and automatic retry fallbacks.
- **Strict PDF Acceptance & Multi-User Support**: Dedicated PDF resume upload (`.pdf` only) with automated text parsing and keyword extraction. Member accounts upload their individual PDF resumes directly, while Admin can toggle between PDF uploads and live portfolio synchronization.
- **Client-Side Report Export (PDF & PNG)**: Download complete ATS match reports directly as a full unclipped single PDF or high-resolution 2x Retina PNG without writing to the database.
- **Dynamic Job Matching**: Match any uploaded resume directly against existing saved job applications or ad-hoc job descriptions.

### 🎯 Dedicated Leads Hub & Pipeline Promotion
- **Separate Leads Tab**: Dedicated hub for capturing recruiter outreach, inbound portfolio inquiries (`jizellecasia.vercel.app`), and freelance opportunities.
- **No Company Clutter**: Keeps unverified inbound leads isolated from verified company directories.
- **1-Click "Promote to Applied"**: Convert any inbound lead into an active tracked job application with complete history preservation.

### 📋 Dual-View Tracker & 15 Notion Statuses
- **Interactive Kanban Board & Table**: Sort, search, and group applications by stage, priority, work model (Remote/Hybrid/Onsite), and salary ranges.
- **15 Pre-Seeded Notion Stages**:
  - `Lead`, `Wishlist`, `Applied`, `Recruiter Screen`, `Technical Interview`, `Hiring Manager`, `System Design`, `Behavioral`, `Take Home Assignment`, `Final Round`, `Offer Received`, `Accepted`, `Rejected`, `Withdrawn`, `Ghosted`.
- **Dynamic Inline `+ Add Option`**: Create custom stages on the fly directly synced with Notion properties.

### 🔄 Bi-Directional Notion 2-Way Live Sync
- Real-time synchronization with Notion databases via `@notionhq/client`.
- Instant push & pull of job listings, application stages, notes, and timeline dates.
- Admin webhook endpoint (`/api/notion/webhook`) for immediate external automation triggers.

### 🛡️ Strict Single-Admin RBAC & Data Isolation
- **👑 Master Administrator (`jizellecasia@gmail.com` / `ADMIN_EMAIL`)**: Full exclusive access to Notion 2-Way Live Sync, Inbound Portfolio Leads, User Account Management, and OAuth platform configuration.
- **👤 Member Isolation**: Any other authenticated user (e.g., `Cloudji Test`, `cloudjimail@gmail.com`, `Denise`) is automatically restricted to a private Cloud DB workspace without access to the Admin's Notion database, sync triggers, or admin settings.

### 🔐 Branded Google OAuth SSO & Cute Favicon Highlight
- **Cute Favicon Showcase**: Large prominent favicon artwork featured on the center-left of the login page with soft ambient glowing halos.
- **Whitelist-Protected SSO**: NextAuth.js Google Single Sign-On validating incoming emails against the authorized user directory.

---

## 🛠️ Tech Stack

- **Framework**: [Next.js 16 (App Router + Turbopack)](https://nextjs.org)
- **Frontend**: [React 19](https://react.dev), [Lucide React](https://lucide.dev)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com)
- **AI Gateway**: OpenAI-compatible Proxy (`https://api.jizellecasia.site/v1`) with Luna 5.6 & Antigravity
- **Authentication**: [NextAuth.js v4](https://next-auth.js.org) with Google OAuth 2.0
- **Database**: [Neon Serverless PostgreSQL](https://neon.tech) / Local JSON fallback
- **Integration**: [Notion API SDK](https://developers.notion.com) (`@notionhq/client`)

---

## 🚀 Quick Start

### 1. Clone & Install Dependencies

```bash
git clone https://github.com/jijishub/job-hunt.git
cd job-hunt
npm install
```

### 2. Configure Environment Variables

Create `.env.local` (or copy `.env.example`):

```env
# 1. Administrator Email (Grants 👑 Admin role, Notion sync & Leads access)
ADMIN_EMAIL=jizellecasia@gmail.com

# 2. Notion 2-Way Live Sync
NOTION_API_KEY=ntn_your_notion_api_key_here
NOTION_DATABASE_ID=your_32_character_notion_database_id

# 3. NextAuth Authentication
NEXTAUTH_SECRET=your_32_character_secret_here
NEXTAUTH_URL=http://localhost:3000

# 4. Google OAuth SSO
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-your_google_client_secret

# 5. AI Resume & ATS Analyzer
AI_BASE_URL=https://api.jizellecasia.site/v1
AI_API_KEY=gds_live_your_proxy_api_key_here
AI_DEFAULT_MODEL=luna

# 6. Database (Optional for local dev; required for Neon/Postgres production)
POSTGRES_URL=postgres://user:password@ep-xyz.region.aws.neon.tech/neondb?sslmode=require
```

### 3. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## ☁️ Deployment Reference

For detailed deployment instructions covering Vercel, Cloudflare DNS (`jobhunt.jizellecasia.site`), Google Cloud Console OAuth whitelist URIs, and live verification, refer to:

👉 **[DEPLOYMENT.md](DEPLOYMENT.md)**

---

## 📄 License

MIT © [Jizelle Casia](https://github.com/jijishub)
