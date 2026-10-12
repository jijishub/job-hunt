# RPA quick reference

Run these commands from the `job-hunt` folder.

| Command | What it does |
| --- | --- |
| `npm run rpa:bossjob` | Copy the business-resume Bossjob updater and open your main browser session. Paste in F12 Console to correct existing work/education entries, add missing ones, and verify their saves. |
| `npm run rpa:bossjob:prepare` | Generate business-resume Bossjob data and helper locally without opening the browser. |
| `npm run test:bossjob` | Check Bossjob resume selection, editor filling, and PDF upload. |
| `npm run jobstreet` | Refresh technical resume data and copy the automatic JobStreet profile updater. Uses your main browser session. |
| `npm run jobstreet:business` | Same updater, using the BusinessSolutions resume. |
| `npm run bytedance` | Open a separate Chrome profile, upload the ByteDance resume, and autofill the application. Review and submit manually. |
| `npm run rpa:appficiency` | Copy the Appficiency application helper and open the application in your main browser. Review filled details before submitting. |
| `npm run rpa:appficiency:prepare` | Generate Appficiency application data and helper locally. |
| `npm run jobstreet:prepare` | Refresh technical resume JSON only; no browser updates. |
| `npm run jobstreet:watch` | Watch the technical PDF and refresh JSON when it changes. Stop with Ctrl+C. |
| `node scripts/jobstreet_sync.cjs --variant business --watch` | Watch the business resume instead. |
| `npm run test:jobstreet` | Run the local JobStreet automation tests. |
| `node scripts/jobstreet_inspect.cjs` | Troubleshooting: copy a read-only form inspector that downloads a report without saving edits. |

**JobStreet:** After running the command, open your signed-in profile, press **F12 → Console**, paste, and press **Enter**. The updater opens, fills, and saves all tasks in order, including your professional summary. Wait for **Sequence completed**. If Chrome blocks paste, type `allow pasting` manually and press Enter first.

**Resume files:** Technical: `references/Active Resume/Resume Active/JizelleCasia_Resume.pdf`. Business: `references/Active Resume/BusinessSolutions/JizelleCasia_Resume.pdf`.

**Bossjob:** Its PDF parser can import incomplete details. Wait for parsing to finish, close any open editor, then paste the helper in **F12 → Console**. Work/education sync starts automatically. It matches roles by title and company, updates full descriptions and dates, and uses **+** for missing entries. Different roles at the same company stay separate. Existing duplicates or uncertain matches pause the sequence; nothing is deleted. Each save is checked against the displayed description and dates before moving on.

If a site icon has no usable label, click **Choose this entry’s Edit / +**, then click the real icon for that entry. If a form control cannot be mapped, use the blue **Copy editor controls (JSON)** button with the editor open and paste its JSON into chat. The helper keeps the current entry open and never saves an incomplete mapping or truncates a description to fit a field limit. **Retry remaining** resumes from the paused entry. **Stop** interrupts the sequence; review any unsaved changes in the open editor.

**Fill open editor** and **Copy resume text** remain available for other profile fields, skills, and certifications. **Upload active resume** is separate from the work/education sync. To use the technical resume explicitly, run `node scripts/bossjob_sync.cjs --variant technical`.

Older aliases: `npm run rpa` and `npm run rpa:bytedance` both run ByteDance. `npm run rpa:jobstreet:browser` runs the JobStreet updater; `npm run rpa:jobstreet` prepares JSON only.
