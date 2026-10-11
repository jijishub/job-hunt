const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');
async function main() {
  const [name, source_url, source_page] = process.argv.slice(2);
  if (!name || !source_url || !source_page) throw new Error('Provide company name, image URL and source page');
  const dir = path.join(__dirname, '../.data');
  const body = await (await fetch('https://jobhunt.jizellecasia.site/api/companies?role=admin')).json();
  const company = body.data.find(c=>c.name===name);
  if (!company || company.logo_url) throw new Error('Company missing or already has a logo');
  const response = await fetch(source_url,{signal:AbortSignal.timeout(15000)});
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const logo = await sharp(Buffer.from(await response.arrayBuffer())).resize({width:256,height:128,fit:'inside',withoutEnlargement:true}).webp({quality:90}).toBuffer();
  const planFile = path.join(dir,'company-logo-plan.json');
  const plan = JSON.parse(fs.readFileSync(planFile));
  if (plan.some(p=>p.id===company.id)) throw new Error('Already in plan');
  plan.push({id:company.id,name,source_url,source_page,logo_url:`data:image/webp;base64,${logo.toString('base64')}`});
  fs.writeFileSync(path.join(dir,'logo-assets',`${company.id}.webp`),logo);
  fs.writeFileSync(planFile,JSON.stringify(plan,null,2));
  console.log(`${name}: verified (${logo.length} bytes)`);
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
