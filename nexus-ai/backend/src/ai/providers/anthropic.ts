import { AIProvider, AIProviderResponse } from '../provider';
import { SupportedLanguage, ToolDefinition } from '../../types';
import { buildSystemPrompt, parseDecision, plainTextFallback } from '../structured';

export class AnthropicProvider implements AIProvider {
  name = 'Anthropic Claude';
  private apiKey: string;
  private model: string;
  private tools: ToolDefinition[] = [];

  constructor(apiKey?: string, model?: string) {
    this.apiKey = apiKey || process.env.ANTHROPIC_API_KEY || '';
    this.model = model || process.env.ANTHROPIC_MODEL || 'claude-3-5-haiku-latest';
  }

  setTools(tools: ToolDefinition[]) { this.tools = tools; }

  private async messages(system: string, messages: Array<{ role: string; content: string }>): Promise<string> {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({ model: this.model, max_tokens: 2048, system, messages })
    });
    if (!res.ok) throw new Error(`Anthropic HTTP ${res.status}`);
    const data: any = await res.json();
    return (data?.content || []).map((c: any) => c.text || '').join('');
  }

  async chat(prompt: string, history: Array<{ sender: string; text: string }>, _currentLang: SupportedLanguage = 'AUTO'): Promise<AIProviderResponse> {
    const messages = [
      ...history.slice(-10).map(h => ({ role: h.sender === 'USER' ? 'user' : 'assistant', content: h.text })),
      { role: 'user', content: prompt }
    ];
    const raw = await this.messages(buildSystemPrompt(this.tools), messages);
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
    return this.messages('You are NEXUS, a concise, creative content-generation engine. Output only the requested content.',
      [{ role: 'user', content: prompt }]);
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
