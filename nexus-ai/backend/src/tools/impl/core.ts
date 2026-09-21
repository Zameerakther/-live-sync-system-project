import { evaluate } from 'mathjs';
import { execFile, spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { ToolContext, ok, fail } from './helpers';
import { SupportedLanguage } from '../../types';
import cron from 'node-cron';
import { getSetting, setSetting } from '../../database';
import { getLogger } from '../../core/logger';
import { v4 as uuidv4 } from 'uuid';

export async function calculator(params: Record<string, any>, _ctx: ToolContext) {
  const expr = String(params.expression || '').trim();
  if (!expr) return fail('calculator', 'expression parameter required');
  try {
    const result = evaluate(expr);
    return ok('calculator', { expression: expr, result }, `${expr} = ${result}`);
  } catch (e: any) {
    return fail('calculator', `Could not evaluate "${expr}": ${e.message}`);
  }
}

export async function code_executor(params: Record<string, any>, ctx: ToolContext) {
  const code = String(params.code || '');
  const language = String(params.language || 'shell').toLowerCase();
  if (!code) return fail('code_executor', 'code parameter required');
  const exportsDir = ctx.permissions.storagePath('Exports');
  const ext = language === 'python' || language === 'python3' ? '.py' : language === 'node' || language === 'javascript' ? '.js' : '.sh';
  const file = path.join(exportsDir, `snippet_${uuidv4().slice(0, 8)}${ext}`);
  fs.writeFileSync(file, code);

  const cmd = ext === '.py' ? 'python3' : ext === '.js' ? 'node' : 'bash';
  return new Promise<any>((resolve) => {
    execFile(cmd, [file], { timeout: 10000, cwd: exportsDir, maxBuffer: 1024 * 1024 }, (err, stdout, stderr) => {
      fs.unlink(file, () => {});
      if (err) {
        resolve(fail('code_executor', `Execution failed: ${err.message}`, { stdout, stderr }));
      } else {
        resolve(ok('code_executor', { stdout, stderr }, 'Code executed successfully.'));
      }
    });
  });
}

export async function notification(params: Record<string, any>, ctx: ToolContext) {
  const title = String(params.title || 'NEXUS AI');
  const body = String(params.body || params.message || '');
  const severity = String(params.severity || 'INFO').toUpperCase();
  const speak = params.speak !== false;
  try {
    const notifier = require('node-notifier');
    notifier.notify({ title, message: body, timeout: 8 });
  } catch (e) {
    getLogger().warn('node-notifier failed (headless?)', e);
  }
  ctx.broadcast('NOTIFICATION', { title, body, severity, speak });
  return ok('notification', { title, body, severity }, 'Notification dispatched.');
}

export async function translation(params: Record<string, any>, ctx: ToolContext) {
  const text = String(params.text || '');
  const target = String(params.targetLanguage || 'ENGLISH').toUpperCase() as SupportedLanguage;
  if (!text) return fail('translation', 'text parameter required');
  try {
    const translated = await ctx.getProvider().translateText(text, target);
    return ok('translation', { source: text, translated, targetLanguage: target }, translated);
  } catch (e: any) {
    return fail('translation', `Translation failed: ${e.message}`);
  }
}

// ---------- Scheduler ----------
interface ScheduleEntry { id: string; cronExpr: string; label: string; taskName: string; createdAt: string; }

const activeCrons = new Map<string, any>();

const PRESET_CRONS: Record<number, { cron: string; label: string }> = {
  1: { cron: '0 18 * * 1', label: 'Mon 18:00' },
  2: { cron: '0 18 * * 1,4', label: 'Mon 18:00,Thu 18:00' },
  3: { cron: '0 18 * * 1,3,5', label: 'Mon 18:00,Wed 18:00,Fri 18:00' },
  4: { cron: '0 18 * * 1,2,4,6', label: 'Mon 18:00,Tue 18:00,Thu 18:00,Sat 18:00' },
  5: { cron: '0 18 * * 1-5', label: 'Mon-Fri 18:00' }
};

export function restoreSchedules(ctx: ToolContext) {
  const entries = (getSetting('schedules') as ScheduleEntry[] | undefined) || [];
  for (const e of entries) scheduleCron(e, ctx);
}

function scheduleCron(entry: ScheduleEntry, ctx: ToolContext): boolean {
  if (!cron.validate(entry.cronExpr)) return false;
  const job = cron.schedule(entry.cronExpr, async () => {
    getLogger().info(`Scheduler fired: ${entry.label}`);
    ctx.broadcast('DEV_LOG', {
      id: uuidv4(), timestamp: new Date().toISOString(), type: 'STATE_CHANGE',
      message: `Scheduled production "${entry.taskName}" triggered (${entry.cronExpr}).`
    });
    const mode = (getSetting('autoPublishMode') as string) || 'APPROVAL';
    try {
      await ctx.gaming.startProduction('GTA V', 'Scheduled Production');
      if (mode !== 'AUTO') {
        ctx.broadcast('NOTIFICATION', { title: 'NEXUS Scheduler', body: `"${entry.taskName}" produced — awaiting approval.`, severity: 'INFO', speak: false });
      }
    } catch (e) {
      getLogger().error('Scheduled production failed', e);
    }
  });
  activeCrons.set(entry.id, job);
  return true;
}

export async function scheduler(params: Record<string, any>, ctx: ToolContext) {
  const entries = (getSetting('schedules') as ScheduleEntry[] | undefined) || [];
  const action = String(params.action || (params.cronExpr || params.videosPerWeek ? 'add' : 'list'));

  if (action === 'list') {
    return ok('scheduler', { schedules: entries }, `${entries.length} schedule(s) configured.`);
  }
  if (action === 'remove') {
    const id = String(params.id || '');
    const job = activeCrons.get(id);
    if (job) { job.stop(); activeCrons.delete(id); }
    setSetting('schedules', entries.filter(e => e.id !== id));
    return ok('scheduler', {}, 'Schedule removed.');
  }

  let cronExpr = String(params.cronExpr || '');
  let label = cronExpr;
  const perWeek = Number(params.videosPerWeek || 0);
  if (perWeek >= 1 && perWeek <= 5 && PRESET_CRONS[perWeek]) {
    cronExpr = PRESET_CRONS[perWeek].cron;
    label = PRESET_CRONS[perWeek].label;
  }
  if (!cronExpr || !cron.validate(cronExpr)) {
    return fail('scheduler', 'Provide a valid cronExpr or videosPerWeek (1-5).');
  }
  const entry: ScheduleEntry = {
    id: uuidv4(), cronExpr, label,
    taskName: params.taskName || 'Scheduled Gaming Production',
    createdAt: new Date().toISOString()
  };
  if (!scheduleCron(entry, ctx)) return fail('scheduler', `Invalid cron expression: ${cronExpr}`);
  setSetting('schedules', [...entries, entry]);
  setSetting('publishSchedule', entries.map(e => e.label).concat(label));
  return ok('scheduler', { schedule: entry }, `Scheduled "${entry.taskName}" at ${label} (${cronExpr}).`);
}

export function stopAllCrons() {
  for (const job of activeCrons.values()) job.stop();
  activeCrons.clear();
}
