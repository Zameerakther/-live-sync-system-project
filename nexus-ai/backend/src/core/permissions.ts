import fs from 'fs';
import os from 'os';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { PermissionRequest, ConfirmationRequest } from '../types';
import { getDB, getSetting, setSetting, audit } from '../database';

export const STORAGE_SUBDIRS = ['Projects', 'Videos', 'Audio', 'Images', 'Thumbnails', 'Scripts', 'Exports', 'Logs'];

export function defaultStorageDir(): string {
  return process.env.NEXUS_STORAGE_DIR || path.join(os.homedir(), 'NexusAI');
}

export class PermissionManager {
  private approvedDirs: string[] = [];
  private pendingRequests: Map<string, PermissionRequest> = new Map();
  private broadcast?: (type: string, data: any) => void;

  constructor() {
    const envDirs = (process.env.NEXUS_APPROVED_DIRS || '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
    const persisted = (getSetting('approvedDirs') as string[] | undefined) || [];
    const base = defaultStorageDir();
    this.approvedDirs = Array.from(new Set([base, ...envDirs, ...persisted])).map(d => path.resolve(d));

    // Create storage subfolders on boot
    for (const sub of STORAGE_SUBDIRS) {
      fs.mkdirSync(path.join(base, sub), { recursive: true });
    }
    // Persisted permission grants from DB table
    try {
      const rows = getDB().prepare('SELECT path FROM permissions').all() as any[];
      for (const r of rows) {
        const p = path.resolve(r.path);
        if (!this.approvedDirs.includes(p)) this.approvedDirs.push(p);
      }
    } catch { /* db not ready yet */ }
  }

  setBroadcast(fn: (type: string, data: any) => void) { this.broadcast = fn; }

  getApprovedDirs(): string[] { return [...this.approvedDirs]; }

  grantDir(dir: string): void {
    const resolved = path.resolve(dir);
    if (!this.approvedDirs.includes(resolved)) {
      this.approvedDirs.push(resolved);
    }
    fs.mkdirSync(resolved, { recursive: true });
    try {
      getDB().prepare('INSERT INTO permissions (path, granted_at) VALUES (?, ?) ON CONFLICT(path) DO NOTHING')
        .run(resolved, new Date().toISOString());
    } catch { /* ignore */ }
    const persisted = (getSetting('approvedDirs') as string[] | undefined) || [];
    if (!persisted.includes(resolved)) setSetting('approvedDirs', [...persisted, resolved]);
    audit('PERMISSION_GRANTED', resolved);
  }

  isApproved(targetPath: string): boolean {
    const resolved = path.resolve(targetPath);
    return this.approvedDirs.some(dir => resolved === dir || resolved.startsWith(dir + path.sep));
  }

  /** Resolve a user-supplied path; returns {ok:true, resolved} or creates a permission request. */
  resolveApproved(targetPath: string): { ok: true; resolved: string } | { ok: false; error: string; requestId: string } {
    const resolved = path.resolve(defaultStorageDir(), targetPath);
    if (this.isApproved(resolved) || this.isApproved(path.resolve(targetPath))) {
      return { ok: true, resolved: this.isApproved(resolved) ? resolved : path.resolve(targetPath) };
    }
    const dir = path.dirname(path.resolve(targetPath));
    const req: PermissionRequest = {
      id: uuidv4(),
      path: dir,
      status: 'PENDING',
      requestedAt: new Date().toISOString()
    };
    this.pendingRequests.set(req.id, req);
    this.broadcast?.('PERMISSION_REQUEST', req);
    audit('PERMISSION_REQUESTED', dir, 'PENDING');
    return { ok: false, error: `Permission required for ${dir}`, requestId: req.id };
  }

  grantRequest(id: string): PermissionRequest | null {
    const req = this.pendingRequests.get(id);
    if (!req) return null;
    req.status = 'GRANTED';
    this.grantDir(req.path);
    return req;
  }

  getPendingRequests(): PermissionRequest[] {
    return Array.from(this.pendingRequests.values());
  }

  storagePath(subdir: string): string {
    const p = path.join(defaultStorageDir(), subdir);
    fs.mkdirSync(p, { recursive: true });
    return p;
  }
}

export interface ToolExecFn {
  (params: Record<string, any>): Promise<any>;
}

export class ConfirmationManager {
  private pending: Map<string, { request: ConfirmationRequest; exec: ToolExecFn }> = new Map();
  private broadcast?: (type: string, data: any) => void;

  setBroadcast(fn: (type: string, data: any) => void) { this.broadcast = fn; }

  request(toolName: string, params: Record<string, any>, summary: string, exec: ToolExecFn): ConfirmationRequest {
    const req: ConfirmationRequest = {
      id: uuidv4(),
      toolName,
      params,
      summary,
      status: 'PENDING',
      requestedAt: new Date().toISOString()
    };
    this.pending.set(req.id, { request: req, exec });
    this.broadcast?.('CONFIRMATION_REQUIRED', req);
    audit('CONFIRMATION_REQUIRED', `${toolName}: ${summary}`, 'PENDING');
    return req;
  }

  async approve(id: string): Promise<{ ok: boolean; result?: any; error?: string }> {
    const entry = this.pending.get(id);
    if (!entry) return { ok: false, error: 'Confirmation not found' };
    entry.request.status = 'APPROVED';
    entry.request.resolvedAt = new Date().toISOString();
    try {
      const result = await entry.exec(entry.request.params);
      entry.request.result = result;
      this.pending.delete(id);
      this.broadcast?.('CONFIRMATION_RESOLVED', { id, status: 'APPROVED', result });
      audit('CONFIRMATION_APPROVED', `${entry.request.toolName} ${id}`);
      return { ok: true, result };
    } catch (err: any) {
      this.broadcast?.('CONFIRMATION_RESOLVED', { id, status: 'APPROVED', error: err.message });
      audit('CONFIRMATION_EXECUTION_FAILED', `${entry.request.toolName} ${id}: ${err.message}`, 'FAILURE');
      return { ok: false, error: err.message };
    }
  }

  reject(id: string): boolean {
    const entry = this.pending.get(id);
    if (!entry) return false;
    entry.request.status = 'REJECTED';
    entry.request.resolvedAt = new Date().toISOString();
    this.pending.delete(id);
    this.broadcast?.('CONFIRMATION_RESOLVED', { id, status: 'REJECTED' });
    audit('CONFIRMATION_REJECTED', `${entry.request.toolName} ${id}`);
    return true;
  }

  getPending(): ConfirmationRequest[] {
    return Array.from(this.pending.values()).map(e => e.request);
  }

  get(id: string): ConfirmationRequest | undefined {
    return this.pending.get(id)?.request;
  }
}

export const DANGEROUS_TOOLS = new Set([
  'code_executor',
  'file_delete',
  'youtube_publish',
  'system_settings'
]);

export function isDangerousTool(name: string, params: Record<string, any>): { dangerous: boolean; summary: string } {
  if (name === 'code_executor') {
    return { dangerous: true, summary: `Execute ${params.language || 'shell'} code snippet` };
  }
  if (name === 'app_control') {
    const target = String(params.target || params.app || '');
    const aliases = getAppAliases();
    const alias = aliases[target.toLowerCase()];
    if (alias && !/^https?:\/\//.test(alias)) {
      return { dangerous: true, summary: `Launch application "${target}" (${alias})` };
    }
    if (!alias) {
      return { dangerous: true, summary: `Launch unregistered application "${target}"` };
    }
    return { dangerous: false, summary: '' };
  }
  if (name === 'youtube' && (params.action === 'upload' || params.action === 'publish' || params.action === 'schedule')) {
    return { dangerous: true, summary: `YouTube action: ${params.action}` };
  }
  if (DANGEROUS_TOOLS.has(name)) {
    return { dangerous: true, summary: `Execute ${name}` };
  }
  return { dangerous: false, summary: '' };
}

export function getAppAliases(): Record<string, string> {
  let aliases: Record<string, string> = {};
  try {
    if (process.env.APP_ALIASES) aliases = JSON.parse(process.env.APP_ALIASES);
  } catch { /* invalid env json */ }
  const stored = (getSetting('appAliases') as Record<string, string> | undefined) || {};
  return { ...DEFAULT_APP_ALIASES, ...aliases, ...stored };
}

export const DEFAULT_APP_ALIASES: Record<string, string> = {
  youtube: 'https://youtube.com',
  github: 'https://github.com',
  vscode: 'code',
  'vs code': 'code',
  terminal: 'x-terminal-emulator'
};
