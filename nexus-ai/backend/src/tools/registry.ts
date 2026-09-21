import { ToolDefinition } from '../types';
import { ToolContext } from './impl/helpers';
import { isDangerousTool, getAppAliases } from '../core/permissions';
import { audit } from '../database';
import { getLogger } from '../core/logger';

import { calculator, code_executor, notification, translation, scheduler } from './impl/core';
import { file_search, file_reader, file_write } from './impl/files';
import { web_search, browser, app_control, task_control } from './impl/web';
import { video_editor, image_generator, audio_generator, video_generator, youtube } from './impl/media';

export interface ToolExecutionResult {
  success: boolean;
  toolName: string;
  resultData: any;
  message: string;
  requiresConfirmation?: boolean;
  confirmationId?: string;
  summary?: string;
}

type ToolImpl = (params: Record<string, any>, ctx: ToolContext) => Promise<ToolExecutionResult>;

const DEFINITIONS: ToolDefinition[] = [
  { name: 'web_search', description: 'Searches the web for latest info, gaming news, trends & citations', category: 'WEB', parameters: { query: 'string' } },
  { name: 'file_search', description: 'Locates files within approved local directories', category: 'SYSTEM', parameters: { keyword: 'string', extension: 'string' } },
  { name: 'file_reader', description: 'Reads content from approved local files (text, max 200KB)', category: 'SYSTEM', parameters: { filePath: 'string' } },
  { name: 'file_write', description: 'Writes text content to a file in approved directories', category: 'SYSTEM', parameters: { filePath: 'string', content: 'string' } },
  { name: 'calculator', description: 'Evaluates mathematical and statistical expressions', category: 'CORE', parameters: { expression: 'string' } },
  { name: 'code_executor', description: 'Executes isolated node/python/shell snippets (requires confirmation)', category: 'CORE', parameters: { code: 'string', language: 'string' } },
  { name: 'video_generator', description: 'Starts a full gaming video production pipeline task', category: 'MEDIA', parameters: { gameTitle: 'string', style: 'string' } },
  { name: 'video_editor', description: 'Renders video via FFmpeg (color source + drawtext, or clip concat)', category: 'MEDIA', parameters: { title: 'string', durationSec: 'number', clips: 'string[]' } },
  { name: 'image_generator', description: 'Creates YouTube thumbnails via FFmpeg lavfi', category: 'MEDIA', parameters: { title: 'string', style: 'string' } },
  { name: 'audio_generator', description: 'Synthesizes voice commentary via espeak/say', category: 'MEDIA', parameters: { scriptText: 'string' } },
  { name: 'youtube', description: 'Interacts with YouTube API (status, queue, publish)', category: 'MEDIA', parameters: { action: 'string', id: 'string' } },
  { name: 'scheduler', description: 'Schedules recurring video production (videosPerWeek 1-5 or cronExpr)', category: 'CORE', parameters: { action: 'string', cronExpr: 'string', videosPerWeek: 'number', taskName: 'string' } },
  { name: 'system_monitor', description: 'Reads live hardware metrics (CPU, GPU, RAM, Disk, Network)', category: 'SYSTEM', parameters: {} },
  { name: 'browser', description: 'Opens a URL in the system browser', category: 'WEB', parameters: { url: 'string' } },
  { name: 'app_control', description: 'Launches an approved application or URL alias', category: 'SYSTEM', parameters: { target: 'string' } },
  { name: 'notification', description: 'Triggers desktop + HUD notifications', category: 'CORE', parameters: { title: 'string', body: 'string', severity: 'string' } },
  { name: 'translation', description: 'Translates text across supported languages', category: 'CORE', parameters: { text: 'string', targetLanguage: 'string' } },
  { name: 'task_control', description: 'Controls running tasks (list, pause, resume, cancel, logs)', category: 'CORE', parameters: { action: 'string' } }
];

export class ToolRegistry {
  private tools: Map<string, ToolDefinition> = new Map();
  private impls: Map<string, ToolImpl> = new Map();
  private ctx!: ToolContext;

  constructor() {
    for (const def of DEFINITIONS) this.tools.set(def.name, def);

    this.impls.set('calculator', calculator);
    this.impls.set('code_executor', code_executor);
    this.impls.set('notification', notification);
    this.impls.set('translation', translation);
    this.impls.set('scheduler', scheduler);
    this.impls.set('file_search', file_search);
    this.impls.set('file_reader', file_reader);
    this.impls.set('file_write', file_write);
    this.impls.set('web_search', web_search);
    this.impls.set('browser', browser);
    this.impls.set('app_control', app_control);
    this.impls.set('task_control', task_control);
    this.impls.set('video_editor', video_editor);
    this.impls.set('image_generator', image_generator);
    this.impls.set('audio_generator', audio_generator);
    this.impls.set('video_generator', video_generator);
    this.impls.set('youtube', youtube);
    this.impls.set('system_monitor', async (_p, c) => {
      const metrics = await c.systemMonitor.getMetrics();
      return { success: true, toolName: 'system_monitor', resultData: metrics, message: 'Hardware telemetry acquired.' };
    });
  }

  setContext(ctx: ToolContext) {
    this.ctx = ctx;
  }

  getToolDefinitions(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  /** Execute without confirmation gate — used internally and after approval. */
  async executeDirect(name: string, params: Record<string, any>): Promise<ToolExecutionResult> {
    const impl = this.impls.get(name);
    if (!this.tools.has(name)) {
      return { success: false, toolName: name, resultData: null, message: `Tool "${name}" is not registered in NEXUS Tool Registry.` };
    }
    if (!impl) {
      return { success: false, toolName: name, resultData: null, message: `Tool "${name}" has no implementation available.` };
    }
    try {
      const result = await impl(params || {}, this.ctx);
      audit('TOOL_EXECUTION', `${name} ${JSON.stringify(params).slice(0, 500)} -> ${result.message.slice(0, 300)}`, result.success ? 'SUCCESS' : 'FAILURE');
      return result;
    } catch (err: any) {
      getLogger().error(`Tool ${name} threw`, err);
      audit('TOOL_EXECUTION', `${name}: ${err.message}`, 'FAILURE');
      return { success: false, toolName: name, resultData: null, message: `Tool "${name}" failed: ${err.message}` };
    }
  }

  /** Execute with dangerous-tool confirmation gate. */
  async executeTool(name: string, params: Record<string, any>): Promise<ToolExecutionResult> {
    const gate = isDangerousTool(name, params || {});
    if (gate.dangerous && this.ctx?.confirmations) {
      const req = this.ctx.confirmations.request(name, params || {}, gate.summary,
        async (p) => this.executeDirect(name, p));
      return {
        success: false, toolName: name, resultData: null,
        message: `Confirmation required: ${gate.summary}`,
        requiresConfirmation: true, confirmationId: req.id, summary: gate.summary
      };
    }
    return this.executeDirect(name, params || {});
  }
}
