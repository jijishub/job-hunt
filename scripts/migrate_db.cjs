/* eslint-disable @typescript-eslint/no-require-imports -- Node CommonJS migration entrypoint. */
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const { loadEnvConfig } = require('@next/env');

const root = path.resolve(__dirname, '..');
const cache = new Map();
function loadTypescript(filename) {
  if (cache.has(filename)) return cache.get(filename).exports;
  const compiled = new Module(filename, module);
  compiled.filename = filename;
  compiled.paths = Module._nodeModulePaths(path.dirname(filename));
  cache.set(filename, compiled);
  const original = compiled.require.bind(compiled);
  compiled.require = id => {
    const target = id.startsWith('.') ? path.resolve(path.dirname(filename), id) + '.ts' : null;
    return target && fs.existsSync(target) ? loadTypescript(target) : original(id);
  };
  compiled._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText, filename);
  return compiled.exports;
}

async function main() {
  loadEnvConfig(root);
  if (!process.env.POSTGRES_URL && !process.env.DATABASE_URL && process.argv.includes('--if-configured')) {
    console.log('No PostgreSQL configured; using local JSON storage.');
    return;
  }
  await loadTypescript(path.join(root, 'src/lib/db.ts')).migrateDatabase();
  console.log('Database migration completed.');
}

if (require.main === module) main().catch(() => {
  console.error('Database migration failed; build stopped. Check database configuration and migration logs.');
  process.exitCode = 1;
});
module.exports = { main, loadTypescript };
