import { neon, type NeonQueryFunction } from '@neondatabase/serverless';
import { createHash } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';

type Query = { strings: TemplateStringsArray; values: unknown[] };
type Metric = { event: 'database_query'; provider: string; fingerprint: string; durationMs: number; rows: number; resultJsonBytes: number; success: boolean };
export function resultJsonBytes(value: unknown) { return Buffer.byteLength(JSON.stringify(value) ?? '', 'utf8'); }
export function queryFingerprint(text: string) { return createHash('sha256').update(text.replace(/\s+/g, ' ').trim()).digest('hex').slice(0, 16); }
function emit(metric: Metric) {
  if (process.env.DB_METRICS === '1') console.info(JSON.stringify({ ...metric, at: new Date().toISOString() }));
}
const pools = new Map<string, Pool>();
// No automatic retries or provider switching: an interrupted write may already
// have committed. Switching requires an independently verified recovery process.
export function createDatabaseClient(connectionString: string, provider = process.env.DB_DRIVER || 'neon'): NeonQueryFunction<false, false> {
  if (!['neon', 'postgres'].includes(provider)) throw new Error('DB_DRIVER must be neon or postgres.');
  const native = provider === 'neon' ? neon(connectionString) : null;
  async function pool() {
    let value = pools.get(connectionString);
    if (!value) {
      const max = Number(process.env.DB_POOL_MAX || 3);
      if (!Number.isSafeInteger(max) || max < 1 || max > 20) throw new Error('DB_POOL_MAX must be an integer between 1 and 20.');
      const { Pool } = await import('pg');
      value = new Pool({ connectionString, max, idleTimeoutMillis: 10000, connectionTimeoutMillis: 10000 });
      // Never log driver errors: messages can contain connection details.
      value.on('error', () => { console.error('Database pool connection error.'); });
      pools.set(connectionString, value);
    }
    return value;
  }
  async function execute(query: Query, client?: PoolClient) {
    const text = query.strings.reduce((sql, part, index) => sql + (index ? `$${index}` : '') + part, '');
    const started = performance.now();
    try {
      const result = native ? await native(query.strings, ...query.values as never[]) : (await (client || await pool()).query(text, query.values)).rows;
      // TCP pg parses timestamp columns as Date; application models use ISO
      // strings, matching JSONB projections and HTTP responses across drivers.
      const rows = native ? result : result.map(row => Object.fromEntries(Object.entries(row).map(([key,value]) => [key,value instanceof Date ? value.toISOString() : value])));
      emit({ event: 'database_query', provider, fingerprint: queryFingerprint(text), durationMs: Math.round(performance.now() - started), rows: rows.length, resultJsonBytes: process.env.DB_METRICS === '1' ? resultJsonBytes(rows) : 0, success: true });
      return rows;
    } catch (error) {
      emit({ event: 'database_query', provider, fingerprint: queryFingerprint(text), durationMs: Math.round(performance.now() - started), rows: 0, resultJsonBytes: 0, success: false });
      throw error;
    }
  }
  // Lazy queries preserve the existing tagged-template transaction interface.
  // Creating a transaction's queries must not execute them outside that transaction.
  function tagged(strings: TemplateStringsArray, ...values: unknown[]) {
    const query = { strings, values };
    let promise: Promise<unknown[]> | undefined;
    return { query, then(resolve: (value: unknown[]) => unknown, reject: (error: unknown) => unknown) { return (promise ??= execute(query)).then(resolve, reject); } };
  }
  // Maintenance scripts execute fixed migration DDL through query(). Dynamic
  // values must use the tagged interface so SQL is never assembled from input.
  tagged.query = (text: string, values: unknown[] = []) => {
    if (values.length) throw new Error('Use tagged SQL for parameterized queries.');
    return tagged(Object.assign([text], { raw: [text] }) as unknown as TemplateStringsArray);
  };
  tagged.transaction = async (queries: ReturnType<typeof tagged>[], options?: { isolationLevel?: string }) => {
    if (native) {
      const started = performance.now();
      const result = await native.transaction(queries.map(item => native(item.query.strings, ...item.query.values as never[])), options as never);
      if (process.env.DB_METRICS === '1') console.info(JSON.stringify({ event: 'database_transaction', provider, operations: queries.length, durationMs: Math.round(performance.now() - started), resultJsonBytes: resultJsonBytes(result) }));
      return result;
    }
    const isolation = options?.isolationLevel || 'ReadCommitted';
    const levels: Record<string, string> = { ReadCommitted: 'READ COMMITTED', RepeatableRead: 'REPEATABLE READ', Serializable: 'SERIALIZABLE', ReadUncommitted: 'READ UNCOMMITTED' };
    if (!levels[isolation]) throw new Error('Unsupported transaction isolation.');
    const client = await (await pool()).connect();
    try {
      await client.query(`BEGIN ISOLATION LEVEL ${levels[isolation]}`);
      const result = [];
      for (const item of queries) result.push(await execute(item.query, client));
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally { client.release(); }
  };
  return tagged as unknown as NeonQueryFunction<false, false>;
}

export function getDatabaseClient() {
  if (process.env.DB_MODE === 'local') {
    if (process.env.NODE_ENV === 'production' || process.env.VERCEL) throw new Error('Local JSON storage is disabled in deployed production.');
    return null;
  }
  const connection = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!connection && (process.env.NODE_ENV === 'production' || process.env.VERCEL)) throw new Error('A production database connection is required.');
  return connection ? createDatabaseClient(connection) : null;
}

export async function closeDatabasePools() {
  await Promise.all([...pools.values()].map(pool => pool.end()));
  pools.clear();
}

export async function databaseHealth() {
  const started = performance.now();
  try {
    const sql = getDatabaseClient();
    if (!sql) return { healthy: true, driver: 'local', durationMs: 0 };
    await sql`SELECT 1 AS healthy`;
    return { healthy: true, driver: process.env.DB_DRIVER || 'neon', durationMs: Math.round(performance.now()-started) };
  } catch {
    return { healthy: false, driver: process.env.DB_DRIVER || 'neon', durationMs: Math.round(performance.now()-started) };
  }
}
