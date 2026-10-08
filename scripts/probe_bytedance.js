const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');

async function probe() {
  const userDataDir = path.resolve(__dirname, '../.data/rpa-profile');
  if (!fs.existsSync(userDataDir)) {
    fs.mkdirSync(userDataDir, { recursive: true });
  }

  console.log('Launching browser with persistent context...');
  const context = await chromium.launchPersistentContext(userDataDir, {
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: false,
    viewport: null,
    args: ['--start-maximized']
  });

  const page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();
  const targetUrl = 'https://jobs.bytedance.com/en/resume/7670342986024831285/apply';
  
  console.log('Navigating to:', targetUrl);
  await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
  
  console.log('Waiting 5s for page to settle...');
  await page.waitForTimeout(5000);
  
  console.log('Current URL:', page.url());
  console.log('Page Title:', await page.title());

  // Check if login dialog or form is present
  const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 500));
  console.log('Page preview snippet:\n', bodyText);

  // Take screenshot for diagnosis
  const screenshotPath = path.resolve(__dirname, '../.data/probe_screenshot.png');
  await page.screenshot({ path: screenshotPath });
  console.log('Screenshot saved to:', screenshotPath);

  // Keep open for 20 seconds so we can observe
  await page.waitForTimeout(15000);
  await context.close();
}

probe().catch(err => {
  console.error('Error in probe:', err);
  process.exit(1);
});
