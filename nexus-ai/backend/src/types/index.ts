export type AIState = 
  | 'IDLE'
  | 'LISTENING'
  | 'THINKING'
  | 'SPEAKING'
  | 'EXECUTING'
  | 'SUCCESS'
  | 'WARNING'
  | 'ERROR';

export type SupportedLanguage = 
  | 'AUTO'
  | 'ENGLISH'
  | 'ARABIC'
  | 'HINDI'
  | 'MALAYALAM'
  | 'TAMIL'
  | 'URDU'
  | 'FRENCH'
  | 'SPANISH'
  | 'GERMAN'
  | 'CHINESE'
  | 'JAPANESE'
  | 'KOREAN';

export interface SystemMetrics {
  cpuUsage: number; // percentage
  gpuUsage: number | null; // percentage, null when not measurable
  ramUsage: number; // percentage
  diskUsage: number; // percentage
  networkSpeed: number; // Mbps (measured rx+tx delta)
  temperature?: number | null; // Celsius
  storageFreeGb: number;
  gpuName?: string;
  cpuName?: string;
}

export type TaskStatus = 'PENDING' | 'RUNNING' | 'PAUSED' | 'WAITING_APPROVAL' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export interface TaskStep {
  id: string;
  name: string;
  status: 'WAITING' | 'IN_PROGRESS' | 'COMPLETE' | 'FAILED' | 'SKIPPED';
  progress: number;
  output?: string;
  error?: string;
}

export interface TaskItem {
  id: string;
  name: string;
  category: 'GAMING' | 'YOUTUBE' | 'SYSTEM' | 'RESEARCH' | 'GENERAL';
  status: TaskStatus;
  overallProgress: number;
  startedAt: string;
  estimatedCompletionAt?: string;
  currentStepIndex: number;
  steps: TaskStep[];
  logs: string[];
}

export interface GamingConcept {
  id: string;
  gameTitle: 'GTA V' | 'Red Dead Redemption 2' | 'Minecraft' | 'GTA Online' | string;
  conceptTitle: string;
  style: string;
  scriptOutline: string;
  gameplayPlan: string;
  commentaryStyle: string;
  targetDurationMin: number;
  recommendedHashtags: string[];
  originalityScore: number; // 0 - 100%
  createdAt: string;
}

export interface YouTubeChannelInfo {
  channelName: string;
  subscriberCount: number;
  videoCount: number;
  totalViews: number;
  isConnected: boolean;
  autoPublishMode: 'AUTO' | 'APPROVAL';
  publishSchedule: string[]; // e.g. ["Mon 18:00", "Wed 18:00", "Fri 18:00"]
}

export interface YouTubeVideoMetadata {
  id: string;
  title: string;
  description: string;
  tags: string[];
  thumbnailUrl?: string;
  scheduledTime?: string;
  status: 'DRAFT' | 'READY_FOR_APPROVAL' | 'QUEUED' | 'UPLOADING' | 'PUBLISHED' | 'FAILED';
}

export interface ToolDefinition {
  name: string;
  description: string;
  category: 'CORE' | 'MEDIA' | 'GAMING' | 'SYSTEM' | 'WEB';
  parameters: Record<string, any>;
}

export interface ChatMessage {
  id: string;
  sender: 'USER' | 'NEXUS' | 'SYSTEM';
  text: string;
  timestamp: string;
  language?: string;
  toolExecuted?: string;
  taskCreatedId?: string;
  toolResult?: any;
}

export interface MemoryRecord {
  id: string;
  category: 'preferences' | 'projects' | 'tasks' | 'conversation_summaries' | 'configuration';
  key: string;
  value: any;
  updatedAt: string;
}

export interface DevConsoleLog {
  id: string;
  timestamp: string;
  type: 'INTENT' | 'TOOL_CALL' | 'PROVIDER_LATENCY' | 'STATE_CHANGE' | 'ERROR' | 'MEMORY';
  message: string;
  data?: any;
}

export interface PermissionRequest {
  id: string;
  path: string;
  status: 'PENDING' | 'GRANTED' | 'DENIED';
  requestedAt: string;
}

export interface ConfirmationRequest {
  id: string;
  toolName: string;
  params: Record<string, any>;
  summary: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  requestedAt: string;
  resolvedAt?: string;
  result?: any;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  action: string;
  detail: string;
  outcome: 'SUCCESS' | 'FAILURE' | 'PENDING';
}
