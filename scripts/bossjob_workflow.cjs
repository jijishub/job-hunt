// Included verbatim in the signed-in tab's helper. No API credentials or profile APIs.
function installBossjobWorkflow(context) {
 const {payload,panel,entries,select,refresh,visible,labels,label,normalize,report,guard}=context;
 const oldFill=context.fill;
 const sync=document.createElement('button');sync.type='button';sync.textContent='Sync work & education';sync.style.cssText='margin:8px 8px 8px 0;padding:10px;border:0;border-radius:8px;background:#9D3C5E;color:white;cursor:pointer';
 const stop=document.createElement('button');stop.type='button';stop.textContent='Stop';stop.disabled=true;stop.style.cssText=context.fill.style.cssText;
 const pick=document.createElement('button');pick.type='button';pick.textContent='Choose this entry’s Edit / +';pick.hidden=true;pick.style.cssText=context.fill.style.cssText;
 panel.insertBefore(sync,select);panel.insertBefore(stop,select);panel.insertBefore(pick,select);
 const progress=document.createElement('ol');progress.style.cssText='padding-left:22px;font-size:12px';panel.insertBefore(progress,select);
 const tasks=entries.map((entry,index)=>({entry,index})).filter(({entry})=>['work','education'].includes(entry.kind));
 const rows=tasks.map(({entry})=>{const row=document.createElement('li');row.textContent=entry.label;progress.append(row);return row;});
 let at=0,pending=null,stopped=false,running=false,pickHandler=null;
 const timeout=payload.timeout_ms||12000;
 const fold=text=>normalize(text).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'');
 const organization=text=>fold(normalize(text).replace(/\b(?:incorporated|inc|corp(?:oration)?|ltd|limited|llc)\.?$/i,''));
 const check=()=>{guard();if(stopped||!panel.isConnected)throw Error('Stopped. Any open editor was left for you to review.');};
 const one=(items,name)=>{const unique=[...new Set(items)];if(unique.length>1)throw Error('Multiple '+name+' matches. Nothing saved.');return unique[0];};
 async function waitFor(find,name){const until=Date.now()+timeout;while(Date.now()<until){check();const result=find();if(result)return result;await new Promise(resolve=>setTimeout(resolve,100));}throw Error('Timed out waiting for '+name+'. The sequence is paused.');}
 const editors=()=>[...document.querySelectorAll('[role=dialog],dialog,[aria-modal=true],.ant-modal-content,.ant-drawer-content,form')].filter(visible).filter((el,_,all)=>!all.some(parent=>parent!==el&&parent.contains(el)));
 const editor=()=>one(editors(),'editor');
 const sectionNames={work:['work experience','working experience','employment history','experience'],education:['education','educational background']};
 function sectionFor(entry){
  const names=sectionNames[entry.kind];
  const headings=[...document.querySelectorAll('h1,h2,h3,h4,h5,h6,[role=heading],p,span,div')].filter(el=>visible(el)&&names.includes(normalize(el.textContent).replace(/\s*\(\d+\)$/,'')));
  const heading=one(headings.filter(el=>!headings.some(child=>child!==el&&el.contains(child))),entry.kind+' heading');
  if(!heading)throw Error('Cannot identify '+names[0]+'. Open its editor and use Copy editor controls (JSON).');
  let root=heading.parentElement,last=root;
  const otherNames=['personal information','basic information','basic info','skills','certifications','certificates','about me',...Object.values(sectionNames).flat().filter(name=>!names.includes(name))];
  while(root&&root!==document.body){
   if([...root.querySelectorAll('h1,h2,h3,h4,h5,h6,[role=heading],p,span,div')].some(el=>visible(el)&&!el.contains(heading)&&otherNames.includes(normalize(el.textContent))))break;
   last=root;root=root.parentElement;
  }
  return last;
 }
 const textMatches=(el,text)=>fold(el.textContent)===fold(text);
 function recordFor(entry,section){
  const primary=entry.kind==='work'?entry.values.title:entry.values.institution;
  const secondary=entry.kind==='work'?entry.values.company:entry.values.qualification;
  const all=[...section.querySelectorAll('h1,h2,h3,h4,h5,h6,p,span,div,li,article')].filter(el=>visible(el)&&textMatches(el,primary));
  const leaves=all.filter(el=>!all.some(child=>child!==el&&el.contains(child)));
  const records=leaves.map(leaf=>{
   let root=leaf.parentElement,last=null;
   while(root&&section.contains(root)){
    if(leaves.some(other=>other!==leaf&&root.contains(other)))break;
    const secondaryPresent=entry.kind==='work'?[...root.querySelectorAll('p,span,div,a,strong')].some(el=>organization(el.textContent)===organization(secondary)):fold(root.textContent).includes(fold(secondary));
    if(secondaryPresent){
     // A wrapper containing another resume role cannot identify this one entry.
     if(tasks.some(task=>task.entry!==entry&&task.entry.kind===entry.kind&&fold(task.entry.kind==='work'?task.entry.values.title:task.entry.values.institution)!==fold(primary)&&[...root.querySelectorAll('h1,h2,h3,h4,h5,h6,p,span,div')].some(el=>textMatches(el,task.entry.kind==='work'?task.entry.values.title:task.entry.values.institution))))break;
     last=root;
    }
    root=root.parentElement;
   }
   return last;
  }).filter(Boolean);
  return one(records,'existing '+entry.kind+' entry');
 }
 function possiblePartial(entry,section){
  const employer=entry.kind==='work'?entry.values.company:entry.values.institution;
  if(entry.kind!=='work'){
   const schoolName=employer.split(/\s[-–—]\s|\s*\(/)[0];
   return fold(section.textContent).includes(fold(employer))||(schoolName.length>=12&&fold(section.textContent).includes(fold(schoolName)));
  }
  if(!fold(section.textContent).includes(organization(employer)))return false;
  const all=[...section.querySelectorAll('p,span,div,h1,h2,h3,h4,h5,h6,a,strong')].filter(el=>visible(el)&&organization(el.textContent)===organization(employer));
  const leaves=all.filter(el=>!all.some(child=>child!==el&&el.contains(child)));
  if(!leaves.length)return true;
  const known=tasks.filter(task=>task.entry.kind==='work'&&task.entry!==entry&&organization(task.entry.values.company)===organization(employer)).map(task=>recordFor(task.entry,section)).filter(Boolean);
  return leaves.some(leaf=>!known.some(record=>record.contains(leaf)));
 }
 function actionName(el){return normalize([el.getAttribute('aria-label'),el.getAttribute('title'),el.textContent,...[...el.querySelectorAll('img,svg,use,[data-icon]')].flatMap(icon=>[icon.getAttribute('alt'),icon.getAttribute('aria-label'),icon.getAttribute('data-icon'),icon.getAttribute('href'),icon.getAttribute('xlink:href'),icon.getAttribute('src'),icon.getAttribute('class')])].filter(Boolean).join(' '));}
 function actionFor(root,action){
  const candidates=[...root.querySelectorAll('button,[role=button],a,[tabindex],svg,img,[onclick]')].filter(el=>visible(el)&&!el.disabled&&el.getAttribute('aria-disabled')!=='true');
  const controls=candidates.filter(el=>{
   const name=actionName(el);
   if(/delete|trash|remove|bin\b/.test(name))return false;
   return action==='edit'?/\bedit\b|pencil|pen.square|pen.to.square|icon.edit|edit[._/-]/.test(name):/^\+$|^＋$|^add$|^add new$|\badd (?:new )?(?:work|experience|education)\b|\bplus\b|icon.add|add[._/-]/.test(name);
  }).map(el=>['SVG','IMG','USE','PATH'].includes(el.tagName.toUpperCase())?el.closest('button,[role=button],a,[tabindex],[onclick]')||el:el);
  return one(controls.filter(Boolean).filter(el=>!controls.some(child=>child!==el&&el.contains(child))),action+' control');
 }
 const names={company:['company','company name','employer'],title:['job title','position','position title','job position','designation'],description:['description','job description','responsibilities','work description','education description','achievements'],institution:['school','school name','institution','university','college university'],qualification:['degree','qualification','course','major course'],start_date:['start date','from'],end_date:['end date','to'],start_year:['start year','from year'],end_year:['end year','graduation year','to year'],start_month:['start month','from month'],end_month:['end month','to month'],current:['currently working here','i currently work here','i am currently working here','i am currently employed here','current job','present']};
 const monthNames='January February March April May June July August September October November December'.split(' ');
 function optionsFor(key,value){const result=[normalize(value)];if(key.endsWith('_month')){const month=monthNames[Number(value)-1];if(month)result.push(normalize(month),normalize(month.slice(0,3)),String(Number(value)),String(value).padStart(2,'0'));}return result;}
 function fieldFor(root,key){
  const matching=[...root.querySelectorAll('input,textarea,select,[contenteditable=true],[role=combobox]')].filter(el=>visible(el)&&!el.disabled&&el.getAttribute('aria-disabled')!=='true'&&(key==='current'?el.type==='checkbox':!['file','password','hidden','checkbox','radio'].includes(el.type))&&labels(el).some(text=>names[key].includes(normalize(text))));
  return one(matching.filter(el=>!matching.some(child=>child!==el&&el.contains(child))),key+' field');
 }
 function valuesFor(entry){const values={...entry.values};for(const part of ['start','end'])if(values[part+'_date']){values[part+'_year']=values[part+'_date'].slice(0,4);values[part+'_month']=String(Number(values[part+'_date'].slice(5,7)));}return values;}
 function makePlan(entry,root){
  const values=valuesFor(entry),plan=[];
  for(const key of Object.keys(names)){
   if(values[key]==null||values[key]==='')continue;
   const el=fieldFor(root,key);if(!el)continue;
   let value=values[key],action='fill';
   if(key==='current')action='check';
   else if(el.getAttribute('role')==='combobox')action='combo';
   else if(el.tagName==='SELECT'){
    const choices=[...el.options].filter(option=>!option.disabled&&(optionsFor(key,value).includes(normalize(option.value))||optionsFor(key,value).includes(normalize(option.textContent))));
    const option=one(choices,key+' option');if(!option)throw Error('No exact '+key+' option. Copy editor controls (JSON).');value=option.value;
   }else if(el.isContentEditable)action='editable';
   else if(el.readOnly)continue;
   else if(key.endsWith('_date')&&el.type!=='month'){
    if(el.type==='text'&&/^(YYYY-MM|YYYY\/MM)$/i.test(el.placeholder))value=el.placeholder.includes('/')?value.replace('-','/'):value;
    else if(el.type==='text'&&/^(MM\/YYYY|MM-YYYY)$/i.test(el.placeholder))value=value.slice(5,7)+el.placeholder[2]+value.slice(0,4);
    else continue; // The resume has no day; never invent a full calendar date.
   }
   if(el.maxLength>0&&String(value).length>el.maxLength)throw Error(key+' exceeds Bossjob’s '+el.maxLength+'-character limit. Full resume text was not truncated or saved.');
   plan.push({el,key,value,action});
  }
  const keys=new Set(plan.map(step=>step.key));
  const required=entry.kind==='work'?['company','title','description','start_date',entry.values.current?'current':'end_date']:['institution','qualification','start_year','end_year'];
  const missing=required.filter(key=>!keys.has(key)&&!(key.endsWith('_date')&&keys.has(key.replace('_date','_year'))&&keys.has(key.replace('_date','_month'))));
  if(entry.kind==='education'&&values.description&&!keys.has('description'))missing.push('description');
  if(missing.length)throw Error('Unmapped fields: '+missing.join(', ')+'. Open this editor and use Copy editor controls (JSON). Nothing saved.');
  if(new Set(plan.map(step=>step.el)).size!==plan.length)throw Error('One control matches multiple fields. Nothing saved.');
  return plan;
 }
 function setNative(el,value){const prototype=el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:el.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(prototype,'value').set.call(el,String(value));el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));el.dispatchEvent(new Event('blur',{bubbles:true}));}
 async function applyPlan(plan){
  for(const {el,key,value,action} of plan){
   check();if(!el.isConnected)throw Error('Editor changed while filling. Retry with the current editor.');
   if(action==='check'){if(el.checked!==Boolean(value))el.click();}
   else if(action==='editable'){el.focus();el.textContent=String(value);el.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:String(value)}));el.dispatchEvent(new Event('change',{bubbles:true}));}
   else if(action==='combo'){
    el.click();
    const option=await waitFor(()=>{
     const ids=(el.getAttribute('aria-controls')||el.getAttribute('aria-owns')||'').split(/\s+/).filter(Boolean);
     const linked=ids.map(id=>document.getElementById(id)).filter(Boolean);
     const list=one(linked.length?linked:[...document.querySelectorAll('[role=listbox]')].filter(visible),'dropdown');if(!list)return null;
     return one([...list.querySelectorAll('[role=option]')].filter(option=>visible(option)&&option.getAttribute('aria-disabled')!=='true'&&optionsFor(key,value).includes(normalize(option.textContent))),'exact '+key+' option');
    },key+' dropdown option');option.click();
   }else setNative(el,value);
   await new Promise(resolve=>setTimeout(resolve,0));
  }
 }
 const errors=root=>[...root.querySelectorAll('[aria-invalid=true],[role=alert],.ant-form-item-explain-error')].filter(el=>visible(el)&&(el.getAttribute('aria-invalid')==='true'||el.textContent.trim()));
 function saveFor(root){return one([...root.querySelectorAll('button,[role=button],input[type=submit]')].filter(el=>visible(el)&&!el.disabled&&el.getAttribute('aria-disabled')!=='true'&&['save','save changes','save experience','save education','add experience','add education'].includes(normalize(el.getAttribute('aria-label')||el.textContent||el.value))),'Save button');}
 function saved(entry,section){
  const record=recordFor(entry,section);if(!record||!fold(record.textContent).includes(fold(entry.values.description)))return false;
  const short=[...record.querySelectorAll('p,span,div,time')].filter(el=>visible(el)&&el.textContent.trim().length<150).map(el=>el.textContent).join(' ');
  if(entry.kind==='education')return [entry.values.start_year,entry.values.end_year].every(year=>new RegExp('\\b'+year+'\\b').test(short));
  const datePresent=date=>{if(!date)return false;const [year,month]=date.split('-'),name=monthNames[Number(month)-1];return new RegExp('\\b(?:'+name+'|'+name.slice(0,3)+')\\.?\\s*'+year+'\\b|\\b'+year+'[-/]0?'+Number(month)+'\\b','i').test(short);};
  return datePresent(entry.values.start_date)&&(entry.values.current?/\bpresent\b|\bcurrent\b/i.test(short):datePresent(entry.values.end_date));
 }
 function capturePicker(){
  if(!pending||pending.root)throw Error('The sequence must first pause at an entry’s Edit or + control.');
  if(pickHandler)document.removeEventListener('click',pickHandler,true);
  report('Click the real '+(pending.record?'Edit':' +')+' control for '+pending.entry.label+'. The helper will inspect its editor.');
  pickHandler=event=>{
   if(panel.contains(event.target))return;
   const scope=pending.record||pending.section;
   if(!scope.contains(event.target)){report('Choose the control inside the current entry or section.');return;}
   const clicked=event.target.closest('button,[role=button],a,[tabindex],[onclick]')||event.target;
   if(/delete|trash|remove|bin\b/.test(actionName(clicked))){event.preventDefault();event.stopImmediatePropagation();report('Delete is not an Edit or + control.');return;}
   document.removeEventListener('click',pickHandler,true);pickHandler=null;pick.hidden=true;
   waitFor(editor,'the selected editor').then(root=>{pending.root=root;run();}).catch(error=>report(error.message));
  };
  document.addEventListener('click',pickHandler,true);
 }
 pick.onclick=()=>{try{guard();stopped=false;capturePicker();}catch(error){report(error.message);}};
 async function openTask(entry,index){
  if(editor())throw Error('Save or close the open editor before starting the sync.');
  const section=sectionFor(entry),record=recordFor(entry,section);
  if(record&&saved(entry,section))return {skip:true,section,record};
  // If parsing changed a title/school, avoid adding a second copy of that account entry.
  const employer=entry.kind==='work'?entry.values.company:entry.values.institution;
  if(!record&&possiblePartial(entry,section))throw Error('A possibly incomplete '+employer+' entry already exists. Open its Edit control, choose the matching resume entry, and use Fill open editor; a duplicate was not added.');
  pending={entry,index,section,record,root:null,saveClicked:false};
  const button=actionFor(record||section,record?'edit':'add');
  if(!button){pick.hidden=false;throw Error('Paused: this '+(record?'Edit':' +')+' icon has no identifiable label. Click Choose this entry’s Edit / +, then click its real icon.');}
  check();button.scrollIntoView({block:'center'});button.click();pending.root=await waitFor(editor,'the '+entry.kind+' editor');return pending;
 }
 async function run(){
  if(running)return;stopped=false;running=true;panel.dataset.running='true';sync.disabled=true;stop.disabled=false;select.disabled=true;oldFill.disabled=true;context.upload.disabled=true;
  try{
   while(at<tasks.length){
    check();const {entry,index}=tasks[at];select.value=String(index);refresh();rows[at].textContent='In progress: '+entry.label;
    if(pending&&pending.index===index){
     const section=sectionFor(entry);
     if(!editor()&&saved(entry,section)){rows[at].textContent='Saved: '+entry.label;pending=null;at++;continue;}
     if(pending.saveClicked)throw Error('Previous Save is not confirmed. No second Save was clicked. Check this entry in Bossjob.');
     if(pending.root&&!pending.root.isConnected){pending=null;continue;}
     if(!pending.root){pick.hidden=false;throw Error('Click Choose this entry’s Edit / +, then click its real icon.');}
    }else{
     const opened=await openTask(entry,index);
     if(opened.skip){rows[at].textContent='Already complete: '+entry.label;at++;continue;}
    }
    report((at+1)+'/'+tasks.length+': correcting '+entry.label);
    const current=fieldFor(pending.root,'current');
    if(entry.kind==='work'&&current&&current.checked!==Boolean(entry.values.current)){current.click();await new Promise(resolve=>setTimeout(resolve,0));}
    const plan=makePlan(entry,pending.root);
    if(!saveFor(pending.root))throw Error('No verified Save button. Copy editor controls (JSON). Nothing saved.');
    await applyPlan(plan);
    if(errors(pending.root).length)throw Error('Bossjob reports invalid fields. Correct them before retrying.');
    const required=[...pending.root.querySelectorAll('input,textarea,select,[role=combobox]')].filter(el=>visible(el)&&!el.disabled&&(el.required||el.getAttribute('aria-required')==='true')&&(el.type==='checkbox'?!el.checked:!(el.value||el.textContent.trim())));
    if(required.length)throw Error('Required fields need input: '+required.map(el=>label(el)||el.type).join(', ')+'. Nothing saved.');
    const save=await waitFor(()=>saveFor(pending.root),'the enabled Save button');check();pending.saveClicked=true;save.click();
    await waitFor(()=>{if(errors(pending.root).length){pending.saveClicked=false;throw Error('Bossjob rejected this entry. Review the highlighted fields.');}if(pending.root.isConnected&&visible(pending.root))return false;return saved(entry,sectionFor(entry));},'the complete description and dates appearing after Save');
    rows[at].textContent='Saved: '+entry.label;pending=null;at++;
   }
   report('Work and education sync completed: '+tasks.length+' entries verified with their full descriptions.');sync.textContent='Sync complete';
  }catch(error){report(error.message);sync.textContent='Retry remaining';}
  finally{running=false;panel.dataset.running='false';sync.disabled=false;stop.disabled=true;select.disabled=false;oldFill.disabled=false;context.upload.disabled=false;}
 }
 stop.onclick=()=>{stopped=true;if(pickHandler){document.removeEventListener('click',pickHandler,true);pickHandler=null;}report('Stopping. Any open editor will be left for you to review.');};
 context.close.addEventListener('click',()=>{stopped=true;if(pickHandler)document.removeEventListener('click',pickHandler,true);});
 panel.addEventListener('bossjob-dispose',()=>{stopped=true;if(pickHandler)document.removeEventListener('click',pickHandler,true);});
 sync.onclick=run;
 if(payload.auto_sync)setTimeout(run,0);
 return {run};
}
module.exports={installBossjobWorkflow};
