const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');

const DATA = require('./resume_data.json');
const RESUME_PDF = path.resolve(__dirname, '..', DATA.resume_pdf_path);

async function runByteDanceRPA() {
  console.log('========================================================');
  console.log('🌸 ByteDance Job Application RPA Assistant');
  console.log('Applicant: ' + DATA.basic_information.name);
  console.log('Target Job: https://jobs.bytedance.com/en/resume/7670342986024831285/apply');
  console.log('Resume PDF: ' + RESUME_PDF);
  console.log('========================================================\n');

  const userDataDir = path.resolve(__dirname, '../.data/rpa-profile');
  if (!fs.existsSync(userDataDir)) {
    fs.mkdirSync(userDataDir, { recursive: true });
  }

  console.log('🚀 [1/4] Launching Google Chrome...');
  const context = await chromium.launchPersistentContext(userDataDir, {
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: false,
    viewport: null,
    args: ['--start-maximized', '--disable-blink-features=AutomationControlled']
  });

  const page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();
  const targetUrl = 'https://jobs.bytedance.com/en/resume/7670342986024831285/apply';

  console.log('🌐 [2/4] Navigating to ByteDance application page...');
  await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 90000 });

  // Handle Login Check
  if (page.url().includes('/login')) {
    console.log('\n--------------------------------------------------------');
    console.log('🔒 ACTION REQUIRED: Please sign in to ByteDance.');
    console.log('👉 Complete your sign-in in the Chrome window.');
    console.log('⏳ RPA is waiting and will automatically proceed once you log in...');
    console.log('--------------------------------------------------------\n');

    // Inject temporary helper on login page
    try {
      await page.evaluate(() => {
        const div = document.createElement('div');
        div.id = 'rpa-login-banner';
        div.style.cssText = 'position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:9999999;background:#FFF0F6;border:2px solid #FF7AB3;color:#9D3C5E;padding:12px 24px;border-radius:12px;font-weight:bold;font-size:14px;box-shadow:0 4px 20px rgba(255,122,179,0.3);';
        div.innerHTML = '🌸 <b>Job Hunt RPA:</b> Please sign in below. The assistant will auto-fill your resume once logged in!';
        document.body.appendChild(div);
      });
    } catch {}

    // Wait for user to finish login
    while (page.url().includes('/login')) {
      await page.waitForTimeout(1500);
      if (page.isClosed()) {
        console.log('Browser was closed.');
        return;
      }
    }
  }

  console.log('\n🎉 Logged in! Loading application form...');
  
  // Ensure we are on the target apply URL
  if (!page.url().includes('/apply')) {
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
  }

  // Wait for application form elements to appear
  console.log('⏳ Waiting for application form fields to render...');
  await page.waitForTimeout(5000);

  // Step 3: Upload Resume PDF
  console.log('📎 [3/4] Checking resume upload...');
  if (fs.existsSync(RESUME_PDF)) {
    try {
      const fileInputs = await page.$$('input[type="file"]');
      if (fileInputs.length > 0) {
        console.log(`Found file input. Uploading ${path.basename(RESUME_PDF)}...`);
        await fileInputs[0].setInputFiles(RESUME_PDF);
        console.log('✅ Resume PDF uploaded successfully!');
        await page.waitForTimeout(5000); // Give ATS time to parse if applicable
      } else {
        console.log('ℹ️ No native input[type="file"] found yet. Resume can be uploaded manually or via click.');
      }
    } catch (e) {
      console.warn('⚠️ File upload note:', e.message);
    }
  }

  // Step 4: Inject HUD and Run Form Autofill
  console.log('✍️ [4/4] Executing Intelligent Form Autofill...');

  await page.evaluate((data) => {
    window.__BYTEDANCE_DATA__ = data;

    // Remove old HUD if any
    const oldHud = document.getElementById('rpa-jobhunt-hud');
    if (oldHud) oldHud.remove();

    const hud = document.createElement('div');
    hud.id = 'rpa-jobhunt-hud';
    hud.style.cssText = `
      position: fixed;
      top: 16px;
      right: 16px;
      z-index: 99999999;
      background: linear-gradient(135deg, #FFF0F6 0%, #FFFFFF 100%);
      border: 2px solid #FF7AB3;
      border-radius: 16px;
      box-shadow: 0 12px 35px rgba(255, 122, 179, 0.4);
      padding: 18px 22px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      color: #333;
      max-width: 400px;
      backdrop-filter: blur(8px);
    `;

    hud.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
        <div style="font-weight:700;font-size:15px;color:#9D3C5E;display:flex;align-items:center;gap:6px;">
          <span>🌸</span> <span>Job Hunt RPA Assistant</span>
        </div>
        <span style="font-size:11px;background:#FFE4E6;color:#BE185D;padding:2px 8px;border-radius:12px;font-weight:600;">Ready</span>
      </div>
      <p style="font-size:12px;color:#4B5563;margin:0 0 10px;line-height:1.4;">
        Autofilling for <b>${data.basic_information.name}</b><br/>
        <span style="color:#6B7280;font-size:11px;">${data.basic_information.email} | ${data.basic_information.mobile}</span>
      </p>
      <div id="rpa-status" style="font-size:12px;color:#059669;margin-bottom:12px;font-weight:600;">
        ⏳ Running autofill...
      </div>
      <div style="display:flex;gap:6px;margin-bottom:8px;">
        <button id="rpa-btn-autofill" style="flex:1;background:#FF7AB3;color:white;border:none;padding:8px 12px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;">
          ⚡ Fill Form Now
        </button>
        <button id="rpa-btn-intro" style="background:#F1DDE9;color:#9D3C5E;border:none;padding:8px 12px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;">
          📋 Copy Intro
        </button>
      </div>
      <div style="font-size:11px;color:#9CA3AF;text-align:center;">
        Review your fields before final submit!
      </div>
    `;

    document.body.appendChild(hud);

    function doAutofill() {
      const setNativeValue = (element, value) => {
        const proto = element.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
        const valueSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set ||
                            Object.getOwnPropertyDescriptor(element.__proto__, 'value')?.set;
        if (valueSetter) {
          valueSetter.call(element, value);
        } else {
          element.value = value;
        }
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
        element.dispatchEvent(new Event('blur', { bubbles: true }));
      };

      const allInputs = Array.from(document.querySelectorAll('input:not([type="hidden"]):not([type="file"]):not([type="checkbox"]):not([type="radio"])'));
      const allTextareas = Array.from(document.querySelectorAll('textarea'));
      let filledCount = 0;

      function matchAndFill(matchers, val) {
        for (const inp of allInputs) {
          const ph = (inp.placeholder || '').toLowerCase();
          const nm = (inp.name || '').toLowerCase();
          const id = (inp.id || '').toLowerCase();
          const aria = (inp.getAttribute('aria-label') || '').toLowerCase();
          const parent = inp.closest('.semi-form-field, .atsx-form-item, .field-wrapper, label, [class*="form-item"]') || inp.parentElement;
          const label = (parent ? parent.innerText : '').toLowerCase();
          const combined = `${ph} ${nm} ${id} ${aria} ${label}`;

          if (matchers.some(m => combined.includes(m.toLowerCase()))) {
            setNativeValue(inp, val);
            filledCount++;
            return true;
          }
        }
        return false;
      }

      matchAndFill(['name', 'full name', 'candidate name'], data.basic_information.name);
      matchAndFill(['email'], data.basic_information.email);
      matchAndFill(['phone', 'mobile', 'tel'], data.basic_information.mobile);
      matchAndFill(['location', 'city', 'country'], data.basic_information.preferred_work_location);

      for (const ta of allTextareas) {
        setNativeValue(ta, data.self_introduction);
        filledCount++;
      }

      const st = document.getElementById('rpa-status');
      if (st) {
        st.innerText = `✅ Filled ${filledCount} field(s)!`;
        st.style.color = '#059669';
      }
    }

    document.getElementById('rpa-btn-autofill').onclick = doAutofill;
    document.getElementById('rpa-btn-intro').onclick = () => {
      navigator.clipboard.writeText(data.self_introduction);
      const st = document.getElementById('rpa-status');
      st.innerText = '📋 Self-intro copied to clipboard!';
      st.style.color = '#BE185D';
    };

    // Auto-run once
    doAutofill();
  }, DATA);

  console.log('\n========================================================');
  console.log('🎉 RPA Autofill sequence initialized successfully!');
  console.log('👉 Chrome is active on your screen.');
  console.log('👉 Review your details and hit submit whenever you are ready!');
  console.log('========================================================\n');

  // Keep script waiting until user closes Chrome
  await new Promise((resolve) => {
    context.on('close', resolve);
    page.on('close', resolve);
  });

  console.log('Browser closed. RPA session ended.');
}

if (require.main === module) {
  runByteDanceRPA().catch(console.error);
}

module.exports = { runByteDanceRPA };
