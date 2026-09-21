import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { ToolContext, ok, fail } from './helpers';

const MAX_READ_BYTES = 200 * 1024;

export async function file_search(params: Record<string, any>, ctx: ToolContext) {
  const keyword = String(params.keyword || params.query || '').trim();
  const ext = params.extension ? String(params.extension).replace(/^\./, '') : '';
  if (!keyword) return fail('file_search', 'keyword parameter required');
  const results: string[] = [];
  for (const dir of ctx.permissions.getApprovedDirs()) {
    try {
      walk(dir, keyword, ext, results, 4, 200);
    } catch { /* skip unreadable dirs */ }
  }
  return ok('file_search', { results, count: results.length }, `Found ${results.length} file(s) matching "${keyword}".`);
}

function walk(dir: string, keyword: string, ext: string, out: string[], depth: number, cap: number) {
  if (depth <= 0 || out.length >= cap) return;
  let entries: fs.Dirent[];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    if (out.length >= cap) return;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (!['node_modules', '.git', 'dist'].includes(e.name)) walk(p, keyword, ext, out, depth - 1, cap);
    } else if (e.name.toLowerCase().includes(keyword.toLowerCase()) && (!ext || e.name.endsWith('.' + ext))) {
      out.push(p);
    }
  }
}

const TEXT_EXTS = new Set(['txt','md','json','js','ts','tsx','jsx','py','sh','yml','yaml','csv','html','css','xml','log','env','sql','ini','cfg','toml']);

export async function file_reader(params: Record<string, any>, ctx: ToolContext) {
  const filePath = String(params.filePath || params.path || '');
  if (!filePath) return fail('file_reader', 'filePath parameter required');
  const resolved = ctx.permissions.resolveApproved(filePath);
  if (!resolved.ok) return fail('file_reader', resolved.error, { permissionRequestId: resolved.requestId });
  const p = resolved.resolved;
  if (!fs.existsSync(p) || !fs.statSync(p).isFile()) return fail('file_reader', `File not found: ${p}`);
  const ext = path.extname(p).slice(1).toLowerCase();
  if (!TEXT_EXTS.has(ext)) return fail('file_reader', `Refusing to read non-text file (.${ext}). Text files only.`);
  const size = fs.statSync(p).size;
  if (size > MAX_READ_BYTES) return fail('file_reader', `File exceeds 200KB limit (${Math.round(size / 1024)}KB).`);
  const content = fs.readFileSync(p, 'utf-8');
  return ok('file_reader', { path: p, content, bytes: size }, `Read ${size} bytes from ${p}.`);
}

export async function file_write(params: Record<string, any>, ctx: ToolContext) {
  const filePath = String(params.filePath || params.path || '');
  const content = String(params.content ?? '');
  if (!filePath) return fail('file_write', 'filePath parameter required');
  const resolved = ctx.permissions.resolveApproved(filePath);
  if (!resolved.ok) return fail('file_write', resolved.error, { permissionRequestId: resolved.requestId });
  const p = resolved.resolved;
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content);
  return ok('file_write', { path: p, bytes: Buffer.byteLength(content) }, `Wrote ${Buffer.byteLength(content)} bytes to ${p}.`);
}
