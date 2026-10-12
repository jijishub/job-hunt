# RPA quick reference

Run these commands from the `job-hunt` folder.

| Command | What it does |
| --- | --- |
| `npm run rpa:bossjob` | Prepare the business resume, copy the Bossjob helper, and open your main browser. Paste once in Console to run the supported profile updates. |
| `npm run rpa:jobstreet` | Prepare the technical resume, copy the automatic JobStreet updater, and open your main browser. |
| `npm run rpa:bytedance` | Open a separate Chrome profile, upload the ByteDance resume, and autofill the application. Review and submit manually. |
| `npm run rpa:appficiency` | Prepare the application and resume, copy its helper, and open your main browser. Review filled details before submitting. |

Every main command prepares its files automatically; there is no separate preparation step.

To finish only **Cloudji and the personal summary**, run `npm run rpa:bossjob -- --remaining`, then paste its helper once in Bossjob Console. This mode uses the business resume, disables PDF upload, and edits existing records only. To prepare it without opening the browser, add `--prepare`. The authored summary is stored in `scripts/bossjob_profile.cjs` and included in the generated profile data.

For the JobStreet business resume, use `npm run rpa:jobstreet -- --variant business`. Bossjob uses the business resume by default; select technical with `npm run rpa:bossjob -- --variant technical`.

For troubleshooting only, generate files without opening the browser with `npm run rpa:bossjob -- --prepare`, `npm run rpa:appficiency -- --prepare`, or `node scripts/jobstreet_sync.cjs`. Watch JobStreet resume changes with `node scripts/jobstreet_sync.cjs --watch` (add `--variant business` if needed). Inspect its form with `node scripts/jobstreet_inspect.cjs`.

Validation: `npm run test:bossjob` and `npm run test:jobstreet`.

**JobStreet:** After running the command, open your signed-in profile, press **F12 → Console**, paste, and press **Enter**. The updater opens, fills, and saves all tasks in order, including your professional summary. Wait for **Sequence completed**. If Chrome blocks paste, type `allow pasting` manually and press Enter first.

**Resume files:** Technical: `references/Active Resume/Resume Active/JizelleCasia_Resume.pdf`. Business: `references/Active Resume/BusinessSolutions/JizelleCasia_Resume.pdf`.

**Bossjob:** Run `npm run rpa:bossjob`, sign in to Manage Profile, and close any open editor. Press **F12 > Console**, paste **once**, and press **Enter**. The helper embeds the exact BusinessSolutions PDF and automatically supplies it, waits for the filename acknowledgement and parsing activity to settle, then runs the personal summary, work experience, education, personal details, skills, and certifications in order. Projects and leadership remain in the uploaded PDF. There is no need to paste separate commands for each entry.

The updater opens, fills, confirms, and checks each saved entry. It supports the captured Bossjob title selector, Ant Design month calendars, Quill descriptions, Edit icons, and Confirm controls. Cloudji's legacy **Founder** title is recognized within its company record. A blank work editor is closed and reopened once; the existing record ID must be verified before Save. It preserves separate roles at the same company, avoids ambiguous duplicates, and refuses to truncate descriptions. **Stop** interrupts the sequence; **Retry remaining** resumes from the current task without uploading or submitting the same pending save again. Unconfirmed saves remain guarded across helper replacement in the same tab.

Unavailable sections are explicitly reported and are not counted as completed. Unknown controls, rejected fields, unacknowledged uploads, or unconfirmed saves pause the sequence. The automated tests use local browser fixtures; a successful local test does not verify your live account. If a changed control needs inspection, the panel retains **Copy editor controls (JSON)** and **Fill open editor**. To choose the technical PDF explicitly, run `node scripts/bossjob_sync.cjs --variant technical`.
