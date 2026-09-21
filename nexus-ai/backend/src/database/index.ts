import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { getLogger } from '../core/logger';

export type DB = Database.Database;

let db: DB | null = null;

export function getDataDir(): string {
  const dir = process.env.NEXUS_DATA_DIR || path.join(process.cwd(), 'data');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function getDB(): DB {
  if (db) return db;
  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl && databaseUrl.startsWith('postgres')) {
    getLogger().info('Postgres support pending; using SQLite');
  }
  const dbPath = path.join(getDataDir(), 'nexus.db');
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  const schemaPath = fs.existsSync(path.join(__dirname, 'schema.sql'))
    ? path.join(__dirname, 'schema.sql')
    : path.join(__dirname, '..', '..', 'src', 'database', 'schema.sql'); // compiled dist lacks assets
  const schema = fs.readFileSync(schemaPath, 'utf-8');
  db.exec(schema);
  getLogger().info(`SQLite database initialised at ${dbPath}`);
  return db;
}

// ---------- Settings ----------
export function getSetting(key: string): any {
  const row = getDB().prepare('SELECT value FROM settings WHERE key = ?').get(key) as any;
  if (!row) return undefined;
  try { return JSON.parse(row.value); } catch { return row.value; }
}

export function setSetting(key: string, value: any): void {
  getDB().prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .run(key, JSON.stringify(value));
}

export function getAllSettings(): Record<string, any> {
  const rows = getDB().prepare('SELECT key, value FROM settings').all() as any[];
  const out: Record<string, any> = {};
  for (const r of rows) { try { out[r.key] = JSON.parse(r.value); } catch { out[r.key] = r.value; } }
  return out;
}

// ---------- Audit ----------
export function audit(action: string, detail: string, outcome: 'SUCCESS' | 'FAILURE' | 'PENDING' = 'SUCCESS') {
  try {
    getDB().prepare('INSERT INTO audit_logs (id, timestamp, action, detail, outcome) VALUES (?, ?, ?, ?, ?)')
      .run(require('uuid').v4(), new Date().toISOString(), action, detail, outcome);
  } catch (e) {
    getLogger().warn('Failed to write audit log', e);
  }
}

export function getAuditLogs(limit = 200) {
  return getDB().prepare('SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT ?').all(limit);
}
