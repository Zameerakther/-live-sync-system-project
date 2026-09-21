import { useNexusStore } from '../store/nexusStore';
import { SupportedLanguage } from '../types';

export class NexusError extends Error {
  details?: string;
  status?: number;
  constructor(message: string, details?: string, status?: number) {
    super(message);
    this.details = details;
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const { sessionId, apiToken } = useNexusStore.getState();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-nexus-session': sessionId,
    ...(options.headers as Record<string, string> || {})
  };
  if (apiToken) headers['Authorization'] = `Bearer ${apiToken}`;

  let res: Response;
  try {
    res = await fetch(path, { ...options, headers });
  } catch (e: any) {
    throw new NexusError('NEXUS backend is unreachable.', e.message);
  }
  if (!res.ok) {
    let body: any = {};
    try { body = await res.json(); } catch { /* ignore */ }
    throw new NexusError(body.error || `Request failed (HTTP ${res.status})`, body.details, res.status);
  }
  const body = await res.json();
  // Some routes report failures with HTTP 200 ({ok:false} / {success:false})
  if (body && (body.ok === false || body.success === false)) {
    throw new NexusError(body.message || body.error || 'Action failed.', body.details, res.status);
  }
  return body as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: any) => request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: any) => request<T>(path, { method: 'PUT', body: body ? JSON.stringify(body) : undefined }),
  del: <T>(path: string) => request<T>(path, { method: 'DELETE' }),

  chat: (message: string, language: SupportedLanguage) =>
    request<any>('/api/chat', { method: 'POST', body: JSON.stringify({ message, language }) }),
  detectLanguage: (text: string) =>
    request<{ language: SupportedLanguage }>('/api/voice/detect-language', { method: 'POST', body: JSON.stringify({ text }) })
};
