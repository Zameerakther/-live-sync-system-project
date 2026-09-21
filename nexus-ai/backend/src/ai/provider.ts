import { SupportedLanguage, ToolDefinition } from '../types';
import { detectLanguage } from './languageDetector';
import { generateFromPrompt, genScript } from './contentGen';

export interface AIProviderResponse {
  text: string;
  intent?: string;
  detectedLanguage?: SupportedLanguage;
  toolToExecute?: {
    name: string;
    params: Record<string, any>;
  };
  taskStepsToCreate?: {
    name: string;
    category: 'GAMING' | 'YOUTUBE' | 'SYSTEM' | 'RESEARCH' | 'GENERAL';
    steps: string[];
  };
}

export interface AIProvider {
  name: string;
  chat(prompt: string, history: Array<{ sender: string; text: string }>, currentLang?: SupportedLanguage): Promise<AIProviderResponse>;
  generateText(prompt: string): Promise<string>;
  generateScript(gameTitle: string, concept: string): Promise<string>;
  translateText(text: string, targetLang: SupportedLanguage): Promise<string>;
  detectLanguage(text: string): Promise<SupportedLanguage>;
  setTools?(tools: ToolDefinition[]): void;
}

const SUPPORTED_GAMES_LIST = ['GTA V', 'GTA Online', 'Red Dead Redemption 2', 'Minecraft'];

const LANG_ALIASES: Record<string, SupportedLanguage> = {
  english: 'ENGLISH', arabic: 'ARABIC', hindi: 'HINDI', malayalam: 'MALAYALAM',
  tamil: 'TAMIL', urdu: 'URDU', french: 'FRENCH', spanish: 'SPANISH',
  german: 'GERMAN', chinese: 'CHINESE', japanese: 'JAPANESE', korean: 'KOREAN'
};

const LANG_SWITCH_REPLIES: Record<SupportedLanguage, string> = {
  AUTO: '', ENGLISH: 'Language switched to English. How may I assist you?',
  ARABIC: 'تم تغيير اللغة إلى العربية. كيف يمكنني مساعدتك؟',
  HINDI: 'भाषा हिंदी में बदल दी गई है। मैं आपकी कैसे सहायता कर सकता हूँ?',
  MALAYALAM: 'ഭാഷ മലയാളത്തിലേക്ക് മാറ്റി. ഞാൻ എങ്ങനെ സഹായിക്കാം?',
  TAMIL: 'மொழி தமிழுக்கு மாற்றப்பட்டது. நான் எவ்வாறு உதவலாம்?',
  URDU: 'زبان اردو میں تبدیل کر دی گئی ہے۔ میں کیسے مدد کر سکتا ہوں؟',
  FRENCH: 'Langue changée en français. Comment puis-je vous aider ?',
  SPANISH: 'Idioma cambiado a español. ¿Cómo puedo ayudarle?',
  GERMAN: 'Sprache auf Deutsch umgestellt. Wie kann ich helfen?',
  CHINESE: '语言已切换为中文。我该如何帮助您？',
  JAPANESE: '言語を日本語に切り替えました。どのようにお手伝いできますか？',
  KOREAN: '언어가 한국어로 전환되었습니다. 어떻게 도와드릴까요?'
};

/**
 * Robust rule-based Mock AI Provider — fully offline operation.
 */
export class MockAIProvider implements AIProvider {
  name = 'Mock Local AI Engine';

  async chat(prompt: string, _history: Array<{ sender: string; text: string }>, currentLang: SupportedLanguage = 'AUTO'): Promise<AIProviderResponse> {
    const lower = prompt.toLowerCase().trim();

    // --- Language switch: "speak/switch to <language>" ---
    const switchMatch = lower.match(/(?:speak|switch to|talk in|respond in|use)\s+([a-z]+)/);
    if (switchMatch && LANG_ALIASES[switchMatch[1]]) {
      const lang = LANG_ALIASES[switchMatch[1]];
      return {
        text: LANG_SWITCH_REPLIES[lang] || `Language switched to ${lang}.`,
        intent: 'SWITCH_LANGUAGE',
        detectedLanguage: lang
      };
    }

    // --- Greetings ---
    if (/^(hi|hello|hey|greetings|good (morning|afternoon|evening)|salam|namaste|nexus[,\s]*$)/.test(lower) || lower === 'nexus') {
      return { text: 'NEXUS online. All systems nominal. How may I assist you?', intent: 'GREETING' };
    }

    // --- Translation: translate "<text>" to <lang> ---
    const translateMatch = prompt.match(/translate\s+["“]?(.+?)["”]?\s+(?:to|into)\s+([a-z]+)/i);
    if (translateMatch && LANG_ALIASES[translateMatch[2].toLowerCase()]) {
      return {
        text: `Translating to ${LANG_ALIASES[translateMatch[2].toLowerCase()]}.`,
        intent: 'TRANSLATE',
        toolToExecute: {
          name: 'translation',
          params: { text: translateMatch[1], targetLanguage: LANG_ALIASES[translateMatch[2].toLowerCase()] }
        }
      };
    }

    // --- Calculator ---
    const calcMatch = lower.match(/(?:calculate|compute|what is|what's|eval(?:uate)?)\s+([0-9][0-9\s+\-*/^%().]*[0-9)])/);
    if (calcMatch || /^[\d\s+\-*/^%().]+$/.test(lower)) {
      const expr = (calcMatch ? calcMatch[1] : lower).trim();
      return {
        text: 'Running that through the calculator module.',
        intent: 'CALCULATE',
        toolToExecute: { name: 'calculator', params: { expression: expr } }
      };
    }

    // --- Time ---
    if (lower.includes('what time') || lower.includes('current time') || lower === 'time') {
      return {
        text: `The current system time is ${new Date().toLocaleTimeString()}.`,
        intent: 'TIME_QUERY'
      };
    }

    // --- Open app / URL ---
    const openMatch = lower.match(/open\s+(.+)/);
    if (openMatch) {
      const target = openMatch[1].trim().replace(/^(the|my)\s+/, '');
      if (/^(https?:\/\/|www\.|[\w-]+\.(com|org|net|io|dev))/.test(target)) {
        const url = target.startsWith('http') ? target : `https://${target}`;
        return {
          text: `Opening ${url} in your browser.`,
          intent: 'OPEN_URL',
          toolToExecute: { name: 'browser', params: { url } }
        };
      }
      return {
        text: `Opening ${target}.`,
        intent: 'OPEN_APP',
        toolToExecute: { name: 'app_control', params: { target } }
      };
    }

    // --- Task control ---
    if (/cancel (the )?(current )?task/.test(lower)) {
      return { text: 'Cancelling the current task.', intent: 'CANCEL_TASK', toolToExecute: { name: 'task_control', params: { action: 'cancel' } } };
    }
    if (/pause (the )?(current )?task|pause production/.test(lower)) {
      return { text: 'Pausing production.', intent: 'PAUSE_TASK', toolToExecute: { name: 'task_control', params: { action: 'pause' } } };
    }
    if (/resume (the )?(current )?task|resume production/.test(lower)) {
      return { text: 'Resuming production.', intent: 'RESUME_TASK', toolToExecute: { name: 'task_control', params: { action: 'resume' } } };
    }
    if (/stop (production|the task|everything)/.test(lower)) {
      return { text: 'Stopping production.', intent: 'STOP_TASK', toolToExecute: { name: 'task_control', params: { action: 'cancel' } } };
    }
    if (/start production|begin production/.test(lower)) {
      return {
        text: 'Initialising production engine. Starting a gaming video pipeline.',
        intent: 'START_PRODUCTION',
        toolToExecute: { name: 'video_generator', params: {} }
      };
    }

    // --- Show tasks / logs ---
    if (lower.includes('show tasks') || lower.includes('list tasks') || lower.includes('task list')) {
      return { text: 'Retrieving the current task registry.', intent: 'SHOW_TASKS', toolToExecute: { name: 'task_control', params: { action: 'list' } } };
    }
    if (lower.includes('show logs') || lower.includes('show log')) {
      return { text: 'Pulling the latest system logs.', intent: 'SHOW_LOGS', toolToExecute: { name: 'task_control', params: { action: 'logs' } } };
    }

    // --- Gaming video / idea ---
    if (/gaming (video|idea|concept)|create (a )?gaming|make (a )?(gaming )?video|video idea/.test(lower)) {
      return {
        text: 'I can produce a gaming video for you. Which game should I target — GTA V, Red Dead Redemption 2, Minecraft, or GTA Online?',
        intent: 'CREATE_GAMING_TASK'
      };
    }

    // --- YouTube ---
    if (lower.includes('youtube') || lower.includes('upload') || lower.includes('channel')) {
      return {
        text: 'Checking the YouTube channel status.',
        intent: 'YOUTUBE_STATUS',
        toolToExecute: { name: 'youtube', params: { action: 'get_status' } }
      };
    }

    // --- Status ---
    if (lower.includes('status') || lower.includes('system metrics') || lower.includes('how are you')) {
      return {
        text: 'Acquiring live hardware telemetry.',
        intent: 'SYSTEM_STATUS',
        toolToExecute: { name: 'system_monitor', params: {} }
      };
    }

    // --- Search / research ---
    if (lower.startsWith('search') || lower.includes('research') || lower.includes('look up') || lower.includes('find out')) {
      const query = prompt.replace(/^(search( for)?|research|look up|find out( about)?)\s*/i, '').trim() || prompt;
      return {
        text: `Running a web research pass on "${query}".`,
        intent: 'WEB_RESEARCH',
        toolToExecute: { name: 'web_search', params: { query } }
      };
    }

    // --- Notification test ---
    if (lower.includes('notify') || lower.includes('notification')) {
      return {
        text: 'Dispatching a desktop notification.',
        intent: 'NOTIFY',
        toolToExecute: { name: 'notification', params: { title: 'NEXUS AI', body: prompt, severity: 'INFO' } }
      };
    }

    const detected = detectLanguage(prompt);
    return {
      text: `Understood. "${prompt}" — tell me if you'd like me to run a tool, create a task, or research that topic.`,
      intent: 'GENERAL_CHAT',
      detectedLanguage: currentLang === 'AUTO' ? detected : currentLang
    };
  }

  async generateText(prompt: string): Promise<string> {
    // Template-based offline content generation — never emits meta disclaimers
    const game = SUPPORTED_GAMES_LIST.find(g => prompt.toLowerCase().includes(g.toLowerCase())) || 'GTA V';
    return generateFromPrompt(prompt, game);
  }

  async generateScript(gameTitle: string, concept: string): Promise<string> {
    return genScript(gameTitle, concept);
  }

  async translateText(text: string, targetLang: SupportedLanguage): Promise<string> {
    return `[NEXUS Translated to ${targetLang}]: ${text}`;
  }

  async detectLanguage(text: string): Promise<SupportedLanguage> {
    return detectLanguage(text);
  }
}

export function createAIProvider(providerType: string = 'mock'): AIProvider {
  const t = (providerType || 'mock').toLowerCase();
  switch (t) {
    case 'ollama': {
      const { OllamaProvider } = require('./providers/ollama');
      return new OllamaProvider();
    }
    case 'openai': {
      const { OpenAICompatibleProvider } = require('./providers/openaiCompatible');
      return new OpenAICompatibleProvider({
        baseURL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
        apiKey: process.env.OPENAI_API_KEY || '',
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        name: 'OpenAI'
      });
    }
    case 'groq': {
      const { OpenAICompatibleProvider } = require('./providers/openaiCompatible');
      return new OpenAICompatibleProvider({
        baseURL: 'https://api.groq.com/openai/v1',
        apiKey: process.env.GROQ_API_KEY || '',
        model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
        name: 'Groq'
      });
    }
    case 'gemini': {
      const { OpenAICompatibleProvider } = require('./providers/openaiCompatible');
      return new OpenAICompatibleProvider({
        baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
        apiKey: process.env.GEMINI_API_KEY || '',
        model: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
        name: 'Gemini'
      });
    }
    case 'anthropic': {
      const { AnthropicProvider } = require('./providers/anthropic');
      return new AnthropicProvider();
    }
    case 'mock':
    default:
      return new MockAIProvider();
  }
}
