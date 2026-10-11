<p align="center">
  <img src="public/job-hunt%20official%20text.png" alt="Job Hunt" width="360" />
</p>

<p align="center"><strong>🌸 A clearer view of your next career move.</strong></p>
<p align="center">Applications, leads, resumes, and analytics in one private workspace.</p>
<p align="center">
  <a href="https://jobhunt.jizellecasia.site">Open Job Hunt</a> ·
  <a href="#getting-started">Local setup</a> ·
  <a href="DEPLOYMENT.md">Deployment guide</a>
</p>

---

## The workspace

| Area | What you can do |
| --- | --- |
| Applications | Track roles in a table or board, with editable dates, statuses, descriptions, and personal notes. |
| Companies | Reuse company profiles and logos across applications and leads. |
| Leads | Save real postings, generate search keywords, and choose LinkedIn, JobStreet, Indeed, or Google Jobs. |
| Resume & AI | Keep a master resume and request ATS matching or role-fit assessments when needed. |
| Analytics | Explore progress, fit conversion, offers, rejections, and monthly activity; export aggregate PDF reports. |
| Salary insights | Record expected salary and actual base-pay offers; compare matching currencies and pay periods. |
| Preferences | Set targets, your default job-type view, and analytics status mappings for your account. |

Google sign-in keeps each account's records separate. Members use the cloud database; the administrator also has two-way Notion sync and account management.

New applications default to **Not started** and today's date, both editable. Role-fit analysis runs only when requested. Leads remain separate until promoted, and AI discovery generates search ideas to research rather than confirmed vacancies.

## Built with

**Next.js 16** · **React 19** · **TypeScript** · **Tailwind CSS 4**

Neon PostgreSQL for storage, NextAuth for authentication, Notion for administrator sync, and a configurable AI endpoint for analysis.

## Getting started

Install Node.js and npm, then run:

```powershell
npm install
npm run dev
```

Add your configuration to `.env.local`:

| Purpose | Variables |
| --- | --- |
| Authentication | `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` |
| Database | `POSTGRES_URL` |
| Administrator | `ADMIN_EMAIL` |
| AI features | `AI_BASE_URL`, `AI_API_KEY`, `AI_DEFAULT_MODEL` |
| Administrator Notion sync | `NOTION_API_KEY`, `NOTION_DATABASE_ID` |
| Optional Notion webhook | `NOTION_WEBHOOK_SECRET` |

Local development uses a JSON fallback when PostgreSQL is not configured. Keep credentials in your environment files, outside source control. See the [deployment guide](DEPLOYMENT.md) for hosting and Google OAuth setup.

## Useful commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start local development. |
| `npm run build` | Create the production build. |
| `npm run start` | Serve the production build. |
| `npm run test:pipeline` | Check analytics, application APIs, and persistence. |
| `npm run test:pipeline:ui` | Check browser flows against a running local server. |
| `npx tsc --noEmit` | Check TypeScript. |
| `npm run company-icons:preview` | List companies missing icons without changing records. |
| `npm run company-icons` | Research and fill missing company icons. |

Browser checks use Chrome and `http://localhost:3100` by default. Start the app with `npx next dev -p 3100`, or set `PIPELINE_TEST_URL` to your local server.

### Company icons

The icon job requires a signed-in Codex CLI and `POSTGRES_URL` in `.env.local`. It researches official logos, fills empty icons, preserves existing ones, and skips uncertain matches. Backups and source references go to `.data/company-icons/`. It uses your signed-in Codex account separately from the app's AI API.

## Project references

`LLM.txt` holds project feedback and requests. The `references/` folder keeps application JSON, resumes, and research material; these remain separate from the app's source code.

---

<p align="center">🤍 Created by <a href="https://jizellecasia.site">Jizelle Casia</a> · <a href="https://coolsymbol.com">♡</a></p>
