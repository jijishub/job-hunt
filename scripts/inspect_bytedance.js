const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');

async function inspectPage() {
  const userDataDir = path.resolve(__dirname, '../.data/rpa-profile');
  const context = await chromium.launchPersistentContext(userDataDir, {
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: false,
    viewport: null,
    args: ['--start-maximized']
  });

  const page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();
  const targetUrl = 'https://jobs.bytedance.com/en/resume/7670342986024831285/apply';
  
  console.log('Navigating to:', targetUrl);
  await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 60000 }).catch(e => console.log('goto error or timeout:', e.message));
  
  console.log('Waiting 10s for dynamic elements...');
  await page.waitForTimeout(10000);
  
  console.log('Final URL:', page.url());
  console.log('Title:', await page.title());

  const info = await page.evaluate(() => {
    return {
      inputs: Array.from(document.querySelectorAll('input')).map(i => ({
        type: i.type,
        placeholder: i.placeholder,
        name: i.name,
        id: i.id,
        className: i.className
      })),
      buttons: Array.from(document.querySelectorAll('button')).map(b => b.innerText.trim()).filter(Boolean),
      textareas: Array.from(document.querySelectorAll('textarea')).map(t => ({
        placeholder: t.placeholder,
        id: t.id,
        className: t.className
      })),
      textSnippet: document.body.innerText.slice(0, 1000)
    };
  });

  console.log('Found Inputs:', JSON.stringify(info.inputs, null, 2));
  console.log('Found Buttons:', info.buttons);
  console.log('Found Textareas:', info.textareas);
  console.log('Page Text Snippet:\n', info.textSnippet);

  await page.screenshot({ path: path.resolve(__dirname, '../.data/current_page.png') });
  await context.close();
}

inspectPage().catch(console.error);
