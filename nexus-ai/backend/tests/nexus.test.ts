import { describe, it, expect, beforeAll } from 'vitest';
import path from 'path';
import fs from 'fs';
import os from 'os';

// Isolated data + storage dirs for tests
process.env.NEXUS_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-test-data-'));
process.env.NEXUS_STORAGE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-test-storage-'));

import { detectLanguage } from '../src/ai/languageDetector';
import { MockAIProvider } from '../src/ai/provider';
import { parseDecision } from '../src/ai/structured';
import { calculator } from '../src/tools/impl/core';
import { PermissionManager, ConfirmationManager } from '../src/core/permissions';
import { ToolContext } from '../src/tools/impl/helpers';
import { AIOrchestrator } from '../src/ai/orchestrator';
import { ToolRegistry } from '../src/tools/registry';
import { TaskRunnerModule } from '../src/modules/tasks';
import { GamingModule } from '../src/modules/gaming';
import { MemoryManager } from '../src/modules/memory';
import { YouTubeModule } from '../src/modules/youtube';
import { SystemMonitorModule } from '../src/modules/system';

const ctxStub = (permissions: PermissionManager): ToolContext => ({
  permissions,
  confirmations: new ConfirmationManager(),
  systemMonitor: new SystemMonitorModule(),
  gaming: null as any,
  youtube: null as any,
  taskRunner: new TaskRunnerModule(),
  memory: new MemoryManager(),
  getProvider: () => new MockAIProvider(),
  broadcast: () => {},
  devLog: () => {}
});

describe('languageDetector', () => {
  it('detects scripts correctly', () => {
    expect(detectLanguage('مرحبا كيف حالك')).toBe('ARABIC');
    expect(detectLanguage('یہ اردو ہے ٹ ڈ ڑ ں ے')).toBe('URDU');
    expect(detectLanguage('नमस्ते आप कैसे हैं')).toBe('HINDI');
    expect(detectLanguage('നമസ്കാരം')).toBe('MALAYALAM');
    expect(detectLanguage('வணக்கம் நீங்கள் எப்படி')).toBe('TAMIL');
    expect(detectLanguage('こんにちは元気ですか')).toBe('JAPANESE');
    expect(detectLanguage('안녕하세요 어떻게 지내세요')).toBe('KOREAN');
    expect(detectLanguage('你好你怎么样')).toBe('CHINESE');
  });
  it('detects Latin languages via franc', () => {
    expect(detectLanguage('Bonjour, comment allez-vous aujourd\'hui mon ami?')).toBe('FRENCH');
    expect(detectLanguage('Hola, ¿cómo estás hoy? Espero que muy bien')).toBe('SPANISH');
    expect(detectLanguage('Guten Tag, wie geht es Ihnen heute?')).toBe('GERMAN');
    expect(detectLanguage('Hello, how are you doing today?')).toBe('ENGLISH');
  });
});

describe('MockAIProvider intents', () => {
  const mock = new MockAIProvider();
  it('handles greetings', async () => {
    const r = await mock.chat('hello nexus', []);
    expect(r.intent).toBe('GREETING');
  });
  it('handles language switch', async () => {
    const r = await mock.chat('switch to french', []);
    expect(r.intent).toBe('SWITCH_LANGUAGE');
    expect(r.detectedLanguage).toBe('FRENCH');
  });
  it('handles calculator', async () => {
    const r = await mock.chat('calculate 12*7', []);
    expect(r.toolToExecute?.name).toBe('calculator');
    expect(r.toolToExecute?.params.expression).toBe('12*7');
  });
  it('handles open youtube -> app_control', async () => {
    const r = await mock.chat('open youtube', []);
    expect(r.toolToExecute?.name).toBe('app_control');
    expect(r.toolToExecute?.params.target).toBe('youtube');
  });
  it('handles open url -> browser', async () => {
    const r = await mock.chat('open github.com', []);
    expect(r.toolToExecute?.name).toBe('browser');
  });
  it('handles search', async () => {
    const r = await mock.chat('search latest GTA 6 news', []);
    expect(r.toolToExecute?.name).toBe('web_search');
    expect(r.toolToExecute?.params.query).toContain('GTA 6');
  });
  it('handles gaming video request', async () => {
    const r = await mock.chat('create a gaming video', []);
    expect(r.intent).toBe('CREATE_GAMING_TASK');
  });
  it('handles time query', async () => {
    const r = await mock.chat('what time is it', []);
    expect(r.intent).toBe('TIME_QUERY');
  });
  it('handles translate', async () => {
    const r = await mock.chat('translate "hello world" to spanish', []);
    expect(r.toolToExecute?.name).toBe('translation');
    expect(r.toolToExecute?.params.targetLanguage).toBe('SPANISH');
  });
});

describe('structured decision parsing', () => {
  it('parses fenced JSON', () => {
    const d = parseDecision('```json\n{"reply":"hi","intent":"GENERAL_CHAT","language":"ENGLISH","tool":null,"task":null}\n```');
    expect(d?.reply).toBe('hi');
  });
  it('parses JSON embedded in prose', () => {
    const d = parseDecision('Sure! {"reply":"done","intent":"X"} hope that helps');
    expect(d?.reply).toBe('done');
  });
  it('returns null on garbage', () => {
    expect(parseDecision('no json here')).toBeNull();
  });
});

describe('calculator tool', () => {
  it('evaluates expressions', async () => {
    const r = await calculator({ expression: '12*7' }, ctxStub(new PermissionManager()));
    expect(r.success).toBe(true);
    expect(r.resultData.result).toBe(84);
  });
  it('fails cleanly on bad input', async () => {
    const r = await calculator({ expression: 'foo(' }, ctxStub(new PermissionManager()));
    expect(r.success).toBe(false);
  });
});

describe('permissions', () => {
  it('approves paths inside storage dir and rejects others', () => {
    const pm = new PermissionManager();
    const inside = pm.resolveApproved('Videos/test.mp4');
    expect(inside.ok).toBe(true);
    const outside = pm.resolveApproved('/etc/passwd');
    expect(outside.ok).toBe(false);
    if (!outside.ok) {
      expect(outside.error).toContain('Permission required for');
      // grant the request
      const granted = pm.grantRequest(outside.requestId);
      expect(granted?.status).toBe('GRANTED');
    }
  });
});

describe('ConfirmationManager', () => {
  it('request -> approve executes', async () => {
    const cm = new ConfirmationManager();
    let ran = false;
    const req = cm.request('code_executor', { code: 'echo hi' }, 'test', async () => { ran = true; return 'done'; });
    expect(cm.getPending().length).toBe(1);
    const res = await cm.approve(req.id);
    expect(res.ok).toBe(true);
    expect(ran).toBe(true);
    expect(cm.getPending().length).toBe(0);
  });
  it('request -> reject cancels', async () => {
    const cm = new ConfirmationManager();
    let ran = false;
    const req = cm.request('code_executor', {}, 'test', async () => { ran = true; });
    expect(cm.reject(req.id)).toBe(true);
    expect(ran).toBe(false);
  });
});

describe('slot-filling conversation', () => {
  it('gaming video flow: ask game -> ask style -> start production', async () => {
    const registry = new ToolRegistry();
    const taskRunner = new TaskRunnerModule();
    const gaming = new GamingModule();
    const youtube = new YouTubeModule();
    const memory = new MemoryManager();
    const permissions = new PermissionManager();
    const confirmations = new ConfirmationManager();
    const orchestrator = new AIOrchestrator('mock', registry, taskRunner, gaming, memory);

    const ctx: ToolContext = {
      permissions, confirmations, systemMonitor: new SystemMonitorModule(),
      gaming, youtube, taskRunner, memory,
      getProvider: () => orchestrator.getProvider(),
      broadcast: () => {}, devLog: () => {}
    };
    registry.setContext(ctx);
    gaming.wire(orchestrator.getProvider(), taskRunner, youtube, registry);

    const s = 'test-session';
    const r1 = await orchestrator.processUserMessage('Nexus, create a gaming video', 'AUTO', s);
    expect(r1.replyMessage.text).toMatch(/which game/i);

    const r2 = await orchestrator.processUserMessage('GTA V', 'AUTO', s);
    expect(r2.replyMessage.text).toMatch(/style/i);

    const r3 = await orchestrator.processUserMessage('fast cinematic', 'AUTO', s);
    expect(r3.replyMessage.taskCreatedId).toBeTruthy();
    const task = taskRunner.getTask(r3.replyMessage.taskCreatedId!);
    expect(task?.category).toBe('GAMING');
    expect(task?.steps.length).toBeGreaterThan(5);
  }, 30000);
});
