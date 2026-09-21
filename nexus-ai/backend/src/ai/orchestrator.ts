import { AIProvider, createAIProvider, AIProviderResponse, MockAIProvider } from './provider';
import { ToolRegistry, ToolExecutionResult } from '../tools/registry';
import { TaskRunnerModule } from '../modules/tasks';
import { GamingModule, SUPPORTED_GAMES } from '../modules/gaming';
import { MemoryManager } from '../modules/memory';
import { SupportedLanguage, ChatMessage, DevConsoleLog, AIState } from '../types';
import { detectLanguage } from './languageDetector';
import { getLogger } from '../core/logger';
import { v4 as uuidv4 } from 'uuid';

export interface OrchestrationResult {
  replyMessage: ChatMessage;
  devLogs: DevConsoleLog[];
  stateChange?: string;
  toolResult?: ToolExecutionResult;
}

interface SessionContext {
  history: Array<{ sender: string; text: string }>;
  activeSlot?: {
    type: 'gaming_video';
    collected: { game?: string; style?: string };
  };
}

function devLog(type: DevConsoleLog['type'], message: string, data?: any): DevConsoleLog {
  return { id: uuidv4(), timestamp: new Date().toISOString(), type, message, data };
}

export class AIOrchestrator {
  private provider: AIProvider;
  private mockFallback = new MockAIProvider();
  private toolRegistry: ToolRegistry;
  private taskRunner: TaskRunnerModule;
  private gamingModule: GamingModule;
  private memoryManager: MemoryManager;
  private sessions: Map<string, SessionContext> = new Map();
  private emitState: (state: AIState, detail?: string) => void = () => {};

  constructor(
    providerType: string = 'mock',
    toolRegistry: ToolRegistry,
    taskRunner: TaskRunnerModule,
    gamingModule: GamingModule,
    memoryManager: MemoryManager
  ) {
    this.provider = createAIProvider(providerType);
    this.provider.setTools?.(toolRegistry.getToolDefinitions());
    this.toolRegistry = toolRegistry;
    this.taskRunner = taskRunner;
    this.gamingModule = gamingModule;
    this.memoryManager = memoryManager;
  }

  setStateEmitter(fn: (state: AIState, detail?: string) => void) {
    this.emitState = fn;
  }

  /** Switch the active AI provider at runtime. */
  setProvider(providerType: string): AIProvider {
    this.provider = createAIProvider(providerType);
    this.provider.setTools?.(this.toolRegistry.getToolDefinitions());
    getLogger().info(`AI provider switched to ${this.provider.name}`);
    return this.provider;
  }

  getProvider(): AIProvider { return this.provider; }

  private getSession(sessionId: string): SessionContext {
    let s = this.sessions.get(sessionId);
    if (!s) {
      s = { history: [] };
      this.sessions.set(sessionId, s);
    }
    return s;
  }

  async processUserMessage(userText: string, currentLang: SupportedLanguage = 'AUTO', sessionId = 'default'): Promise<OrchestrationResult> {
    const startTime = Date.now();
    const devLogs: DevConsoleLog[] = [];
    const session = this.getSession(sessionId);

    let lang = currentLang;
    if (lang === 'AUTO') {
      lang = detectLanguage(userText);
      devLogs.push(devLog('MEMORY', `Language auto-detected: ${lang}`));
    }

    devLogs.push(devLog('INTENT', `User Query Received: "${userText}" (Lang: ${lang}, Session: ${sessionId})`));

    this.emitState('THINKING');

    // --- Slot-filling: active gaming_video collection ---
    if (session.activeSlot?.type === 'gaming_video') {
      const result = await this.continueSlotFill(userText, session, lang, devLogs);
      this.pushHistory(session, userText, result.replyMessage.text);
      this.emitState('SUCCESS');
      return result;
    }

    // --- Deterministic pre-check: does user want to create a gaming video? ---
    const wantsGaming = /gaming (video|idea|concept)|create (a )?gaming|make (a )?(gaming )?video|produce (a )?video/i.test(userText);
    if (wantsGaming) {
      // Try to extract game + style inline
      const game = this.extractGame(userText);
      if (!game) {
        session.activeSlot = { type: 'gaming_video', collected: {} };
        const text = `Ready to produce a gaming video. Which game should I target? Supported: ${SUPPORTED_GAMES.join(', ')}.`;
        devLogs.push(devLog('STATE_CHANGE', 'Slot-filling activated: collecting game title'));
        this.pushHistory(session, userText, text);
        this.emitState('SPEAKING');
        return this.result(text, devLogs, 'SLOT_FILL_GAME', lang);
      }
    }

    // --- AI Provider ---
    let response: AIProviderResponse;
    try {
      response = await this.provider.chat(userText, session.history, lang);
    } catch (err: any) {
      getLogger().error(`Provider "${this.provider.name}" failed, falling back to mock`, err);
      devLogs.push(devLog('ERROR', `Provider "${this.provider.name}" failed (${err.message}); using Mock engine for this request.`));
      response = await this.mockFallback.chat(userText, session.history, lang);
    }

    const providerTimeMs = Date.now() - startTime;
    devLogs.push(devLog('PROVIDER_LATENCY', `Provider [${this.provider.name}] responded in ${providerTimeMs}ms (Intent: ${response.intent || 'GENERAL'})`));

    // Language switch memory persistence
    if (response.intent === 'SWITCH_LANGUAGE' && response.detectedLanguage) {
      this.memoryManager.addMemory('preferences', 'language', response.detectedLanguage);
    }

    // --- Tool execution ---
    let executedToolName: string | undefined;
    let toolResult: ToolExecutionResult | undefined;
    if (response.toolToExecute) {
      this.emitState('EXECUTING', response.toolToExecute.name);
      devLogs.push(devLog('TOOL_CALL', `Executing tool "${response.toolToExecute.name}" with params: ${JSON.stringify(response.toolToExecute.params)}`));
      toolResult = await this.toolRegistry.executeTool(response.toolToExecute.name, response.toolToExecute.params);
      executedToolName = response.toolToExecute.name;
      devLogs.push(devLog(
        toolResult.success ? 'TOOL_CALL' : 'ERROR',
        `Tool "${executedToolName}" ${toolResult.success ? 'succeeded' : 'failed'}: ${toolResult.message}`,
        toolResult.resultData || undefined
      ));
      if (toolResult.success && toolResult.resultData && response.intent !== 'TRANSLATE') {
        // Surface the tool output in the reply when the mock reply is generic
        if (typeof toolResult.resultData === 'object' && toolResult.resultData.result !== undefined) {
          response.text = `${toolResult.resultData.expression}: ${toolResult.resultData.result}`;
        }
      }
    }

    // --- Task creation ---
    let createdTaskId: string | undefined;
    if (response.taskStepsToCreate) {
      const task = this.taskRunner.createTask(
        response.taskStepsToCreate.name,
        response.taskStepsToCreate.category,
        response.taskStepsToCreate.steps
      );
      createdTaskId = task.id;
      devLogs.push(devLog('STATE_CHANGE', `Created automated multi-step task "${task.name}" with ${task.steps.length} steps.`));
    }

    this.pushHistory(session, userText, response.text);
    this.emitState('SPEAKING');

    const replyMessage: ChatMessage = {
      id: uuidv4(),
      sender: 'NEXUS',
      text: response.text,
      timestamp: new Date().toISOString(),
      language: response.detectedLanguage || lang,
      toolExecuted: executedToolName,
      taskCreatedId: createdTaskId
    };

    return { replyMessage, devLogs, stateChange: response.intent, toolResult };
  }

  private extractGame(text: string): string | null {
    const lower = text.toLowerCase();
    for (const game of SUPPORTED_GAMES) {
      if (lower.includes(game.toLowerCase())) return game;
    }
    if (/\bgta\b/.test(lower)) return 'GTA V';
    if (lower.includes('red dead') || lower.includes('rdr2')) return 'Red Dead Redemption 2';
    return null;
  }

  private async continueSlotFill(userText: string, session: SessionContext, lang: SupportedLanguage, devLogs: DevConsoleLog[]): Promise<OrchestrationResult> {
    const slot = session.activeSlot!;
    const lower = userText.toLowerCase().trim();

    if (!slot.collected.game) {
      const game = this.extractGame(userText);
      if (!game) {
        const text = `I didn't recognise that game. Supported titles: ${SUPPORTED_GAMES.join(', ')}. Which one?`;
        return this.result(text, devLogs, 'SLOT_FILL_GAME', lang);
      }
      slot.collected.game = game;
      devLogs.push(devLog('STATE_CHANGE', `Slot collected: game = ${game}`));
      const text = `${game} it is. What style should the video be — e.g. "Fast Cinematic", "Documentary", "Funny Moments", "Tutorial"?`;
      return this.result(text, devLogs, 'SLOT_FILL_STYLE', lang);
    }

    if (!slot.collected.style) {
      slot.collected.style = userText.trim();
      devLogs.push(devLog('STATE_CHANGE', `Slot collected: style = ${slot.collected.style}`));
      session.activeSlot = undefined;

      const { taskId } = await this.gamingModule.startProduction(slot.collected.game, slot.collected.style);
      const text = `Production launched: ${slot.collected.game} — "${slot.collected.style}" style. Task ${taskId} is now running through the full pipeline; watch TASK_UPDATED for progress.`;
      devLogs.push(devLog('STATE_CHANGE', `Production task ${taskId} started`));
      return { replyMessage: { id: uuidv4(), sender: 'NEXUS', text, timestamp: new Date().toISOString(), language: lang, taskCreatedId: taskId }, devLogs, stateChange: 'PRODUCTION_STARTED' };
    }

    session.activeSlot = undefined;
    return this.result('Slot state reset. How can I help?', devLogs, 'GENERAL_CHAT', lang);
  }

  private result(text: string, devLogs: DevConsoleLog[], intent: string, lang: SupportedLanguage): OrchestrationResult {
    return {
      replyMessage: { id: uuidv4(), sender: 'NEXUS', text, timestamp: new Date().toISOString(), language: lang },
      devLogs,
      stateChange: intent
    };
  }

  private pushHistory(session: SessionContext, userText: string, reply: string) {
    session.history.push({ sender: 'USER', text: userText });
    session.history.push({ sender: 'NEXUS', text: reply });
    if (session.history.length > 20) session.history = session.history.slice(-20);
  }
}
