import { MemoryRecord } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { getDB } from '../database';

export class MemoryManager {
  constructor() {
    // Seed defaults only if empty
    try {
      const count = (getDB().prepare('SELECT COUNT(*) as c FROM memories').get() as any).c;
      if (count === 0) {
        this.addMemory('preferences', 'wake_word', process.env.WAKE_WORD_DEFAULT || 'Nexus');
        this.addMemory('preferences', 'voice_identity', 'Calm, confident, intelligent');
        this.addMemory('configuration', 'publish_mode', (process.env.AUTO_PUBLISH_MODE || 'approval').toUpperCase());
      }
    } catch { /* db not ready */ }
  }

  getMemories(): MemoryRecord[] {
    const rows = getDB().prepare('SELECT * FROM memories ORDER BY updated_at DESC').all() as any[];
    return rows.map(r => ({
      id: r.id,
      category: r.category,
      key: r.key,
      value: safeJson(r.value),
      updatedAt: r.updated_at
    }));
  }

  getByKey(category: string, key: string): MemoryRecord | null {
    const r = getDB().prepare('SELECT * FROM memories WHERE category = ? AND key = ?').get(category, key) as any;
    if (!r) return null;
    return { id: r.id, category: r.category, key: r.key, value: safeJson(r.value), updatedAt: r.updated_at };
  }

  addMemory(category: MemoryRecord['category'], key: string, value: any): MemoryRecord {
    const existing = this.getByKey(category, key);
    const record: MemoryRecord = {
      id: existing?.id || uuidv4(),
      category,
      key,
      value,
      updatedAt: new Date().toISOString()
    };
    getDB().prepare(`INSERT INTO memories (id, category, key, value, updated_at) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(category, key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at`)
      .run(record.id, category, key, JSON.stringify(value), record.updatedAt);
    return record;
  }

  deleteMemory(id: string): boolean {
    const res = getDB().prepare('DELETE FROM memories WHERE id = ?').run(id);
    return res.changes > 0;
  }
}

function safeJson(v: string | null): any {
  if (v == null) return v;
  try { return JSON.parse(v); } catch { return v; }
}
