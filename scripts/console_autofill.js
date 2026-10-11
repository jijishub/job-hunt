/**
 * 🌸 Job Hunt: ByteDance 1-Click Form Autofill (Browser Console / Tampermonkey)
 * Run this snippet directly in the Developer Tools Console (F12) on:
 * https://jobs.bytedance.com/en/resume/7670342986024831285/apply
 */
(function() {
  const DATA = {
    name: "Jizelle D. Casia",
    email: "jizelle.casia@gmail.com",
    mobile: "09603899736",
    location: "Philippines",
    selfIntro: `I am a recent Information Technology graduate (Cum Laude) with a unique blend of technical execution and commercial acumen. My background spans both enterprise engineering—where I led project-based AI deployments at GDS Capital that reduced operational costs by 60%—and entrepreneurial e-commerce, having founded and scaled a digital product business (Cloudji) to over 15,000 downloads and 6,500+ followers in the creator economy. I am passionate about bridging the gap between complex technology and tangible business growth. Having worked as a client-facing Forward-Deployed Engineer, I thrive in fast-paced, dynamic environments that demand adaptability, analytical problem-solving, and cross-functional collaboration across international markets. I am eager to leverage my experience in project management, process automation, and creator engagement to build scalable playbooks, solve complex platform challenges, and drive high-impact commercial outcomes in the digital tech and e-commerce space.`,
    linkedin: "https://www.linkedin.com/in/jizelle-casia",
    portfolio: "https://www.jizellecasia.site/",
    github: "https://github.com/jijishub"
  };

  const setNativeValue = (element, value) => {
    const valueSetter = Object.getOwnPropertyDescriptor(element.__proto__, 'value') || 
                        Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value') ||
                        Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value');
    if (valueSetter && valueSetter.set) {
      valueSetter.set.call(element, value);
    } else {
      element.value = value;
    }
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    element.dispatchEvent(new Event('blur', { bubbles: true }));
  };

  const inputs = Array.from(document.querySelectorAll('input:not([type="hidden"]):not([type="file"])'));
  const textareas = Array.from(document.querySelectorAll('textarea'));

  function fillMatchingInput(matchers, value) {
    for (const input of inputs) {
      const ph = (input.getAttribute('placeholder') || '').toLowerCase();
      const nm = (input.getAttribute('name') || '').toLowerCase();
      const id = (input.getAttribute('id') || '').toLowerCase();
      const aria = (input.getAttribute('aria-label') || '').toLowerCase();
      
      let labelText = '';
      const parent = input.closest('.semi-form-field, .bytedance-form-item, label, .field-wrapper') || input.parentElement;
      if (parent) labelText = (parent.innerText || '').toLowerCase();

      const fullContext = `${ph} ${nm} ${id} ${aria} ${labelText}`;
      if (matchers.some(m => fullContext.includes(m.toLowerCase()))) {
        setNativeValue(input, value);
        console.log(`[RPA] Filled input (${matchers[0]}):`, value);
        return true;
      }
    }
    return false;
  }

  fillMatchingInput(['name', 'full name', 'candidate name'], DATA.name);
  fillMatchingInput(['email'], DATA.email);
  fillMatchingInput(['phone', 'mobile', 'cellphone'], DATA.mobile);
  fillMatchingInput(['location', 'city', 'country'], DATA.location);

  for (const ta of textareas) {
    const ph = (ta.getAttribute('placeholder') || '').toLowerCase();
    const parent = ta.closest('.semi-form-field, label, .field-wrapper') || ta.parentElement;
    const ctx = `${ph} ${(parent ? parent.innerText : '')}`.toLowerCase();
    if (ctx.includes('self') || ctx.includes('intro') || ctx.includes('summary') || ctx.includes('about') || ctx.includes('cover') || textareas.length === 1) {
      setNativeValue(ta, DATA.selfIntro);
      console.log('[RPA] Filled self-introduction textarea');
    }
  }

  // Floating helper HUD
  if (!document.getElementById('rpa-jobhunt-hud')) {
    const hud = document.createElement('div');
    hud.id = 'rpa-jobhunt-hud';
    hud.style.cssText = 'position:fixed;top:20px;right:20px;z-index:9999999;background:#FFF0F6;border:2px solid #FF7AB3;border-radius:14px;box-shadow:0 10px 25px rgba(255,122,179,0.4);padding:16px 20px;font-family:sans-serif;max-width:360px;';
    hud.innerHTML = `
      <div style="font-weight:bold;color:#9D3C5E;margin-bottom:8px;font-size:14px;">🌸 RPA Autofill Active</div>
      <div style="font-size:12px;color:#333;margin-bottom:8px;">✅ Basic info & intro filled for <b>${DATA.name}</b></div>
      <button onclick="navigator.clipboard.writeText('${DATA.selfIntro.replace(/'/g, "\\'")}'); alert('Intro copied!');" style="background:#FF7AB3;color:white;border:none;padding:6px 12px;border-radius:6px;cursor:pointer;font-size:12px;margin-right:6px;">📋 Copy Intro</button>
      <button onclick="document.getElementById('rpa-jobhunt-hud').remove()" style="background:#eee;border:none;padding:6px 10px;border-radius:6px;cursor:pointer;font-size:12px;">Close</button>
    `;
    document.body.appendChild(hud);
  }

  console.log('✅ [RPA] ByteDance Autofill completed successfully!');
})();
