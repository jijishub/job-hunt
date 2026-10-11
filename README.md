# Job Hunt & Leads Hub

A private job application tracker with a separate leads pipeline, resume analysis, role-fit assessment, and application analytics.

[Live application](https://jobhunt.jizellecasia.site)

## Features

- Table and board views with job descriptions, personal notes, salary, and application history.
- Member statuses: Not started, Applied, Interview, Accepted, and Not Proceeding, with custom options. New entries default to Not started; admin accounts retain detailed Notion stages.
- Preferences for target roles, work models, job types, currency, resume text, and analytics phase mappings.
- Resume PDF analysis, portfolio evidence for the admin, and AI assessments against saved job descriptions.
- Analytics for all applications, regular employment, or internships, with PDF reports.
- Leads stay separate until promoted. See [lead feed behavior](references/leads-feed-explained.txt).
- Google sign-in and account ownership checks. Notion integration and user management are admin features.

## Local setup

Requires Node.js and npm. Built with Next.js 16, React 19, Tailwind CSS 4, NextAuth, and Neon PostgreSQL.

```sh
npm install
npm run dev
```

Configure `.env.local` with `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `POSTGRES_URL`. Set `ADMIN_EMAIL` to the administrator email; this project uses `jizelle.casia@gmail.com`.

AI features use `AI_BASE_URL`, `AI_API_KEY`, and `AI_DEFAULT_MODEL`. Admin Notion sync uses `NOTION_API_KEY` and `NOTION_DATABASE_ID`. Keep credentials out of source control. Without PostgreSQL, local development uses the JSON fallback.

## Fill missing company icons

From PowerShell in this project:

```powershell
npm run company-icons
```

Requires the Codex CLI signed in (`codex login`) and the live `POSTGRES_URL` in `.env.local`. The command starts a new Codex research session with live web search, then downloads verified official logos and fills empty company icon fields. Existing icons are preserved, including icons added during the run. Uncertain matches are skipped. This uses your signed-in Codex account, separately from the app's AI API.

Backups, sources and results are saved under `.data/company-icons/`. Preview missing companies without starting Codex or changing the database with `npm run company-icons:preview`.

The job uses [Codex non-interactive mode](https://learn.chatgpt.com/docs/non-interactive-mode).

## Verification and deployment

```sh
npm run test:pipeline
npm run test:pipeline:ui
npx tsc --noEmit
npm run build
```

See [DEPLOYMENT.md](DEPLOYMENT.md) for hosting and OAuth configuration.
