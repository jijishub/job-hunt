const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const {prepare,ROOT}=require('./jobstreet_resume.cjs');
const {bossjobHelper}=require('./bossjob_browser.cjs');
const {installBossjobWorkflow}=require('./bossjob_workflow.cjs');
const {bossjobProfile}=require('./bossjob_profile.cjs');
function parseOptions(args){
 let variant='business',prepareOnly=false,remainingOnly=false;
 for(let i=0;i<args.length;i++){
  if(args[i]==='--prepare')prepareOnly=true;
  else if(args[i]==='--remaining')remainingOnly=true;
  else if(args[i]==='--variant'){
   variant=args[++i];
   if(!['business','technical'].includes(variant))throw Error('Variant must be business or technical.');
  }else throw Error('Unknown option: '+args[i]);
 }
 return {variant,prepareOnly,...(remainingOnly?{remainingOnly:true}:{})};
}
async function main(args=process.argv.slice(2)){
 const {variant,prepareOnly,remainingOnly}=parseOptions(args);
 if(remainingOnly&&variant!=='business')throw Error('--remaining uses the business resume.');
 const outputDir=path.join(ROOT,'.data/bossjob');
 const prepared=await prepare(variant,outputDir);
 const data=bossjobProfile(prepared.data);
 fs.writeFileSync(path.join(outputDir,'profile.json'),JSON.stringify({target:'https://bossjob.ph/en-us/manage-profile',...data},null,2));
 const remainingTasks=['summary',...data.profile.experience.filter(entry=>entry.existing_titles?.length).map(entry=>`work:${entry.company}`)];
 const payload={data,resume:fs.readFileSync(path.join(ROOT,data.source.path)).toString('base64'),filename:path.basename(data.source.path),auto_sync:true,full_profile:true,auto_upload:!remainingOnly,update_only:Boolean(remainingOnly),...(remainingOnly?{only_tasks:remainingTasks}:{})};
 const helper=path.join(outputDir,'helper.js');fs.writeFileSync(helper,`(${bossjobHelper.toString()})(${JSON.stringify(payload)},\n${installBossjobWorkflow.toString()});\n`);
 console.log(`Prepared active resume: ${data.source.path}\nHelper: ${helper}`);
 if(prepareOnly)return;
 if(process.platform!=='win32')throw Error('Open Bossjob in your main browser and paste the generated helper into its console.');
 const result=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',"Set-Clipboard -Value ([System.IO.File]::ReadAllText($env:BOSSJOB_HELPER_PATH)); Start-Process 'https://bossjob.ph/en-us/manage-profile'"],{env:{...process.env,BOSSJOB_HELPER_PATH:helper},encoding:'utf8',windowsHide:true});
 if(result.error||result.status!==0)throw Error(result.error?.message||result.stderr);
 console.log(remainingOnly?'Helper copied to clipboard. Paste once in Bossjob Console to update the personal summary and existing Cloudji entry. PDF upload and new-record creation are disabled.':'Helper copied to clipboard. Bossjob opened in your main browser session. Close any editor, press F12, open Console, paste once and run. It supplies the exact resume PDF, waits for upload acknowledgement, then opens, fills, saves and verifies the personal summary, work, education, personal details, skills and certifications. Unavailable sections are reported.');
}
if(require.main===module)main().catch(error=>{console.error(error.message);process.exitCode=1});
module.exports={main,parseOptions};
