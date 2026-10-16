// Offline only: no database client, cloud SDK, upload or network access.
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const sharp = require('sharp');

async function prepare({ input, output, baseUrl }) {
  const base = new URL(baseUrl);
  if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash) throw Error('Use an HTTPS public asset base URL without credentials, query or fragment.');
  // Refuse to replace a previous migration/backup directory.
  fs.mkdirSync(output, { recursive: false });
  const snapshot = JSON.parse(fs.readFileSync(input, 'utf8'));
  const companies = Array.isArray(snapshot) ? snapshot : snapshot.companies;
  if (!Array.isArray(companies)) throw Error('Input must contain a companies array.');
  const inventory = { embedded: 0, external: 0, emoji: 0, missing: 0, invalid: 0 };
  const entries = [], failures = [];
  for (const company of companies) {
    const value = company.logo_url;
    if (!value) { inventory.missing++; continue; }
    if (value.startsWith('emoji:')) { inventory.emoji++; continue; }
    if (!value.startsWith('data:')) { inventory.external++; continue; }
    inventory.embedded++;
    try {
      const match = value.match(/^data:(image\/(?:png|webp|jpeg|gif|avif|svg\+xml));base64,([A-Za-z0-9+/=]+)$/);
      if (!match) throw Error('Unsupported embedded image.');
      const bytes = Buffer.from(match[2],'base64');
      if (bytes.length > 8*1024*1024 || !bytes.length) throw Error('Image size is outside supported limits.');
      const metadata = await sharp(bytes, { limitInputPixels:16000000 }).metadata();
      if (!metadata.width || !metadata.height) throw Error('Image could not be decoded.');
      // Decode pixels as well as metadata to reject truncated/corrupt images.
      await sharp(bytes, { limitInputPixels:16000000 }).raw().toBuffer();
      const hash = createHash('sha256').update(bytes).digest('hex');
      const ext = { 'image/png':'png','image/webp':'webp','image/jpeg':'jpg','image/gif':'gif','image/avif':'avif','image/svg+xml':'svg' }[match[1]];
      const file = `${hash}.${ext}`;
      if (!fs.existsSync(path.join(output,file))) fs.writeFileSync(path.join(output,file),bytes,{flag:'wx'});
      entries.push({ id:company.id, expected_updated_at:company.updated_at, expected_logo:value, object:file, content_type:match[1], sha256:hash, bytes:bytes.length, width:metadata.width, height:metadata.height, proposed_url:new URL(file,base.href.replace(/\/?$/,'/')).href });
    } catch { inventory.invalid++; failures.push({ id:company.id, reason:'Embedded image failed validation; preserve its existing value.' }); }
  }
  fs.writeFileSync(path.join(output,'manifest.json'),JSON.stringify({ version:1, created_at:new Date().toISOString(), inventory, entries, failures, state:'prepared-not-uploaded-not-applied' },null,2),{flag:'wx'});
  // Separate immutable backup contains only fields this future migration changes.
  fs.writeFileSync(path.join(output,'before.json'),JSON.stringify(entries.map(entry=>({id:entry.id,logo_url:entry.expected_logo,updated_at:entry.expected_updated_at})),null,2),{flag:'wx'});
  return { inventory, objects:new Set(entries.map(entry=>entry.object)).size, companies:entries.length, failures:failures.length };
}
if(require.main===module){
  const args=process.argv.slice(2);const get=name=>args[args.indexOf(name)+1];
  if(!['--input','--output','--base-url'].every(name=>args.includes(name)&&get(name))) { console.error('Use --input existing-snapshot.json --output NEW-DIRECTORY --base-url https://assets.example.com/company-logos/');process.exitCode=1; }
  else prepare({input:get('--input'),output:get('--output'),baseUrl:get('--base-url')}).then(result=>console.log(JSON.stringify(result))).catch(()=>{console.error('Offline logo preparation failed. Existing logos and database were not modified.');process.exitCode=1;});
}
module.exports={prepare};
