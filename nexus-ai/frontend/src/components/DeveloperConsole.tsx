import React from 'react';
import { X, Terminal, Trash2, Cpu, Zap } from 'lucide-react';
import { DevConsoleLog } from '../types';

interface DeveloperConsoleProps {
  isOpen: boolean;
  onClose: () => void;
  logs: DevConsoleLog[];
  onClearLogs: () => void;
}

export const DeveloperConsole: React.FC<DeveloperConsoleProps> = ({
  isOpen,
  onClose,
  logs,
  onClearLogs
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-[450px] hud-glass-header border-l border-cyan-500/30 z-50 flex flex-col shadow-2xl backdrop-blur-2xl font-mono select-none">
      {/* Console Header */}
      <div className="h-14 px-4 border-b border-cyan-500/20 flex items-center justify-between bg-slate-950/80">
        <div className="flex items-center gap-2 text-cyan-300">
          <Terminal className="w-4 h-4 text-cyan-400" />
          <span className="font-orbitron font-bold text-sm tracking-wider">NEXUS DEV CONSOLE</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onClearLogs}
            className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-all"
            title="Clear logs"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-cyan-300 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Logs Feed */}
      <div className="flex-1 p-4 overflow-y-auto space-y-2 text-xs">
        {logs.length === 0 ? (
          <div className="h-full flex items-center justify-center text-slate-600 text-xs italic">
            No developer events logged yet...
          </div>
        ) : (
          logs.map((log) => (
            <div key={log.id} className="p-2.5 rounded bg-slate-950/90 border border-slate-900 space-y-1">
              <div className="flex items-center justify-between text-[10px]">
                <span className={`font-bold px-1.5 py-0.2 rounded ${
                  log.type === 'INTENT' ? 'bg-cyan-500/20 text-cyan-300' :
                  log.type === 'TOOL_CALL' ? 'bg-fuchsia-500/20 text-fuchsia-300' :
                  log.type === 'PROVIDER_LATENCY' ? 'bg-emerald-500/20 text-emerald-300' :
                  log.type === 'STATE_CHANGE' ? 'bg-amber-500/20 text-amber-300' : 'bg-slate-800 text-slate-300'
                }`}>
                  [{log.type}]
                </span>
                <span className="text-slate-500">{new Date(log.timestamp).toLocaleTimeString([], { hour12: false, minute: '2-digit', second: '2-digit' })}</span>
              </div>
              <p className="text-slate-200 break-words">{log.message}</p>
              {log.data && (
                <pre className="text-[10px] text-cyan-400/80 bg-slate-900 p-1.5 rounded overflow-x-auto">
                  {JSON.stringify(log.data, null, 2)}
                </pre>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
