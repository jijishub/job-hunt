const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const {prepare,ROOT}=require('./jobstreet_resume.cjs');
const {bossjobHelper}=require('./bossjob_browser.cjs');
function parseOptions(args){
 let variant='business',prepareOnly=false;
 for(let i=0;i<args.length;i++){
  if(args[i]==='--prepare')prepareOnly=true;
  else if(args[i]==='--variant'){
   variant=args[++i];
   if(!['business','technical'].includes(variant))throw Error('Variant must be business or technical.');
  }else throw Error('Unknown option: '+args[i]);
 }
 return {variant,prepareOnly};
}
async function main(args=process.argv.slice(2)){
 const {variant,prepareOnly}=parseOptions(args);
 const outputDir=path.join(ROOT,'.data/bossjob');
 const {data}=await prepare(variant,outputDir);
 fs.writeFileSync(path.join(outputDir,'profile.json'),JSON.stringify({target:'https://bossjob.ph/en-us/manage-profile',...data},null,2));
 const payload={data,resume:fs.readFileSync(path.join(ROOT,data.source.path)).toString('base64'),filename:path.basename(data.source.path)};
 const helper=path.join(outputDir,'helper.js');fs.writeFileSync(helper,`(${bossjobHelper.toString()})(${JSON.stringify(payload)});\n`);
 console.log(`Prepared active resume: ${data.source.path}\nHelper: ${helper}`);
 if(prepareOnly)return;
 if(process.platform!=='win32')throw Error('Open Bossjob in your main browser and paste the generated helper into its console.');
 const result=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',"Set-Clipboard -Value ([System.IO.File]::ReadAllText($env:BOSSJOB_HELPER_PATH)); Start-Process 'https://bossjob.ph/en-us/manage-profile'"],{env:{...process.env,BOSSJOB_HELPER_PATH:helper},encoding:'utf8',windowsHide:true});
 if(result.error||result.status!==0)throw Error(result.error?.message||result.stderr);
 console.log('Helper copied to clipboard. Bossjob opened in your main browser session. Press F12, open Console, paste and run. PDF upload does not update profile fields. Open each work/education editor, choose its matching resume entry, and use Fill open editor. Review and save in Bossjob.');
}
if(require.main===module)main().catch(error=>{console.error(error.message);process.exitCode=1});
module.exports={main,parseOptions};
