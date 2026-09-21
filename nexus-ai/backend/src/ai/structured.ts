import { SupportedLanguage } from '../types';
import { ToolDefinition } from '../types';

export interface StructuredDecision {
  reply: string;
  intent: string;
  language: SupportedLanguage;
  tool?: { name: string; params: Record<string, any> } | null;
  task?: { name: string; category: string; steps: string[] } | null;
}

const NEXUS_PERSONA = `You are NEXUS, a personal AI operating system and content studio assistant.
Persona: calm, confident, concise. Reply in the user's language. You are an original identity — never reference movies or fictional AI characters.`;

export function buildSystemPrompt(tools: ToolDefinition[]): string {
  const toolList = tools
    .map(t => `- ${t.name}: ${t.description} (params: ${JSON.stringify(t.parameters)})`)
    .join('\n');
  return `${NEXUS_PERSONA}

Available tools:
${toolList}

Supported languages: AUTO, ENGLISH, ARABIC, HINDI, MALAYALAM, TAMIL, URDU, FRENCH, SPANISH, GERMAN, CHINESE, JAPANESE, KOREAN.

You MUST respond with ONLY a JSON object (no prose, no code fences) of this shape:
{
  "reply": string,              // what to say to the user, in their language
  "intent": string,             // short intent label e.g. "GENERAL_CHAT", "WEB_RESEARCH", "CREATE_GAMING_TASK"
  "language": string,           // the language the user is speaking
  "tool": {"name": string, "params": object} | null,   // a tool to execute, or null
  "task": {"name": string, "category": "GAMING"|"YOUTUBE"|"SYSTEM"|"RESEARCH"|"GENERAL", "steps": [string]} | null
}`;
}

/** Lenient JSON parse: strip code fences, find first {...} block. */
export function parseDecision(raw: string): StructuredDecision | null {
  if (!raw) return null;
  let text = raw.trim();
  text = text.replace(/```(?:json)?/gi, '').trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    const obj = JSON.parse(text.slice(start, end + 1));
    if (typeof obj.reply !== 'string') return null;
    return {
      reply: obj.reply,
      intent: typeof obj.intent === 'string' ? obj.intent : 'GENERAL_CHAT',
      language: (obj.language as SupportedLanguage) || 'AUTO',
      tool: obj.tool && typeof obj.tool === 'object' && typeof obj.tool.name === 'string' ? obj.tool : null,
      task: obj.task && typeof obj.task === 'object' && Array.isArray(obj.task.steps) ? obj.task : null
    };
  } catch {
    return null;
  }
}

/** Sanitize a raw LLM text reply when JSON parsing fails. */
export function plainTextFallback(raw: string): string {
  return raw.replace(/```(?:json)?/gi, '').trim() || 'Understood.';
}
