import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import { ToolRegistry } from './tools/registry';
import { TaskRunnerModule } from './modules/tasks';
import { GamingModule } from './modules/gaming';
import { YouTubeModule } from './modules/youtube';
import { SystemMonitorModule } from './modules/system';
import { MemoryManager } from './modules/memory';
import { AIOrchestrator } from './ai/orchestrator';
import { SupportedLanguage } from './types';
import { PermissionManager, ConfirmationManager } from './core/permissions';
import { getLogger, friendlyError } from './core/logger';
import { getDB, getSetting, setSetting, getAllSettings, getAuditLogs } from './database';
import { restoreSchedules } from './tools/impl/core';
import { ToolContext } from './tools/impl/helpers';

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;
const logger = getLogger();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '2mb' }));

// Rate limiting on /api
app.use('/api', rateLimit({ windowMs: 60_000, max: 120, standardHeaders: true, legacyHeaders: false }));

// Optional bearer token auth (except /api/status and youtube oauth callback)
const apiToken = process.env.NEXUS_API_TOKEN;
app.use('/api', (req, res, next) => {
  if (!apiToken) return next();
  if (req.path === '/status' || req.path === '/youtube/oauth2callback') return next();
  const auth = req.headers.authorization || '';
  if (auth === `Bearer ${apiToken}`) return next();
  return res.status(401).json({ error: 'Unauthorized' });
});

// ---------- Subsystem Initialisation ----------
getDB(); // init SQLite + schema
const permissions = new PermissionManager();
const confirmations = new ConfirmationManager();
const toolRegistry = new ToolRegistry();
const taskRunner = new TaskRunnerModule();
const gamingModule = new GamingModule();
const youtubeModule = new YouTubeModule();
const systemMonitor = new SystemMonitorModule();
const memoryManager = new MemoryManager();

const orchestrator = new AIOrchestrator(
  process.env.DEFAULT_AI_PROVIDER || 'mock',
  toolRegistry,
  taskRunner,
  gamingModule,
  memoryManager
);

// HTTP + WS servers
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

function broadcast(type: string, data: any) {
  const payload = JSON.stringify({ type, data, timestamp: new Date().toISOString() });
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) client.send(payload);
  });
}

permissions.setBroadcast(broadcast);
confirmations.setBroadcast(broadcast);
orchestrator.setStateEmitter((state, detail) => broadcast('AI_STATE', { state, detail }));

const toolCtx: ToolContext = {
  permissions, confirmations, systemMonitor, gaming: gamingModule,
  youtube: youtubeModule, taskRunner, memory: memoryManager,
  getProvider: () => orchestrator.getProvider(),
  broadcast,
  devLog: (type, message, data) => broadcast('DEV_LOG', { id: uuidv4(), timestamp: new Date().toISOString(), type, message, data })
};
toolRegistry.setContext(toolCtx);
gamingModule.wire(orchestrator.getProvider(), taskRunner, youtubeModule, toolRegistry);
restoreSchedules(toolCtx);

taskRunner.setTaskUpdateListener((task) => broadcast('TASK_UPDATED', task));

// Periodic system metrics broadcast (every 2.5s)
setInterval(async () => {
  try {
    const metrics = await systemMonitor.getMetrics();
    broadcast('SYSTEM_METRICS', metrics);
  } catch (e) { logger.warn('metrics broadcast failed', e); }
}, 2500);

wss.on('connection', (ws) => {
  logger.info('WS client connected');
  ws.send(JSON.stringify({ type: 'CONNECTED', message: 'NEXUS AI System Gateway Established.' }));
});

// ----------------------------------------------------
// REST API ROUTES
// ----------------------------------------------------

app.get('/api/status', (_req, res) => {
  res.json({
    status: 'ONLINE',
    system: 'NEXUS AI OS 2.0',
    version: '2026.1.0',
    provider: process.env.DEFAULT_AI_PROVIDER || 'mock'
  });
});

app.post('/api/chat', async (req, res) => {
  try {
    const { message, language } = req.body;
    if (!message) return res.status(400).json({ error: 'Message is required' });
    const sessionId = (req.headers['x-nexus-session'] as string) || 'default';
    const result = await orchestrator.processUserMessage(message, language as SupportedLanguage, sessionId);
    result.devLogs.forEach(log => broadcast('DEV_LOG', log));
    res.json(result);
  } catch (err: any) {
    res.status(500).json(friendlyError('processing your message', err));
  }
});

app.get('/api/system/metrics', async (_req, res) => {
  try {
    res.json(await systemMonitor.getMetrics());
  } catch (err) {
    res.status(500).json(friendlyError('reading system metrics', err));
  }
});

// Tasks
app.get('/api/tasks', (_req, res) => res.json(taskRunner.getTasks()));

app.post('/api/tasks', (req, res) => {
  const { name, category, steps } = req.body;
  const task = taskRunner.createTask(name || 'Custom Task', category || 'GENERAL', steps || ['Initialise', 'Process', 'Complete']);
  res.json(task);
});

app.post('/api/tasks/:id/cancel', (req, res) => res.json({ success: taskRunner.cancelTask(req.params.id) }));
app.post('/api/tasks/:id/pause', (req, res) => res.json({ success: taskRunner.pauseTask(req.params.id) }));
app.post('/api/tasks/:id/resume', (req, res) => res.json({ success: taskRunner.resumeTask(req.params.id) }));

// Gaming
app.get('/api/gaming/concepts', (_req, res) => res.json(gamingModule.getHistory()));

app.post('/api/gaming/generate', async (req, res) => {
  try {
    const { gameTitle, style } = req.body;
    const concept = await gamingModule.generateConcept(gameTitle, style);
    broadcast('DEV_LOG', {
      id: uuidv4(), timestamp: new Date().toISOString(), type: 'INTENT',
      message: `Gaming Originality Engine generated concept "${concept.conceptTitle}" (${concept.originalityScore}% score)`
    });
    res.json(concept);
  } catch (err) {
    res.status(500).json(friendlyError('generating a concept', err));
  }
});

app.post('/api/gaming/produce', async (req, res) => {
  try {
    const { gameTitle, style } = req.body;
    const { taskId } = await gamingModule.startProduction(gameTitle || 'GTA V', style || 'Fast Cinematic');
    res.json({ taskId });
  } catch (err) {
    res.status(500).json(friendlyError('starting production', err));
  }
});

// YouTube
app.get('/api/youtube/info', async (_req, res) => res.json(await youtubeModule.getChannelInfo()));
app.get('/api/youtube/queue', (_req, res) => res.json(youtubeModule.getQueue()));

app.get('/api/youtube/auth/url', (_req, res) => {
  const url = youtubeModule.getAuthUrl();
  if (!url) return res.status(400).json({ error: 'YouTube not configured — set YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET.' });
  res.json({ url });
});

app.get('/api/youtube/oauth2callback', async (req, res) => {
  const code = req.query.code as string;
  if (!code) return res.status(400).send('Missing code');
  try {
    await youtubeModule.handleOAuthCallback(code);
    res.send('<html><body><h2>NEXUS AI — YouTube connected. You can close this tab.</h2></body></html>');
  } catch (err) {
    res.status(500).send('OAuth failed: ' + (err as any).message);
  }
});

app.post('/api/youtube/publish/:id', async (req, res) => {
  const result = await youtubeModule.approveAndPublish(req.params.id);
  res.json(result);
});

// Memory
app.get('/api/memory', (_req, res) => res.json(memoryManager.getMemories()));
app.delete('/api/memory/:id', (req, res) => res.json({ success: memoryManager.deleteMemory(req.params.id) }));

// Tools
app.get('/api/tools', (_req, res) => res.json(toolRegistry.getToolDefinitions()));

// Permissions
app.get('/api/permissions', (_req, res) => res.json({ approvedDirs: permissions.getApprovedDirs(), pending: permissions.getPendingRequests() }));
app.post('/api/permissions/:id/grant', (req, res) => {
  const req2 = permissions.grantRequest(req.params.id);
  if (!req2) return res.status(404).json({ error: 'Permission request not found' });
  res.json({ success: true, granted: req2.path });
});

// Confirmations
app.get('/api/confirmations', (_req, res) => res.json(confirmations.getPending()));
app.post('/api/confirmations/:id/approve', async (req, res) => {
  const result = await confirmations.approve(req.params.id);
  if (!result.ok && result.error === 'Confirmation not found') return res.status(404).json(result);
  res.json(result);
});
app.post('/api/confirmations/:id/reject', (req, res) => {
  const okRes = confirmations.reject(req.params.id);
  if (!okRes) return res.status(404).json({ error: 'Confirmation not found' });
  res.json({ success: true });
});

// Settings
app.get('/api/settings', (_req, res) => {
  const s = getAllSettings();
  res.json({
    wakeWord: s.wakeWord || process.env.WAKE_WORD_DEFAULT || 'Nexus',
    language: s.language || 'AUTO',
    provider: process.env.DEFAULT_AI_PROVIDER || 'mock',
    autoPublishMode: s.autoPublishMode || 'APPROVAL',
    schedule: s.schedules || [],
    approvedDirs: permissions.getApprovedDirs(),
    appAliases: s.appAliases || {}
  });
});

app.put('/api/settings', (req, res) => {
  const allowed = ['wakeWord', 'language', 'provider', 'autoPublishMode', 'schedule', 'approvedDirs', 'appAliases'];
  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      if (key === 'approvedDirs' && Array.isArray(req.body[key])) {
        for (const dir of req.body[key]) permissions.grantDir(dir);
      } else {
        setSetting(key, req.body[key]);
      }
    }
  }
  res.json({ success: true });
});

// Audit
app.get('/api/audit', (_req, res) => res.json(getAuditLogs()));

server.listen(port, () => {
  logger.info(`NEXUS AI Backend Gateway listening on port ${port}`);
  logger.info(`WebSocket Endpoint: ws://localhost:${port}/ws`);
});
