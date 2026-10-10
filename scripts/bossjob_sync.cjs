const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const {prepare,ROOT}=require('./jobstreet_resume.cjs');
const {bossjobHelper}=require('./bossjob_browser.cjs');
async function main(){
 const outputDir=path.join(ROOT,'.data/bossjob');
 const {data}=await prepare('technical',outputDir);
 fs.writeFileSync(path.join(outputDir,'profile.json'),JSON.stringify({target:'https://bossjob.ph/en-us/manage-profile',...data},null,2));
 const payload={data,resume:fs.readFileSync(path.join(ROOT,data.source.path)).toString('base64'),filename:path.basename(data.source.path)};
 const helper=path.join(outputDir,'helper.js');fs.writeFileSync(helper,`(${bossjobHelper.toString()})(${JSON.stringify(payload)});\n`);
 console.log(`Prepared active resume: ${data.source.path}\nHelper: ${helper}`);
 if(process.argv.includes('--prepare'))return;
 if(process.platform!=='win32')throw Error('Open Bossjob in your main browser and paste the generated helper into its console.');
 const result=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',"Set-Clipboard -Value ([System.IO.File]::ReadAllText($env:BOSSJOB_HELPER_PATH)); Start-Process 'https://bossjob.ph/en-us/manage-profile'"],{env:{...process.env,BOSSJOB_HELPER_PATH:helper},encoding:'utf8'});
 if(result.error||result.status!==0)throw Error(result.error?.message||result.stderr);
 console.log('Helper copied to clipboard. Bossjob opened in your main browser session. Press F12, open Console, paste and run. Use Upload active resume, or select a resume entry and Fill open editor. Review and save each editor in Bossjob.');
}
if(require.main===module)main().catch(error=>{console.error(error.message);process.exitCode=1});
module.exports={main};
