import { create } from 'zustand';
const uuidv4 = () => crypto.randomUUID();
import {
  AIState, SupportedLanguage, ChatMessage, TaskItem, SystemMetrics,
  GamingConcept, YouTubeChannelInfo, YouTubeVideoMetadata, ToolDefinition,
  DevConsoleLog, ConfirmationRequest, PermissionRequest, MemoryRecord
} from '../types';

export interface NexusNotification {
  id: string;
  title: string;
  body: string;
  severity: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';
  ts: number;
}

export interface NexusError {
  message: string;
  details?: string;
  retry?: () => void;
}

export interface SettingsState {
  wakeWord: string;
  language: SupportedLanguage;
  provider: string;
  autoPublishMode: 'AUTO' | 'APPROVAL';
  schedule: any[];
  approvedDirs: string[];
  appAliases: Record<string, string>;
  availableProviders: { id: string; name: string; configured: boolean }[];
}

interface NexusState {
  aiState: AIState;
  aiStateDetail?: string;
  messages: ChatMessage[];
  tasks: TaskItem[];
  metrics: SystemMetrics | null;
  concepts: GamingConcept[];
  youtubeInfo: YouTubeChannelInfo | null;
  youtubeQueue: YouTubeVideoMetadata[];
  tools: ToolDefinition[];
  devLogs: DevConsoleLog[];
  notifications: NexusNotification[];
  pendingConfirmations: ConfirmationRequest[];
  pendingPermissions: PermissionRequest[];
  researchStatus: { status: string; detail?: string } | null;
  settings: SettingsState | null;
  memories: MemoryRecord[];
  wsConnected: boolean;
  micActive: boolean;
  pttActive: boolean;
  speaking: boolean;
  language: SupportedLanguage;
  wakeWord: string;
  sessionId: string;
  apiToken: string;
  error: NexusError | null;
  typingMessageId: string | null;

  set: (p: Partial<NexusState>) => void;
  pushMessage: (m: ChatMessage) => void;
  pushDevLog: (l: DevConsoleLog) => void;
  pushNotification: (n: Omit<NexusNotification, 'id' | 'ts'>) => void;
  dismissNotification: (id: string) => void;
  upsertTask: (t: TaskItem) => void;
  setError: (e: NexusError | null) => void;
}

let devLogCounter = 0;

function persisted(key: string, fallback: string): string {
  try { return localStorage.getItem(key) || fallback; } catch { return fallback; }
}

export const useNexusStore = create<NexusState>((set) => ({
  aiState: 'IDLE',
  aiStateDetail: undefined,
  messages: [],
  tasks: [],
  metrics: null,
  concepts: [],
  youtubeInfo: null,
  youtubeQueue: [],
  tools: [],
  devLogs: [],
  notifications: [],
  pendingConfirmations: [],
  pendingPermissions: [],
  researchStatus: null,
  settings: null,
  memories: [],
  wsConnected: false,
  micActive: false,
  pttActive: false,
  speaking: false,
  language: 'AUTO',
  wakeWord: 'Nexus',
  sessionId: persisted('nexus_session_id', uuidv4()),
  apiToken: persisted('nexus_api_token', ''),
  error: null,
  typingMessageId: null,

  set: (p) => set(p),
  pushMessage: (m) => set((s) => ({ messages: [...s.messages, m] })),
  pushDevLog: (l) => set((s) => {
    const e = { ...l, id: `${l.timestamp}-${devLogCounter++}` };
    return { devLogs: [e, ...s.devLogs].slice(0, 500) };
  }),
  pushNotification: (n) => set((s) => ({
    notifications: [...s.notifications, { ...n, id: uuidv4(), ts: Date.now() }]
  })),
  dismissNotification: (id) => set((s) => ({ notifications: s.notifications.filter(n => n.id !== id) })),
  upsertTask: (t) => set((s) => {
    const idx = s.tasks.findIndex(x => x.id === t.id);
    const tasks = idx >= 0 ? s.tasks.map(x => x.id === t.id ? t : x) : [t, ...s.tasks];
    return { tasks };
  }),
  setError: (e) => set({ error: e })
}));

// Persist sessionId + token
useNexusStore.subscribe((s) => {
  try {
    localStorage.setItem('nexus_session_id', s.sessionId);
    if (s.apiToken) localStorage.setItem('nexus_api_token', s.apiToken);
    else localStorage.removeItem('nexus_api_token');
  } catch { /* ignore */ }
});
