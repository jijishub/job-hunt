const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');
const { chromium } = require('playwright-core');
const dir = path.join(__dirname, '../.data');
const companies = JSON.parse(fs.readFileSync(path.join(dir, 'company-logos-backup-1791574280888.json')));
const candidates = JSON.parse(fs.readFileSync(path.join(dir, 'company-logo-candidates.json')));
const sources = [
  ['1902 Software Development Corporation', 'https://1902software.com/wp-content/uploads/2025/10/logo_dark_full-1.svg'],
  ['ABSI', 'https://absi.ph/wp-content/uploads/2022/06/absi-logo-about-1024x371.png'],
  ['AIA Philippines', 'https://www.bworldonline.com/wp-content/uploads/2022/07/AIA-Philippines-Logo-white-2.jpeg'],
  ['Aboitiz Foods', 'https://www.aboitizfoods.com/wp-content/uploads/2024/06/Aboitiz-logo-full.svg'],
  ['Absolute Industrial Solutions, Inc.', 'https://absoluteindustrial.solutions/wp-content/uploads/2021/01/aisi-logo.png'],
  ['ByteDance', 'https://upload.wikimedia.org/wikipedia/commons/a/ad/ByteDance_logo.png'],
  ['Cebu Pacific', 'https://statics.travelx.io/tenants/cebu/assets/images/favicon.png'],
  ['Challenge Systems Inc.', 'https://static.wixstatic.com/media/cef350_8db1b4fcd63043be883415003af36382~mv2.png'],
  ['Crowdsource Solutions Incorporated', 'https://crowdsourcesolutions.ph/wp-content/uploads/2024/11/crowdsource-solutions-inc.-logo-h-1.png'],
  ['DB Schenker', 'https://cdn.prgloo.com/media/download/8c592ae6c67d4b2080234a6c7b889e58'],
  ['Duty Free', 'https://shop.dutyfree.gov.ph/favicon.ico'],
  ['E-Konek Solutions', 'https://www.ekonek.com/assets/images/e-Konek-23-Years-Logo.png'],
  ['Endsofttech Web Solutions', 'https://endsofttech.com/favicon_io/apple-touch-icon.png'],
  ['Equitable Computer Services, Inc.', 'https://www.equicom.com/assets/logo-CEpf4vdL.jpg'],
  ['GenuineXs', 'https://cdn.prod.website-files.com/63a5aeb96ccbdb14526058ae/63a5e5a10f3ddd99e289dc5d_Outlined_Source_Logo_GenuineXs-02.png'],
  ['Icon Equipment Solutions Philippines Inc', 'https://iconjcb.ph/favicon.ico'],
  ['LP City Hall', 'https://laspinascity.gov.ph/guest/img/ftr-logo-new.png'],
  ['Megaworld Corporation', 'https://www.megaworldcorp.com/images/navigation/Meg_Logo%20June2019.png'],
  ['Meinhardt', 'https://meinhardt.ph/wp-content/themes/meinhardt/img/logo.svg'],
  ['Moatable', 'https://www.moatable.com/wp-content/uploads/2022/06/Moatable-Logo-1.png'],
  ['OneLot Financing Corporation', 'https://www.onelot.ph/logo.png'],
  ['QT Solutions Corporation', 'https://www.qtsolutions.ph/wp-content/uploads/2023/09/274341391_100327645930396_1830197889496266560_n-removebg-preview.png'],
  ['ServiceIT+ Inc.', 'https://static.wixstatic.com/media/c2b3db_371d4a8d6c96425ca83268205bd158e3~mv2.png'],
  ['Straive', 'https://www.straive.com/wp-content/uploads/2026/07/Straive-logo-2-192x48.png'],
  ['Sumisho Motor Finance Corporation', 'https://ecpay.com.ph/sites/default/files/2024-01/SUMISHO.png'],
  ['Sunnies', 'https://cdn.shopify.com/s/files/1/0172/4383/2374/files/ss_logo_soft_black.png?v=1729045024'],
  ['Thinking Machines Data Science', 'https://thinkingmachin.es/favicon.ico'],
  ['Wilmar Edible Oils Philippines, Inc.', 'https://www.wilmar-international.com/img/favicon.ico'],
];
async function run() {
  const browser = await chromium.launch({headless:true, executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  const page = await browser.newPage({viewport:{width:1100,height:1400}});
  const plan = [];
  const failed = [];
  fs.mkdirSync(path.join(dir, 'logo-assets'), {recursive:true});
  try {
    for (let start=0; start<sources.length; start+=5) {
      await Promise.all(sources.slice(start,start+5).map(async ([name,url]) => {
        try {
          const response = await fetch(url, {signal:AbortSignal.timeout(15000),headers:{'User-Agent':'Mozilla/5.0'}});
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const bytes = Buffer.from(await response.arrayBuffer());
          let output;
          try { output = await sharp(bytes).resize({width:256,height:128,fit:'inside',withoutEnlargement:true}).webp({quality:90}).toBuffer(); }
          catch (error) {
            // Chromium decodes ICO assets which Sharp does not support.
            if (!/\.ico(?:\?|$)/i.test(url)) throw error;
            const mime = response.headers.get('content-type').split(';')[0];
            const iconPage = await browser.newPage();
            try {
              const data = await iconPage.evaluate(async src => {
                const img = new Image(); img.src=src; await img.decode();
                const canvas=document.createElement('canvas'); canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;
                canvas.getContext('2d').drawImage(img,0,0);return canvas.toDataURL('image/png').split(',')[1];
              }, `data:${mime};base64,${bytes.toString('base64')}`);
              output=await sharp(Buffer.from(data,'base64')).webp({quality:90}).toBuffer();
            } finally { await iconPage.close(); }
          }
          const company = companies.find(c=>c.name===name);
          fs.writeFileSync(path.join(dir,'logo-assets',`${company.id}.webp`),output);
          plan.push({id:company.id,name,source_url:url,source_page:candidates.find(c=>c.name===name)?.website,logo_url:`data:image/webp;base64,${output.toString('base64')}`});
          console.log(`${name}: verified (${output.length} bytes)`);
        } catch(error) { failed.push({name,url,error:error.message});console.log(`${name}: ${error.message}`); }
      }));
    }
    plan.sort((a,b)=>a.name.localeCompare(b.name));
    fs.writeFileSync(path.join(dir,'company-logo-plan.json'),JSON.stringify(plan,null,2));
    fs.writeFileSync(path.join(dir,'company-logo-failed.json'),JSON.stringify(failed,null,2));
    const escape = s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;');
    await page.setContent(`<html><body style="font:14px Arial;display:grid;grid-template-columns:repeat(4,1fr);gap:10px;background:#eee">${plan.map(p=>`<div style="background:white;padding:12px;height:140px"><img src="${p.logo_url}" style="width:230px;height:90px;object-fit:contain"><p>${escape(p.name)}</p></div>`).join('')}</body></html>`);
    await page.evaluate(()=>Promise.all([...document.images].map(img=>img.decode())));
    await page.screenshot({path:path.join(dir,'company-logo-review.png'),fullPage:true});
    console.log(`Ready: ${plan.length}, unavailable: ${failed.length}`);
  } finally { await browser.close(); }
}
run().catch(e=>{console.error(e);process.exitCode=1;});
