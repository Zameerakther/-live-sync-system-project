import { spawn } from 'child_process';
import { ToolContext, ok, fail } from './helpers';
import { getAppAliases } from '../../core/permissions';
import { getLogger } from '../../core/logger';
import { v4 as uuidv4 } from 'uuid';
import * as cheerio from 'cheerio';

function researchStatus(ctx: ToolContext, status: string, detail?: string) {
  ctx.broadcast('RESEARCH_STATUS', { status, detail, ts: new Date().toISOString() });
}

export async function web_search(params: Record<string, any>, ctx: ToolContext) {
  const query = String(params.query || '').trim();
  if (!query) return fail('web_search', 'query parameter required');
  researchStatus(ctx, 'SEARCHING', query);
  try {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) NEXUS-AI/1.0' }
    });
    if (!res.ok) throw new Error(`DuckDuckGo HTTP ${res.status}`);
    const html = await res.text();
    const $ = cheerio.load(html);
    const results: { title: string; url: string; snippet: string }[] = [];
    $('.result').each((_i, el) => {
      if (results.length >= 6) return;
      const a = $(el).find('.result__a');
      const snippet = $(el).find('.result__snippet').text().trim();
      const href = a.attr('href') || '';
      // DDG wraps real url in uddg param
      let realUrl = href;
      const m = href.match(/uddg=([^&]+)/);
      if (m) realUrl = decodeURIComponent(m[1]);
      const title = a.text().trim();
      if (title && realUrl) results.push({ title, url: realUrl, snippet });
    });
    if (results.length === 0) throw new Error('No results parsed from DuckDuckGo');

    researchStatus(ctx, 'ANALYZING', `${results.length} results`);
    let summary: string | undefined;
    const provider = ctx.getProvider();
    if (provider && provider.name !== 'Mock Local AI Engine') {
      try {
        researchStatus(ctx, 'VERIFYING');
        const citations = results.map((r, i) => `[${i + 1}] ${r.title} — ${r.url}`).join('\n');
        summary = await provider.generateText(
          `Summarize these search results for the query "${query}" in 3-4 sentences, citing sources like [1]:\n` +
          results.map((r, i) => `[${i + 1}] ${r.title}: ${r.snippet}`).join('\n') +
          `\n\nSources:\n${citations}`
        );
      } catch (e) {
        getLogger().warn('LLM summarization failed; returning raw results', e);
      }
    }
    researchStatus(ctx, 'COMPLETE');
    return ok('web_search', { query, results, summary }, summary || `Found ${results.length} results for "${query}".`);
  } catch (e: any) {
    researchStatus(ctx, 'COMPLETE', 'failed');
    getLogger().error('web_search failed', e);
    return fail('web_search', `Web search failed: ${e.message}`);
  }
}

export async function browser(params: Record<string, any>, _ctx: ToolContext) {
  const url = String(params.url || '');
  if (!/^https?:\/\//.test(url)) return fail('browser', 'url must start with http(s)://');
  const opened = await openExternal(url);
  if (opened) return ok('browser', { url }, `Opened ${url} in default browser.`);
  return fail('browser', `Could not launch a browser for ${url} (headless environment?).`);
}

function openExternal(target: string): Promise<boolean> {
  const cmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'cmd' : 'xdg-open';
  const args = process.platform === 'win32' ? ['/c', 'start', target] : [target];
  return new Promise((resolve) => {
    try {
      const child = spawn(cmd, args, { detached: true, stdio: 'ignore' });
      child.on('error', () => resolve(false));
      child.on('exit', (code) => resolve(code === 0));
      child.unref();
      // If no exit within 3s assume launched
      setTimeout(() => resolve(true), 3000);
    } catch {
      resolve(false);
    }
  });
}

export async function app_control(params: Record<string, any>, _ctx: ToolContext) {
  const target = String(params.target || params.app || '').trim();
  if (!target) return fail('app_control', 'target parameter required');
  const aliases = getAppAliases();
  const alias = aliases[target.toLowerCase()];
  if (!alias) {
    return fail('app_control', `"${target}" is not in the app allowlist. Add it via APP_ALIASES or /api/settings.`);
  }
  if (/^https?:\/\//.test(alias)) {
    const opened = await openExternal(alias);
    return opened
      ? ok('app_control', { target, url: alias }, `Opened ${alias}.`)
      : fail('app_control', `Could not open ${alias} (headless environment?).`);
  }
  // Shell command alias — spawn detached
  try {
    const parts = alias.split(' ');
    const child = spawn(parts[0], parts.slice(1), { detached: true, stdio: 'ignore' });
    child.unref();
    return ok('app_control', { target, command: alias }, `Launched "${alias}".`);
  } catch (e: any) {
    return fail('app_control', `Failed to launch "${alias}": ${e.message}`);
  }
}

export async function task_control(params: Record<string, any>, ctx: ToolContext) {
  const action = String(params.action || 'list');
  const tasks = ctx.taskRunner.getTasks();
  const latest = tasks.find(t => t.status === 'RUNNING' || t.status === 'PAUSED') || tasks[0];
  switch (action) {
    case 'list':
      return ok('task_control', { tasks: tasks.map(t => ({ id: t.id, name: t.name, status: t.status, progress: t.overallProgress })) },
        `${tasks.length} task(s) in registry.`);
    case 'pause':
      return latest && ctx.taskRunner.pauseTask(latest.id)
        ? ok('task_control', { id: latest.id }, `Paused "${latest.name}".`)
        : fail('task_control', 'No running task to pause.');
    case 'resume':
      return latest && ctx.taskRunner.resumeTask(latest.id)
        ? ok('task_control', { id: latest.id }, `Resumed "${latest.name}".`)
        : fail('task_control', 'No paused task to resume.');
    case 'cancel':
      return latest && ctx.taskRunner.cancelTask(latest.id)
        ? ok('task_control', { id: latest.id }, `Cancelled "${latest.name}".`)
        : fail('task_control', 'No active task to cancel.');
    case 'logs':
      return ok('task_control', { logs: latest?.logs.slice(-20) || [] }, `Latest logs for "${latest?.name || 'no task'}".`);
    default:
      return fail('task_control', `Unknown task_control action "${action}".`);
  }
}
