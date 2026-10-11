const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { extractText } = require('unpdf');

const ROOT = path.resolve(__dirname, '..');
const SOURCES = {
  technical: 'references/Active Resume/Resume Active/JizelleCasia_Resume.pdf',
  business: 'references/Active Resume/BusinessSolutions/JizelleCasia_Resume.pdf',
};
const MONTHS = 'January February March April May June July August September October November December'.split(' ');
const datePattern = `(${MONTHS.join('|')}) (\\d{4})(?: [–-] (?:(${MONTHS.join('|')}) (\\d{4})|(Present)))?`;
function monthDate(month, year) {
  return `${year}-${String(MONTHS.indexOf(month) + 1).padStart(2, '0')}`;
}
function parseResume(text) {
  const lines = text.split('\n').map(s => s.trim()).filter(Boolean);
  const headings = ['Experience', 'Skills & Certifications', 'Education', 'Key Projects', 'Leadership and Activities', 'References'];
  const sections = {};
  for (let i = 0; i < headings.length; i++) {
    const start = lines.indexOf(headings[i]);
    if (start < 0) throw new Error(`Resume layout changed: missing ${headings[i]}. Review the parser before syncing.`);
    const end = i + 1 < headings.length ? lines.indexOf(headings[i + 1]) : lines.length;
    if (end <= start) throw new Error('Resume sections are out of order.');
    sections[headings[i]] = lines.slice(start + 1, end);
  }
  const contact = lines[1].split('|').map(s => s.trim());
  if (!contact[0]?.includes('@') || contact.length < 4) throw new Error('Resume contact layout changed.');
  const experience = [];
  let company = '';
  for (const line of sections.Experience) {
    const role = line.match(new RegExp(`^(.*?) ${datePattern}$`));
    if (role) {
      if (!company) throw new Error('Role has no company.');
      experience.push({ company, title: role[1], start_date: monthDate(role[2], role[3]), end_date: role[6] ? null : monthDate(role[4] || role[2], role[5] || role[3]), current: Boolean(role[6]), description: '' });
    } else if (/^[A-Z][A-Z\s.,&()'-]+(?:\s+(?:Makati City|Taguig City|Remote))?$/.test(line)) {
      company = line.replace(/\s+(Makati City|Taguig City|Remote)$/, '');
    } else {
      if (!experience.length) throw new Error(`Unrecognized experience header: ${line}`);
      const entry = experience.at(-1);
      entry.description += `${entry.description ? (line.startsWith('●') ? '\n' : ' ') : ''}${line}`;
    }
  }
  if (!experience.length || experience.some(e => !e.description)) throw new Error('Incomplete experience extraction.');
  const skills = sections['Skills & Certifications'].filter(s => !s.startsWith('Certifications:')).flatMap(s => s.slice(s.indexOf(':') + 1).split(',').map(s => s.trim()));
  const edu = sections.Education;
  const school = edu[0].match(/^(.*?) (\d{4}) [–-] (\d{4})$/);
  if (!school) throw new Error('Education layout changed.');
  return {
    personal: { name: lines[0], first_name: lines[0].split(/\s+/).slice(0, -1).join(' '), last_name: lines[0].split(/\s+/).at(-1), email: contact[0], phone: contact[1], website: contact[2], location: contact.slice(3).join(' | ') },
    experience,
    education: [{ institution: school[1], qualification: edu[1].split('|')[0].trim(), start_year: school[2], end_year: school[3], description: edu.slice(1).join('\n') }],
    skills,
    certifications: sections['Skills & Certifications'].filter(s => s.startsWith('Certifications:')).map(s => s.slice(15).trim()),
    projects_text: sections['Key Projects'].join('\n'),
    leadership_text: sections['Leadership and Activities'].join('\n'),
  };
}
async function prepare(variant = 'technical', outputDir = path.join(ROOT, '.data/jobstreet')) {
  if (!SOURCES[variant]) throw new Error('Variant must be technical or business.');
  const bytes = fs.readFileSync(path.join(ROOT, SOURCES[variant]));
  const hash = crypto.createHash('sha256').update(bytes).digest('hex');
  const file = path.join(outputDir, `${variant}.json`);
  if (fs.existsSync(file)) {
    const prior = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (prior.schema_version === 2 && prior.source.sha256 === hash && prior.source.path === SOURCES[variant]) return { file, changed: false, data: prior };
  }
  const { text } = await extractText(new Uint8Array(bytes), { mergePages: true });
  const data = { schema_version: 2, variant, source: { path: SOURCES[variant], sha256: hash }, extracted_at: new Date().toISOString(), profile: parseResume(text) };
  fs.mkdirSync(outputDir, { recursive: true });
  if (fs.existsSync(file)) fs.copyFileSync(file, `${file}.previous`);
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
  return { file, changed: true, data };
}
module.exports = { ROOT, SOURCES, parseResume, prepare };
