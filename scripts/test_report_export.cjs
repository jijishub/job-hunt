const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { chromium } = require('playwright-core');
const root = path.join(__dirname, '..');
function compile(file) {
  return ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React,
      esModuleInterop: true, target: ts.ScriptTarget.ES2020 },
  }).outputText;
}
const reportModule = { exports: {} };
vm.runInNewContext(compile('src/components/ATSExportReport.tsx'), {
  exports: reportModule.exports, module: reportModule,
  require: (name) => name === 'next/image'
    ? (props) => React.createElement('img', { width: props.width, height: props.height, alt: props.alt })
    : require(name),
});
const Report = reportModule.exports.default;
const result = {
  matchScore: 78, matchTier: 'Strong Match', modelUsed: 'Test',
  summary: 'A candidate with relevant experience. '.repeat(18),
  strengths: Array.from({ length: 7 }, (_, i) => `Strength ${i}: ` + 'Clear evidence of engineering delivery. '.repeat(7)),
  gaps: Array.from({ length: 5 }, (_, i) => `Gap ${i}: ` + 'Add more measurable examples. '.repeat(7)),
  matchingSkills: Array.from({ length: 20 }, (_, i) => `Matched skill ${i}`),
  missingKeywords: Array.from({ length: 15 }, (_, i) => `Missing keyword ${i}`),
  bulletRewrites: Array.from({ length: 8 }, () => ({ original: 'Original experience. '.repeat(12),
    improved: 'Delivered measurable improvements. '.repeat(12), reason: 'Improves specificity. '.repeat(8) })),
  tailoredPitch: 'I am interested in this opportunity. '.repeat(70),
};
function cssFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? cssFiles(file) : file.endsWith('.css') ? [file] : [];
  });
}
async function run() {
  const browser = await chromium.launch({ headless: true,
    executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  try {
    const page = await browser.newPage();
    // A stalled image elsewhere in the app must not delay report capture.
    await page.route('https://example.invalid/slow.png', () => {});
    const css = cssFiles(path.join(root, '.next/static')).map((file) => fs.readFileSync(file, 'utf8')).join('\n');
    for (const overview of [false, true]) {
      const html = renderToStaticMarkup(React.createElement(Report, { result,
        jobTitle: 'Software Engineer', companyName: 'Example Company', candidateName: 'Test Candidate',
        reportRef: { current: null }, overview }));
      await page.setContent(`<style>${css}</style>${html}<aside><img src="https://example.invalid/slow.png">${'<p>Unrelated app content</p>'.repeat(2000)}</aside>`, { waitUntil: 'domcontentloaded' });
      await page.addScriptTag({ content: compile('src/lib/report-pagination.ts').replace(
        'Object.defineProperty(exports, "__esModule", { value: true });', '')
        .replaceAll('exports.', 'window.') });
      await page.addScriptTag({ path: path.join(root, 'node_modules/html2canvas-pro/dist/html2canvas-pro.js') });
      await page.addScriptTag({ content: `window.reportCapture = (() => {
        const exports = {}; const require = () => window.html2canvas;
        ${compile('src/lib/report-capture.ts')}
        return exports;
      })();` });
      const metrics = await page.evaluate(async (overview) => {
        const report = document.querySelector('div > div');
        const cuts = window.getReportPageCuts(report, report.offsetWidth * 273 / 190);
        const started = performance.now();
        const canvas = await window.reportCapture.captureReport(report);
        const blob = await window.reportCapture.encodePng(canvas);
        const elapsedMs = Math.round(performance.now() - started);
        const origin = report.getBoundingClientRect().top;
        const walker = document.createTreeWalker(report, NodeFilter.SHOW_TEXT);
        let splitLines = 0;
        while (walker.nextNode()) {
          if (!walker.currentNode.textContent.trim()) continue;
          const range = document.createRange();
          range.selectNodeContents(walker.currentNode);
          for (const rect of range.getClientRects()) {
            if (cuts.slice(1, -1).some((cut) => rect.top - origin < cut && rect.bottom - origin > cut)) splitLines++;
          }
        }
        return { overview, width: canvas.width, height: canvas.height, cuts,
          splitLines, elapsedMs, blobBytes: blob.size, contentHeight: report.scrollHeight,
          containsPitch: report.textContent.includes('TAILORED APPLICATION PITCH') };
      }, overview);
      assert.equal(metrics.width, 1588);
      assert.ok(metrics.elapsedMs < 5000, 'Capture must not wait for unrelated images');
      assert.ok(metrics.blobBytes > 0);
      assert.equal(metrics.splitLines, 0);
      assert.equal(metrics.containsPitch, !overview);
      if (overview) assert.equal(metrics.height, 2246);
      else assert.ok(metrics.cuts.length > 3, 'Long report must span multiple A4 pages');
      console.log(JSON.stringify(metrics));
    }
  } finally { await browser.close(); }
}
run().catch((error) => { console.error(error); process.exitCode = 1; });
