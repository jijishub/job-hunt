import { readPrivateRpaProfile } from '@/lib/rpa-profile';
import { getSessionAccount } from '@/lib/session-account';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const user = await getSessionAccount();
  if (!user) return NextResponse.json({ success: false, error: 'Sign in required.' }, { status: 401 });
  if (user.role !== 'admin') return NextResponse.json({ success: false, error: 'Admin access required.' }, { status: 403 });
  const { searchParams } = new URL(request.url);
  const platform = searchParams.get('platform') || 'bytedance';

  const resumeData = await readPrivateRpaProfile();
  if (!resumeData) return NextResponse.json({ success: false, error: 'Configure a private RPA profile before using this helper.' }, { status: 422 });

  const bookmarkletCode = `javascript:(function(){const d=${JSON.stringify(resumeData.basic_information)};const intro=${JSON.stringify(resumeData.self_introduction)};const setV=(el,val)=>{const p=el.tagName==='TEXTAREA'?window.HTMLTextAreaElement.prototype:window.HTMLInputElement.prototype;const s=Object.getOwnPropertyDescriptor(p,'value')?.set||Object.getOwnPropertyDescriptor(el.__proto__,'value')?.set;if(s){s.call(el,val);}else{el.value=val;}el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));el.dispatchEvent(new Event('blur',{bubbles:true}));};Array.from(document.querySelectorAll('input:not([type="hidden"]):not([type="file"])')).forEach(i=>{const c=(i.placeholder+' '+i.name+' '+i.id).toLowerCase();if(c.includes('name'))setV(i,d.name);else if(c.includes('mail'))setV(i,d.email);else if(c.includes('phone')||c.includes('mobile'))setV(i,d.mobile);else if(c.includes('loc')||c.includes('country')||c.includes('city'))setV(i,d.preferred_work_location);});Array.from(document.querySelectorAll('textarea')).forEach(t=>setV(t,intro));alert('🌸 ByteDance RPA Autofill Complete!');})();`;

  return NextResponse.json({
    platform,
    data: resumeData,
    bookmarklet: bookmarkletCode,
    local_command: "npm run rpa:bytedance"
  }, { headers: { 'Cache-Control': 'private, no-store' } });
}
