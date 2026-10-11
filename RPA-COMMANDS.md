# RPA quick reference

Run these commands from the `job-hunt` folder.

| Command | What it does |
| --- | --- |
| `npm run rpa:bossjob` | Use the business resume and copy a Bossjob helper; opens your main browser session. Paste in F12 Console, open a work/education editor, choose its matching resume section, then fill, review, and save. |
| `npm run rpa:bossjob:prepare` | Generate business-resume Bossjob data and helper locally without opening the browser. |
| `npm run test:bossjob` | Check Bossjob resume selection, editor filling, and PDF upload. |
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

**Bossjob:** Uploading a PDF does not populate your profile fields. Open one work or education editor at a time, select the corresponding resume entry in the helper, and click **Fill open editor**. Review dates, current-work choices, and selections before saving. **Copy selected section** provides the resume text for controls that require manual input. With an editor open, **Copy field inspection** copies its control labels and options for mapping custom editors; paste that JSON into chat. **Download field inspection** saves the same report to a file. To explicitly use the technical resume instead, run `node scripts/bossjob_sync.cjs --variant technical`.

Older aliases: `npm run rpa` and `npm run rpa:bytedance` both run ByteDance. `npm run rpa:jobstreet:browser` runs the JobStreet updater; `npm run rpa:jobstreet` prepares JSON only.
