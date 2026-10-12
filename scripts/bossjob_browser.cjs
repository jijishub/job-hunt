// Serialized into the user's main, signed-in Bossjob tab.
function bossjobHelper(payload,workflowInstaller) {
 if(location.hostname!=='bossjob.ph'||!location.pathname.endsWith('/manage-profile'))throw Error('Run in Bossjob Manage Profile.');
 const old=document.getElementById('bossjob-helper');if(old?.dataset.running==='true')throw Error('Stop the running Bossjob sync before replacing it.');old?.dispatchEvent(new Event('bossjob-dispose'));old?.remove();
 const panel=document.createElement('section');panel.id='bossjob-helper';
 panel.style.cssText='position:fixed;right:12px;top:12px;z-index:2147483647;box-sizing:border-box;background:white;color:#4A3E44;padding:18px;border:2px solid #FF7AB3;border-radius:12px;width:min(380px,calc(100vw - 24px));max-height:calc(100vh - 24px);overflow:auto;font:14px system-ui;box-shadow:0 4px 24px #0004';
 const title=document.createElement('strong');title.textContent='Bossjob — '+(payload.data.variant||'technical')+' resume';
 const status=document.createElement('p');status.setAttribute('role','status');status.textContent='Bossjob’s PDF parsing can leave incomplete details. Sync work & education updates matching entries and adds missing entries from your business resume.';
 const select=document.createElement('select');select.style.width='100%';select.setAttribute('aria-label','Resume section');
 const profile=payload.data.profile;
 const entries=[{kind:'personal',label:'Personal details',values:profile.personal},...(profile.experience||[]).map(entry=>({kind:'work',label:entry.title+' — '+entry.company,values:entry})),...(profile.education||[]).map(entry=>({kind:'education',label:entry.institution,values:entry}))];
 if(profile.skills?.length)entries.push({kind:'skills',label:'Skills',values:{skills:profile.skills.join(', ')}});
 if(profile.certifications?.length)entries.push({kind:'certifications',label:'Certifications',values:{certifications:profile.certifications.join('\n')}});
 entries.forEach((entry,index)=>{const option=document.createElement('option');option.value=String(index);option.textContent=entry.label;select.append(option);});
 const upload=document.createElement('button');upload.textContent='Upload active resume';
 const fill=document.createElement('button');fill.textContent='Fill open editor';
 const copy=document.createElement('button');copy.textContent='Copy resume text';
 const inspect=document.createElement('button');inspect.textContent='Download field inspection';
 const copyInspection=document.createElement('button');copyInspection.textContent='Copy editor controls (JSON)';
 const close=document.createElement('button');close.textContent='Close';
 for(const button of [upload,fill,copy,copyInspection,inspect,close]){button.type='button';button.style.cssText='margin:8px 8px 0 0;padding:8px 10px;border:1px solid #F1DDE9;border-radius:8px;background:#FFF0F6;color:#9D3C5E;cursor:pointer';}
 copyInspection.style.background='#EEF4FF';copyInspection.style.color='#175C9B';
 const details=document.createElement('details');details.style.marginTop='12px';const summary=document.createElement('summary');summary.textContent='Preview selected resume section';
 const preview=document.createElement('textarea');preview.readOnly=true;preview.setAttribute('aria-label','Selected resume text');preview.style.cssText='box-sizing:border-box;width:100%;height:180px;margin-top:8px;font:12px system-ui';details.append(summary,preview);
 const sectionText=entry=>Object.entries(entry.values).filter(([,value])=>value!=null&&value!=='').map(([key,value])=>key.replaceAll('_',' ')+': '+String(value)).join('\n');
 const refresh=()=>{preview.value=sectionText(entries[Number(select.value)]);};select.onchange=refresh;refresh();
 const inspectionDetails=document.createElement('details');inspectionDetails.style.marginTop='12px';const inspectionSummary=document.createElement('summary');inspectionSummary.textContent='Field inspection JSON';
 const inspectionPreview=document.createElement('textarea');inspectionPreview.readOnly=true;inspectionPreview.setAttribute('aria-label','Field inspection JSON');inspectionPreview.style.cssText=preview.style.cssText;inspectionDetails.append(inspectionSummary,inspectionPreview);
 panel.append(title,status,select,upload,fill,copy,copyInspection,inspect,details,inspectionDetails,close);document.body.append(panel);close.onclick=()=>panel.remove();
 const guard=()=>{if(location.hostname!=='bossjob.ph'||!location.pathname.endsWith('/manage-profile'))throw Error('Page changed. Reopen Manage Profile.');};
 const visible=el=>el.isConnected&&!panel.contains(el)&&el.getClientRects().length>0&&getComputedStyle(el).visibility!=='hidden'&&!el.closest('[aria-hidden=true],[inert]');
 const labelText=el=>{const clone=el.cloneNode(true);clone.querySelectorAll('input,textarea,select,button').forEach(control=>control.remove());return clone.textContent;};
 const containerLabel=el=>{
  let ancestor=el.parentElement;
  for(let depth=0;ancestor&&depth<3;depth++,ancestor=ancestor.parentElement){
   const controls=ancestor.querySelectorAll('input:not([type=hidden]),textarea,select,[role=combobox]');
   const captions=ancestor.querySelectorAll('label');
   if(controls.length===1&&controls[0]===el&&captions.length===1&&!captions[0].htmlFor)return labelText(captions[0]);
  }
  return '';
 };
 const labels=el=>[el.getAttribute('aria-label'),(el.getAttribute('aria-labelledby')||'').split(/\s+/).filter(Boolean).map(id=>document.getElementById(id)?.textContent||'').join(' '),...[...(el.labels||[])].map(labelText),containerLabel(el),el.placeholder,el.name,el.id].filter(Boolean);
 const label=el=>labels(el)[0]||'';
 const normalize=value=>String(value||'').replace(/([a-z])([A-Z])/g,'$1 $2').replace(/[_-]/g,' ').replace(/\(required\)/gi,'').replace(/[＊*:]/g,' ').trim().toLowerCase().replace(/\s+/g,' ');
 const report=message=>{status.textContent=message;};
 upload.onclick=async()=>{try{
  guard();
  const candidates=()=>[...document.querySelectorAll('input[type=file]')].filter(el=>!panel.contains(el)&&!el.disabled&&(/pdf|\.doc/i.test(el.accept)||(!/image\//i.test(el.accept)&&/resume|\bcv\b/i.test(label(el)+' '+el.parentElement?.textContent))));
  let fields=candidates();
  if(!fields.length){
   const buttons=[...document.querySelectorAll('button,[role=button]')].filter(el=>visible(el)&&normalize(el.getAttribute('aria-label')||el.textContent)==='upload resume');
   if(buttons.length!==1)throw Error('Expected one Bossjob Upload resume button; found '+buttons.length+'.');
   report('Opening Bossjob resume uploader…');
   // Supply the embedded PDF instead of opening the operating-system file picker.
   const originalClick=HTMLInputElement.prototype.click;
   HTMLInputElement.prototype.click=function(){if(this.type!=='file')return originalClick.call(this);};
   try{
    buttons[0].click();
    const deadline=Date.now()+10000;
    while(panel.isConnected&&Date.now()<deadline){guard();fields=candidates();if(fields.length)break;await new Promise(resolve=>setTimeout(resolve,100));}
   }finally{HTMLInputElement.prototype.click=originalClick;}
  }
  if(fields.length!==1)throw Error('Expected one resume upload control; found '+fields.length+'. Open the resume editor and download a fresh field inspection.');
  const bytes=Uint8Array.from(atob(payload.resume),character=>character.charCodeAt(0));
  const transfer=new DataTransfer();transfer.items.add(new File([bytes],payload.filename,{type:'application/pdf'}));fields[0].files=transfer.files;
  fields[0].dispatchEvent(new Event('input',{bubbles:true}));fields[0].dispatchEvent(new Event('change',{bubbles:true}));
  report('Resume PDF supplied. Wait for Bossjob’s parsing to finish, then sync work & education to correct incomplete entries.');
 }catch(error){report(error.message);}};
 fill.onclick=()=>{try{
  guard();const entry=entries[Number(select.value)];
  const aliases={name:['full name','name'],first_name:['first name'],last_name:['last name'],email:['email','email address'],phone:['phone','phone number','mobile number'],website:['website','portfolio','portfolio url'],location:['location','current location'],company:['company','company name'],title:['job title','position','position title','job position'],description:['description','job description','responsibilities','work description','education description'],institution:['school','school name','institution','university','college university'],qualification:['degree','qualification','course','major course'],start_date:['start date','from'],end_date:['end date','to'],start_year:['start year'],end_year:['end year','graduation year'],skills:['skills'],certifications:['certifications','certificates']};
  const dialogs=[...document.querySelectorAll('[role=dialog],dialog,[aria-modal=true]')].filter(visible).filter((el,_,all)=>!all.some(parent=>parent!==el&&parent.contains(el)));
  const forms=[...document.querySelectorAll('form')].filter(visible);
  const roots=dialogs.length?dialogs:forms;
  if(roots.length!==1)throw Error('Open exactly one profile editor before filling.');
  const operations=[],manual=[];
  for(const [key,names] of Object.entries(aliases)){
   if(!entry.values[key])continue;
   const fields=[...roots[0].querySelectorAll('input,textarea,select')].filter(el=>visible(el)&&!el.disabled&&!el.readOnly&&!['file','password','hidden','checkbox','radio'].includes(el.type)&&el.getAttribute('role')!=='combobox'&&labels(el).some(text=>names.includes(normalize(text))));
   if(fields.length>1)throw Error('Ambiguous field: '+key+'. Nothing filled.');
   if(fields.length===1){
    const field=fields[0];let value=String(entry.values[key]);
    if(field.tagName==='SELECT'){
     const options=[...field.options].filter(option=>!option.disabled&&(normalize(option.value)===normalize(value)||normalize(option.textContent)===normalize(value)));
     if(options.length!==1){manual.push(key);continue;}value=options[0].value;
    }else if(['start_date','end_date'].includes(key)&&field.type!=='month'){manual.push(key);continue;}
    operations.push([field,value,key]);
   }
  }
  if(!operations.length)throw Error('No verified field labels matched. Download the field inspection to configure this editor.');
  const anchors={personal:['name','first_name','last_name','email','phone','website','location'],work:['company','title'],education:['institution','qualification'],skills:['skills'],certifications:['certifications']};
  if(!operations.some(([, ,key])=>anchors[entry.kind].includes(key)))throw Error('The open editor does not match the selected resume section. Choose the matching section before filling.');
  if(new Set(operations.map(([field])=>field)).size!==operations.length)throw Error('Ambiguous field mapping. Nothing filled.');
  for(const [field,value] of operations){const prototype=field.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:field.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(prototype,'value').set.call(field,value);field.dispatchEvent(new Event('input',{bubbles:true}));field.dispatchEvent(new Event('change',{bubbles:true}));}
  report('Filled '+operations.length+' fields from '+entry.label+'. Review dates, current-work choices, and selections'+(manual.length?' ('+manual.map(key=>key.replaceAll('_',' ')).join(', ')+')':'')+', then save in Bossjob. Use Copy selected section for controls that need manual input.');
 }catch(error){report(error.message);}};
 copy.onclick=async()=>{try{guard();refresh();if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(preview.value);report('Selected resume section copied. Paste its values into the matching Bossjob fields.');}else{details.open=true;preview.focus();preview.select();report('Resume text selected. Press Ctrl+C to copy.');}}catch{details.open=true;preview.focus();preview.select();report('Resume text selected. Press Ctrl+C to copy.');}};
 const collectInspection=()=>{
  guard();
  const editors=[...document.querySelectorAll('[role=dialog],dialog,[aria-modal=true],.ant-modal-content,.ant-drawer-content')].filter(visible).filter((el,_,all)=>!all.some(parent=>parent!==el&&parent.contains(el)));
  const forms=[...document.querySelectorAll('form')].filter(visible);
  const roots=editors.length?editors:forms;
  if(roots.length>1)throw Error('Open exactly one profile editor before inspecting its controls.');
  const root=roots[0]||document.body;
  if(![...root.querySelectorAll('input,textarea,select,[role=combobox],[contenteditable=true]')].some(visible))throw Error('Open exactly one profile editor before inspecting its controls.');
  return [...root.querySelectorAll('input,textarea,select,button,[role=button],[role=combobox],[contenteditable=true]')].filter(el=>!panel.contains(el)&&el.type!=='password').map(el=>({tag:el.tagName,type:el.type,id:el.id,name:el.name,label:label(el),labels:labels(el),role:el.getAttribute('role'),ariaControls:el.getAttribute('aria-controls'),placeholder:el.getAttribute('placeholder'),required:el.required||el.getAttribute('aria-required')==='true',readOnly:el.readOnly,accept:el.accept,visible:visible(el),editor:root.tagName,options:el.tagName==='SELECT'?[...el.options].map(option=>({value:option.value,text:option.textContent})):undefined,text:el.tagName==='BUTTON'?el.textContent.trim():undefined}));
 };
 inspect.onclick=()=>{try{const fields=collectInspection();const url=URL.createObjectURL(new Blob([JSON.stringify(fields,null,2)],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download='bossjob-controls.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);report('Field inspection downloaded.');}catch(error){report(error.message);}};
 copyInspection.onclick=async()=>{
  let json;
  try{json=JSON.stringify(collectInspection(),null,2);}catch(error){report(error.message);return;}
  inspectionPreview.value=json;
  try{if(!navigator.clipboard?.writeText)throw Error('Clipboard unavailable');await navigator.clipboard.writeText(json);report('Editor field inspection copied. Paste this JSON into the chat.');}
  catch{inspectionDetails.open=true;inspectionPreview.focus();inspectionPreview.select();report('Inspection JSON selected. Press Ctrl+C, then paste it into the chat.');}
 };
 if(workflowInstaller)workflowInstaller({payload,panel,entries,select,refresh,visible,labels,label,normalize,report,guard,fill,upload,close});
 return {variant:payload.data.variant,source:payload.data.source};
}
module.exports={bossjobHelper};
