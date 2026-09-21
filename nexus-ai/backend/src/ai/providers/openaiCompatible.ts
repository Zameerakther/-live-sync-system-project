import { AIProvider, AIProviderResponse } from '../provider';
import { SupportedLanguage, ToolDefinition } from '../../types';
import { buildSystemPrompt, parseDecision, plainTextFallback } from '../structured';

export interface OpenAICompatibleConfig {
  baseURL: string;
  apiKey: string;
  model: string;
  name?: string;
}

export class OpenAICompatibleProvider implements AIProvider {
  name: string;
  private baseURL: string;
  private apiKey: string;
  private model: string;
  private tools: ToolDefinition[] = [];

  constructor(config: OpenAICompatibleConfig) {
    this.baseURL = config.baseURL.replace(/\/$/, '');
    this.apiKey = config.apiKey;
    this.model = config.model;
    this.name = config.name || `OpenAI-Compatible (${this.model})`;
  }

  setTools(tools: ToolDefinition[]) { this.tools = tools; }

  private async chatRaw(messages: Array<{ role: string; content: string }>, json = false): Promise<string> {
    const body: any = { model: this.model, messages };
    if (json) body.response_format = { type: 'json_object' };
    const res = await fetch(`${this.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(`${this.name} HTTP ${res.status}: ${await res.text().catch(() => '')}`);
    const data: any = await res.json();
    return data?.choices?.[0]?.message?.content ?? '';
  }

  async chat(prompt: string, history: Array<{ sender: string; text: string }>, _currentLang: SupportedLanguage = 'AUTO'): Promise<AIProviderResponse> {
    const messages = [
      { role: 'system', content: buildSystemPrompt(this.tools) },
      ...history.slice(-10).map(h => ({ role: h.sender === 'USER' ? 'user' : 'assistant', content: h.text })),
      { role: 'user', content: prompt }
    ];
    const raw = await this.chatRaw(messages, true);
    const decision = parseDecision(raw);
    if (!decision) {
      return { text: plainTextFallback(raw), intent: 'GENERAL_CHAT' };
    }
    return {
      text: decision.reply,
      intent: decision.intent,
      detectedLanguage: decision.language,
      toolToExecute: decision.tool || undefined,
      taskStepsToCreate: decision.task as any || undefined
    };
  }

  async generateText(prompt: string): Promise<string> {
    return this.chatRaw([
      { role: 'system', content: 'You are NEXUS, a concise, creative content-generation engine. Output only the requested content.' },
      { role: 'user', content: prompt }
    ]);
  }

  async generateScript(gameTitle: string, concept: string): Promise<string> {
    return this.generateText(`Write a YouTube gaming video script for ${gameTitle}: "${concept}". Include intro hook, 3 action segments, outro CTA.`);
  }

  async translateText(text: string, targetLang: SupportedLanguage): Promise<string> {
    return this.generateText(`Translate the following text to ${targetLang}. Output only the translation.\n\n${text}`);
  }

  async detectLanguage(text: string): Promise<SupportedLanguage> {
    const { detectLanguage } = await import('../languageDetector');
    return detectLanguage(text);
  }
}
