import type { getDatabaseClient } from './database';
export async function migrateExtensionCredentialExpiry(sql: NonNullable<ReturnType<typeof getDatabaseClient>>) {
  await sql.transaction([
    sql`ALTER TABLE extension_credentials ALTER COLUMN expires_at DROP NOT NULL;`,
    // Preserve working pairings without reviving expired or revoked credentials.
    sql`UPDATE extension_credentials SET expires_at=NULL WHERE revoked_at IS NULL AND expires_at>NOW();`,
  ]);
}

export async function migrateCaptureSchema(sql: NonNullable<ReturnType<typeof getDatabaseClient>>) {
  await sql`CREATE TABLE IF NOT EXISTS extension_credentials (
    id TEXT PRIMARY KEY, owner TEXT NOT NULL, label TEXT NOT NULL, token_hash TEXT NOT NULL UNIQUE,
    scopes JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL, expires_at TIMESTAMPTZ, revoked_at TIMESTAMPTZ
  );`;
  await migrateExtensionCredentialExpiry(sql);
  await sql`CREATE INDEX IF NOT EXISTS extension_credentials_owner ON extension_credentials(owner);`;
  await sql`CREATE TABLE IF NOT EXISTS posting_captures (
    owner TEXT NOT NULL, capture_id TEXT NOT NULL, request_hash TEXT NOT NULL, identity_key TEXT NOT NULL,
    application_id TEXT, payload JSONB NOT NULL, receipt JSONB NOT NULL, review_hash TEXT,
    reviewed_by TEXT, reviewed_received_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY(owner,capture_id)
  );`;
  // Capture rows remain after application deletion: identity and request receipts
  // are tombstones as well as the immutable source/review audit trail.
  await sql`CREATE INDEX IF NOT EXISTS posting_captures_identity ON posting_captures(owner,identity_key);`;
}
