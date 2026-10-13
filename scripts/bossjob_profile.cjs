const fs = require('node:fs');
const path = require('node:path');
const configPath = path.resolve(__dirname, '../references/rpa/bossjob-profile.json');
let config = null;
try { config = JSON.parse(process.env.BOSSJOB_PROFILE_JSON || fs.readFileSync(configPath, 'utf8')); } catch {}
const BUSINESS_PERSONAL_SUMMARY = typeof config?.summary === 'string' ? config.summary : '';

function bossjobProfile(data) {
 if(data.variant!=='business')return data;
 if(!BUSINESS_PERSONAL_SUMMARY.trim())throw Error('Configure a private Bossjob profile in references/rpa/bossjob-profile.json or BOSSJOB_PROFILE_JSON.');
 return {...data,profile:{...data.profile,summary:BUSINESS_PERSONAL_SUMMARY,experience:data.profile.experience.map(entry=>{
  const titles=config.existing_titles_by_company?.[entry.company];
  return Array.isArray(titles)&&titles.every(title=>typeof title==='string')?{...entry,existing_titles:titles}:entry;
 })}};
}
module.exports={BUSINESS_PERSONAL_SUMMARY,bossjobProfile};
