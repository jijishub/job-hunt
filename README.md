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

Save the roles that interest you, keep your notes close, and explore how your applications move through the hiring process. From your first internship to your next career move, your records grow into a picture you can actually learn from.

*Blush pink, soft white, and practical details throughout. A workspace you can make your own.*

### Why I built it

I started by tracking my internship applications. As I moved into regular employment, I wanted to keep that history while giving my current search its own focus.

The details are the part I get excited about: which roles reach interviews, how fit ratings compare with outcomes, and how salary offers line up with expectations. Job Hunt gives those questions a place to live.

## ✧ Inside the workspace

| Feature | What it brings to your search |
| --- | --- |
| **Your application pipeline** | Switch between a table and board; keep job descriptions, personal notes, dates, and hiring stages together. |
| **A home for promising leads** | Browse Saved leads or Discover, and open Quick Add from the same toolbar to save a real posting in a modal. See each lead's profile-fit rating and click it to open that lead's details and saved assessment. |
| **AI when you need it** | Use your master resume for ATS matching and role-fit assessments, with explanations you can review. |
| **Analytics you can explore** | Follow submissions, interviews, offers, and rejections. Click charts to review their records and export an aggregate PDF report. |
| **Salary expectations, made visible** | Compare actual offers with what you asked for, including median amounts and offer gaps within the same currency and pay period. |
| **A view that grows with you** | Keep internships and regular employment together or separate. Save your default view, targets, and analytics mappings. |
| **Companies worth remembering** | Reuse company profiles and logos across applications and leads. |
| **Connected, personal records** | Sign in with Google to access your own data; administrator tools add two-way Notion sync and account management. |

### From a lead to an insight

1. **Find a role.** Explore search keywords or save a posting you already have.
2. **Keep the context.** Add the description, your notes, and your salary expectation.
3. **Track what happens.** Update hiring stages and record an actual offer when it arrives.
4. **Explore your progress.** Review the patterns in Analytics and decide what to try next.

New applications start at **Not started** with today's date; both are editable. Role-fit analysis runs when you request it. AI discovery provides search ideas to research, and leads stay separate until you mark them applied. Salary comparisons pair the same application with matching currency and pay period.

Saved leads show **Strong fit**, **Possible fit**, **Weak fit**, or **Unassessed**, using their saved role-fit data. Open a lead through its title or fit badge to review its details; AI Match opens the resume matcher for that role. Discover generates search keywords for LinkedIn, JobStreet, Indeed, and Google Jobs.

**Copy Prompt**, beside **New App**, copies the Gemini job-to-JSON extraction prompt. Paste it with a job posting in Gemini, then import the returned JSON in the application form.

Changing a role to **Weak fit** automatically sets priority to **Low**; changing it to **Strong fit** sets priority to **High**. You can then edit either field independently; changing priority or saving other details keeps your chosen fit and priority. Possible fit leaves priority unchanged.

The workspace adapts to mobile screens: lead cards fit the viewport, account menus stay on screen, long job titles leave room for modal actions, and AI model choices wrap inside their card. Account creation places the action below the icon picker on mobile.

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
| AI features | `AI_BASE_URL`, `AI_API_KEY`, `AI_DEFAULT_MODEL` |
| Administrator Notion sync | `NOTION_API_KEY`, `NOTION_DATABASE_ID` |
| Optional Notion webhook | `NOTION_WEBHOOK_SECRET` |

Local development uses a JSON fallback when PostgreSQL is not configured. Keep credentials in your environment files, outside source control. See the [deployment guide](DEPLOYMENT.md) for hosting and Google OAuth setup.

Start the development server with `npm run dev`, then open [localhost:3000](http://localhost:3000). Google sign-in requires the OAuth configuration above.

## Useful commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start local development. |
| `npm run build` | Create the production build. |
| `npm run start` | Serve the production build. |
| `npm run test:pipeline` | Check analytics, application APIs, and persistence. |
| `npm run test:pipeline:ui` | Check browser flows against a running local server. |
| `node --test scripts/test_mobile_ui.cjs` | Check mobile and desktop layouts, Quick Add modal behavior, and clickable lead-fit badges. |
| `npx tsc --noEmit` | Check TypeScript. |
| `npm run company-icons:preview` | List companies missing icons without changing records. |
| `npm run company-icons` | Research and fill missing company icons. |

Browser checks use Chrome and `http://localhost:3100` by default. Start the app with `npx next dev -p 3100`, or set `PIPELINE_TEST_URL` to your local server.

### Company icons

The icon job requires a signed-in Codex CLI and `POSTGRES_URL` in `.env.local`. It researches official logos, fills empty icons, preserves existing ones, and skips uncertain matches. Backups and source references go to `.data/company-icons/`. It uses your signed-in Codex account separately from the app's AI API.

## Project references

`LLM.txt` holds project feedback and requests. The `references/` folder keeps application JSON, resumes, and research material; these remain separate from the app's source code.

For future application questions, the local `references/application-answer-reference.md` explains how to reuse the submitted answers in `references/thinkingmachines_submitted_application.json` and adapt them to the role. The retired Thinking Machines RPA has been removed following the completed application on its replacement site.

---

<p align="center">🤍 A personal project, built for a very real job search.</p>
<p align="center">Created by <a href="https://jizellecasia.site">Jizelle Casia</a> · <a href="https://jobhunt.jizellecasia.site">Visit Job Hunt</a></p>
