const path = require('node:path');
const { loadEnvConfig } = require('@next/env');
const { loadTypescript } = require('./migrate_db.cjs');

async function main() {
  const root = path.resolve(__dirname, '..');
  loadEnvConfig(root);
  const database = loadTypescript(path.join(root, 'src/lib/database.ts'));
  try {
    const sql = database.getDatabaseClient();
    if (!sql) throw new Error('A database connection is required.');
    const { migrateExtensionCredentialExpiry } = loadTypescript(path.join(root, 'src/lib/capture-schema.ts'));
    await migrateExtensionCredentialExpiry(sql);
    const columns = await sql`SELECT is_nullable FROM information_schema.columns
      WHERE table_schema=current_schema() AND table_name='extension_credentials' AND column_name='expires_at';`;
    if (columns[0]?.is_nullable !== 'YES') throw new Error('Credential expiry is still required.');
    console.log('Credential migration completed: expiry is optional; working credentials no longer expire.');
  } finally {
    await database.closeDatabasePools();
  }
}

if (require.main === module) main().catch(() => {
  console.error('Credential migration failed. Check the configured database and credential table.');
  process.exitCode = 1;
});
module.exports = { main };
