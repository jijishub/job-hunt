const fs = require('node:fs');
const path = require('node:path');
const directory = path.join(__dirname, '../.data');
const domains = JSON.parse(fs.readFileSync(path.join(directory, 'logo-domains.json'), 'utf8'));
const latest = fs.readdirSync(directory).filter((file) => /^company-logos-backup-\d+\.json$/.test(file)).sort().pop();
const companies = JSON.parse(fs.readFileSync(path.join(directory, latest), 'utf8'));
function attr(tag, name) {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*(["'])(.*?)\\1`, 'is'));
  return match?.[2]?.replace(/&amp;/g, '&');
}
async function research([name, website]) {
  const company = companies.find((company) => company.name === name);
  if (!company || company.logo_url) return { name, status: 'already-has-logo' };
  try {
    const response = await fetch(website, { signal: AbortSignal.timeout(10000), headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!response.ok) return { name, website, status: `HTTP ${response.status}` };
    const html = await response.text();
    const options = [];
    for (const match of html.matchAll(/<img\b[^>]*>|<link\b[^>]*>/gi)) {
      const tag = match[0];
      const isLink = /^<link/i.test(tag);
      const src = isLink ? attr(tag, 'href') : attr(tag, 'src') || attr(tag, 'data-src');
      const text = `${src || ''} ${attr(tag, 'alt') || ''} ${attr(tag, 'class') || ''}`;
      if (!src || (isLink ? !/icon/i.test(attr(tag, 'rel') || '') : !/logo/i.test(text))) continue;
      let url;
      try { url = new URL(src, response.url).href; } catch { continue; }
      if (!url.startsWith('https://') || options.some((option) => option.url === url)) continue;
      options.push({ url, alt: attr(tag, 'alt'), type: isLink ? 'icon' : 'logo' });
    }
    return { name, id: company.id, website: response.url, status: 'found', options: options.slice(0, 7) };
  } catch (error) { return { name, website, status: error.name }; }
}
async function run() {
  const results = [];
  for (let index = 0; index < domains.length; index += 5) {
    const batch = await Promise.all(domains.slice(index, index + 5).map(research));
    results.push(...batch);
    batch.forEach((entry) => console.log(JSON.stringify(entry)));
  }
  fs.writeFileSync(path.join(directory, 'company-logo-candidates.json'), JSON.stringify(results, null, 2));
}
run().catch((error) => { console.error(error.message); process.exitCode = 1; });
