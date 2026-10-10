// Serialized into the user's main, signed-in Bossjob tab.
function bossjobHelper(payload) {
 if(location.hostname!=='bossjob.ph'||!location.pathname.endsWith('/manage-profile'))throw Error('Run in Bossjob Manage Profile.');
 const old=document.getElementById('bossjob-helper');old?.remove();
 const panel=document.createElement('section');panel.id='bossjob-helper';
 panel.style.cssText='position:fixed;right:16px;top:16px;z-index:2147483647;background:white;color:#4A3E44;padding:18px;border:2px solid #FF7AB3;border-radius:12px;width:340px;font:14px system-ui;box-shadow:0 4px 24px #0004';
 const title=document.createElement('strong');title.textContent='Bossjob — active technical resume';
 const status=document.createElement('p');status.textContent='Open the resume upload editor, then click Upload active resume.';
 const select=document.createElement('select');select.style.width='100%';
 const entries=[{label:'Personal details',values:payload.data.profile.personal},...payload.data.profile.experience.map(entry=>({label:entry.title+' — '+entry.company,values:entry})),...payload.data.profile.education.map(entry=>({label:entry.institution,values:entry}))];
 entries.forEach((entry,index)=>{const option=document.createElement('option');option.value=String(index);option.textContent=entry.label;select.append(option);});
 const upload=document.createElement('button');upload.textContent='Upload active resume';
 const fill=document.createElement('button');fill.textContent='Fill open editor';
 const inspect=document.createElement('button');inspect.textContent='Download field inspection';
 const close=document.createElement('button');close.textContent='Close';
 for(const button of [upload,fill,inspect,close])button.style.cssText='margin:8px 8px 0 0;padding:7px;cursor:pointer';
 panel.append(title,status,select,upload,fill,inspect,close);document.body.append(panel);close.onclick=()=>panel.remove();
 const guard=()=>{if(location.hostname!=='bossjob.ph'||!location.pathname.endsWith('/manage-profile'))throw Error('Page changed. Reopen Manage Profile.');};
 const visible=el=>!panel.contains(el)&&el.getClientRects().length>0&&!el.closest('[aria-hidden=true],[inert]');
 const label=el=>el.getAttribute('aria-label')||[...(el.labels||[])].map(item=>item.textContent).join(' ')||el.placeholder||el.name||el.id;
 const normalize=value=>String(value||'').trim().toLowerCase().replace(/\s+/g,' ');
 const report=message=>{status.textContent=message;};
 upload.onclick=async()=>{try{
  guard();
  const candidates=()=>[...document.querySelectorAll('input[type=file]')].filter(el=>!panel.contains(el)&&!el.disabled&&(/pdf|\.doc/i.test(el.accept)||(!/image\//i.test(el.accept)&&/resume|\bcv\b/i.test(label(el)+' '+el.parentElement?.textContent))));
  let fields=candidates();
  if(!fields.length){
   const buttons=[...document.querySelectorAll('button,[role=button]')].filter(el=>visible(el)&&normalize(el.getAttribute('aria-label')||el.textContent)==='upload resume');
   if(buttons.length!==1)throw Error('Expected one Bossjob Upload resume button; found '+buttons.length+'.');
   report('Opening Bossjob resume uploader?');
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
  report('Active resume supplied. Review Bossjob parsing results and save in the site if prompted.');
 }catch(error){report(error.message);}};
 fill.onclick=()=>{try{
  guard();const entry=entries[Number(select.value)];
  const aliases={name:['full name','name'],first_name:['first name'],last_name:['last name'],email:['email','email address'],phone:['phone','phone number','mobile number'],website:['website','portfolio'],location:['location'],company:['company','company name'],title:['job title','position','position title'],description:['description','job description','responsibilities'],institution:['school','school name','institution'],qualification:['degree','qualification']};
  const dialogs=[...document.querySelectorAll('[role=dialog],dialog')].filter(visible);
  const forms=[...document.querySelectorAll('form')].filter(visible);
  const roots=dialogs.length?dialogs:forms;
  if(roots.length!==1)throw Error('Open exactly one profile editor before filling.');
  const operations=[];
  for(const [key,names] of Object.entries(aliases)){
   if(!entry.values[key])continue;
   const fields=[...roots[0].querySelectorAll('input,textarea')].filter(el=>visible(el)&&!el.disabled&&!el.readOnly&&!['file','password','hidden','checkbox','radio'].includes(el.type)&&names.includes(normalize(label(el))));
   if(fields.length>1)throw Error('Ambiguous field: '+key+'. Nothing filled.');
   if(fields.length===1)operations.push([fields[0],entry.values[key]]);
  }
  if(!operations.length)throw Error('No verified field labels matched. Download the field inspection to configure this editor.');
  for(const [field,value] of operations){const prototype=field.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(prototype,'value').set.call(field,String(value));field.dispatchEvent(new Event('input',{bubbles:true}));field.dispatchEvent(new Event('change',{bubbles:true}));}
  report('Filled '+operations.length+' fields from '+entry.label+'. Review dates and selections, then save in Bossjob.');
 }catch(error){report(error.message);}};
 inspect.onclick=()=>{try{guard();const fields=[...document.querySelectorAll('input,textarea,select,button,[role=combobox]')].filter(el=>!panel.contains(el)).map(el=>({tag:el.tagName,type:el.type,id:el.id,name:el.name,label:label(el),accept:el.accept,visible:visible(el),context:el.parentElement?.textContent?.trim().slice(0,300),text:el.tagName==='BUTTON'?el.textContent.trim():undefined}));const url=URL.createObjectURL(new Blob([JSON.stringify(fields,null,2)],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download='bossjob-controls.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);report('Field inspection downloaded.');}catch(error){report(error.message);}};
 return {source:payload.data.source,profile:payload.data.profile};
}
module.exports={bossjobHelper};
