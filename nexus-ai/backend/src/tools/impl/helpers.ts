import { PermissionManager, ConfirmationManager } from '../../core/permissions';
import { SystemMonitorModule } from '../../modules/system';
import { GamingModule } from '../../modules/gaming';
import { YouTubeModule } from '../../modules/youtube';
import { TaskRunnerModule } from '../../modules/tasks';
import { MemoryManager } from '../../modules/memory';
import { AIProvider } from '../../ai/provider';
import { ToolExecutionResult } from '../registry';

export interface ToolContext {
  permissions: PermissionManager;
  confirmations: ConfirmationManager;
  systemMonitor: SystemMonitorModule;
  gaming: GamingModule;
  youtube: YouTubeModule;
  taskRunner: TaskRunnerModule;
  memory: MemoryManager;
  getProvider: () => AIProvider;
  broadcast: (type: string, data: any) => void;
  devLog: (type: string, message: string, data?: any) => void;
}

export function ok(toolName: string, resultData: any, message: string): ToolExecutionResult {
  return { success: true, toolName, resultData, message };
}

export function fail(toolName: string, message: string, resultData: any = null): ToolExecutionResult {
  return { success: false, toolName, resultData, message };
}
