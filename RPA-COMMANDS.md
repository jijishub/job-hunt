# RPA quick reference

Run these commands from the `job-hunt` folder.

| Command | What it does |
| --- | --- |
| `npm run rpa:bossjob` | Refresh the active technical resume and copy a Bossjob helper; opens your main browser session. Paste in F12 Console, upload the resume or fill an open editor, then review and save in Bossjob. |
| `npm run rpa:bossjob:prepare` | Generate Bossjob profile data and helper locally without opening the browser. |
| `npm run jobstreet` | Refresh technical resume data and copy the automatic JobStreet profile updater. Uses your main browser session. |
| `npm run jobstreet:business` | Same updater, using the BusinessSolutions resume. |
| `npm run bytedance` | Open a separate Chrome profile, upload the ByteDance resume, and autofill the application. Review and submit manually. |
| `npm run thinkingmachines` | Copy the Thinking Machines application helper and open the role in your main browser. Paste in F12 → Console; it uploads the active resume and fills personal details, education, work history, portfolio, and drafted answers. Review, accept privacy, and submit manually. |
| `npm run thinkingmachines:prepare` | Refresh Thinking Machines application JSON/helper only. Edit drafted answers in `references/thinkingmachines_rpa.json`. |
| `npm run jobstreet:prepare` | Refresh technical resume JSON only; no browser updates. |
| `npm run jobstreet:watch` | Watch the technical PDF and refresh JSON when it changes. Stop with Ctrl+C. |
| `node scripts/jobstreet_sync.cjs --variant business --watch` | Watch the business resume instead. |
| `npm run test:jobstreet` | Run the local JobStreet automation tests. |
| `npm run test:thinkingmachines` | Run the local Thinking Machines application tests. |
| `node scripts/jobstreet_inspect.cjs` | Troubleshooting: copy a read-only form inspector that downloads a report without saving edits. |

**JobStreet:** After running the command, open your signed-in profile, press **F12 → Console**, paste, and press **Enter**. The updater opens, fills, and saves all tasks in order, including your professional summary. Wait for **Sequence completed**. If Chrome blocks paste, type `allow pasting` manually and press Enter first.

**Resume files:** Technical: `references/Active Resume/Resume Active/JizelleCasia_Resume.pdf`. Business: `references/Active Resume/BusinessSolutions/JizelleCasia_Resume.pdf`.

Older aliases: `npm run rpa` and `npm run rpa:bytedance` both run ByteDance. `npm run rpa:jobstreet:browser` runs the JobStreet updater; `npm run rpa:jobstreet` prepares JSON only.
