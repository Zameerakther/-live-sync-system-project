import { AIProvider, AIProviderResponse } from '../provider';
import { SupportedLanguage, ToolDefinition } from '../../types';
import { buildSystemPrompt, parseDecision, plainTextFallback } from '../structured';

export class OllamaProvider implements AIProvider {
  name = 'Ollama Local LLM';
  private baseUrl: string;
  private model: string;
  private tools: ToolDefinition[] = [];

  constructor(baseUrl?: string, model?: string) {
    this.baseUrl = (baseUrl || process.env.OLLAMA_BASE_URL || 'http://localhost:11434').replace(/\/$/, '');
    this.model = model || process.env.OLLAMA_MODEL || 'llama3.2';
  }

  setTools(tools: ToolDefinition[]) { this.tools = tools; }

  private async chatRaw(messages: Array<{ role: string; content: string }>): Promise<string> {
    const res = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: this.model, messages, stream: false })
    });
    if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`);
    const data: any = await res.json();
    return data?.message?.content ?? '';
  }

  async chat(prompt: string, history: Array<{ sender: string; text: string }>, _currentLang: SupportedLanguage = 'AUTO'): Promise<AIProviderResponse> {
    const messages = [
      { role: 'system', content: buildSystemPrompt(this.tools) },
      ...history.slice(-10).map(h => ({ role: h.sender === 'USER' ? 'user' : 'assistant', content: h.text })),
      { role: 'user', content: prompt }
    ];
    const raw = await this.chatRaw(messages);
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
