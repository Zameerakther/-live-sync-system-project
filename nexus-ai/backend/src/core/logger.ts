import fs from 'fs';
import path from 'path';

export type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';

export class Logger {
  private logDir: string;
  private logFile: string;

  constructor(logDir?: string) {
    this.logDir = logDir || path.join(getStorageDir(), 'Logs');
    fs.mkdirSync(this.logDir, { recursive: true });
    const date = new Date().toISOString().slice(0, 10);
    this.logFile = path.join(this.logDir, `nexus-${date}.log`);
  }

  private write(level: LogLevel, message: string, meta?: any) {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...(meta !== undefined ? { meta } : {})
    };
    const line = JSON.stringify(entry);
    try {
      fs.appendFileSync(this.logFile, line + '\n');
    } catch { /* console only */ }
    const consoleFn = level === 'ERROR' ? console.error : level === 'WARN' ? console.warn : console.log;
    consoleFn(`[${level}] ${message}`, meta instanceof Error ? meta.stack : meta ?? '');
  }

  info(message: string, meta?: any) { this.write('INFO', message, meta); }
  warn(message: string, meta?: any) { this.write('WARN', message, meta); }
  error(message: string, meta?: any) { this.write('ERROR', message, meta); }
  debug(message: string, meta?: any) { if (process.env.NODE_ENV === 'development') this.write('DEBUG', message, meta); }
}

export function getStorageDir(): string {
  return process.env.NEXUS_STORAGE_DIR || path.join(require('os').homedir(), 'NexusAI');
}

let loggerInstance: Logger | null = null;
export function getLogger(): Logger {
  if (!loggerInstance) loggerInstance = new Logger();
  return loggerInstance;
}

export function friendlyError(doing: string, err: any): { error: string; details?: string } {
  getLogger().error(`Error while ${doing}`, err);
  const res: { error: string; details?: string } = {
    error: `NEXUS encountered a problem while ${doing}.`
  };
  if (process.env.NODE_ENV === 'development') {
    res.details = err?.message || String(err);
  }
  return res;
}
