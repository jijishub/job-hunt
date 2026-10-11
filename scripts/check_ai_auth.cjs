const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
require('@next/env').loadEnvConfig(path.join(__dirname, '..'));
const moduleObject = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/lib/ai.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, { exports: moduleObject.exports, module: moduleObject, process, fetch, console });
async function run() {
  const config = moduleObject.exports.getAIConfig();
  const raw = config.apiKey || '';
  for (const file of ['.env.local', '.env']) {
    const filename = path.join(__dirname, '..', file);
    if (!fs.existsSync(filename)) continue;
    const line = fs.readFileSync(filename, 'utf8').split(/\r?\n/).find((entry) => /^AI_API_KEY=/.test(entry));
    const value = line?.slice(line.indexOf('=') + 1).trim().replace(/^['"]|['"]$/g, '');
    console.log(JSON.stringify({ file, definesAIKey: Boolean(line), matchesEffectiveKey: value === raw }));
  }
  console.log(JSON.stringify({ endpoint: config.baseUrl,
    keySource: process.env.AI_API_KEY ? 'AI_API_KEY' : process.env.TOKEN_POOL ? 'TOKEN_POOL' : 'code fallback',
    hasOuterWhitespace: raw !== raw.trim(),
    hasWrappingQuotes: /^['"]|['"]$/.test(raw.trim()),
    multipleValues: /[\r\n,]/.test(raw) }));
  if (new URL(config.baseUrl).hostname !== 'api.jizellecasia.site') return;
  const response = await fetch(`${config.baseUrl}/models`, {
    headers: { Authorization: `Bearer ${raw}` }, signal: AbortSignal.timeout(15000),
  });
  console.log(JSON.stringify({ credentialCheckStatus: response.status }));
  const control = await fetch(`${config.baseUrl}/models`, {
    headers: { Authorization: 'Bearer diagnostic-invalid-key' }, signal: AbortSignal.timeout(15000),
  });
  console.log(JSON.stringify({ invalidKeyControlStatus: control.status }));
  // /models is public on some gateways; test the authenticated endpoint too.
  const chat = await fetch(`${config.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${raw}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: config.defaultModel, max_tokens: 1,
      messages: [{ role: 'user', content: 'Reply OK.' }] }),
    signal: AbortSignal.timeout(30000),
  });
  console.log(JSON.stringify({ authenticatedChatStatus: chat.status }));
  await chat.body?.cancel();
}
run().catch((error) => { console.error(error.message); process.exitCode = 1; });
