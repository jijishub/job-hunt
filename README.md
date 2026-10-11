# Job Hunt & Leads Hub

A private job application tracker with a separate leads pipeline, resume analysis, role-fit assessment, and application analytics.

[Live application](https://jobhunt.jizellecasia.site)

## Features

- Table and board views with job descriptions, personal notes, salary, and application history.
- Member defaults: Applied, Interview, Accepted, and Not Proceeding, with custom options. Admin accounts retain detailed Notion stages.
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

## Verification and deployment

```sh
npm run test:pipeline
npm run test:pipeline:ui
npx tsc --noEmit
npm run build
```

See [DEPLOYMENT.md](DEPLOYMENT.md) for hosting and OAuth configuration.
