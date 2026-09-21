import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Terminal, Trash2, ChevronRight, ChevronDown } from 'lucide-react';
import { useNexusStore } from '../store/nexusStore';
import { DevConsoleLog } from '../types';

const TYPES = ['ALL', 'INTENT', 'TOOL_CALL', 'PROVIDER_LATENCY', 'STATE_CHANGE', 'ERROR', 'MEMORY'];
const TYPE_COLOR: Record<string, string> = {
  INTENT: 'bg-cyan-500/20 text-cyan-300',
  TOOL_CALL: 'bg-fuchsia-500/20 text-fuchsia-300',
  PROVIDER_LATENCY: 'bg-emerald-500/20 text-emerald-300',
  STATE_CHANGE: 'bg-amber-500/20 text-amber-300',
  ERROR: 'bg-red-500/20 text-red-300',
  MEMORY: 'bg-blue-500/20 text-blue-300'
};

function LogEntry({ log }: { log: DevConsoleLog }) {
  const [expand, setExpand] = useState(false);
  const latency = log.type === 'PROVIDER_LATENCY' ? log.message.match(/(\d+)ms/)?.[1] : null;
  return (
    <div className="p-2.5 rounded bg-slate-950/90 border border-slate-900 space-y-1">
      <div className="flex items-center justify-between text-[10px]">
        <div className="flex items-center gap-2">
          <span className={`font-bold px-1.5 rounded ${TYPE_COLOR[log.type] || 'bg-slate-800 text-slate-300'}`}>[{log.type}]</span>
          {latency && <span className="text-emerald-400/80">{latency}ms</span>}
        </div>
        <span className="text-slate-500">{new Date(log.timestamp).toLocaleTimeString([], { hour12: false })}</span>
      </div>
      <p className="text-slate-200 break-words">{log.message}</p>
      {log.data !== undefined && (
        <div>
          <button onClick={() => setExpand(!expand)} className="flex items-center gap-0.5 text-[9px] text-cyan-500/70 hover:text-cyan-300">
            {expand ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}data
          </button>
          {expand && (
            <pre className="text-[10px] text-cyan-400/80 bg-slate-900 p-1.5 rounded overflow-x-auto mt-1">
              {JSON.stringify(log.data, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

export const DeveloperConsole: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const logs = useNexusStore(s => s.devLogs);
  const set = useNexusStore(s => s.set);
  const [filter, setFilter] = useState('ALL');
  const filtered = filter === 'ALL' ? logs : logs.filter(l => l.type === filter);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div initial={{ x: 460 }} animate={{ x: 0 }} exit={{ x: 460 }} transition={{ type: 'tween', duration: 0.25 }}
          className="fixed inset-y-0 right-0 w-[min(450px,95vw)] hud-glass-header border-l border-cyan-500/30 z-[70] flex flex-col font-mono">
          <div className="h-14 px-4 border-b border-cyan-500/20 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2 text-cyan-300">
              <Terminal className="w-4 h-4" />
              <span className="font-orbitron font-bold text-sm tracking-wider">DEV CONSOLE</span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => set({ devLogs: [] })} className="p-1.5 rounded hover:bg-slate-800 text-slate-400"><Trash2 className="w-4 h-4" /></button>
              <button onClick={onClose} className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-cyan-300"><X className="w-5 h-5" /></button>
            </div>
          </div>
          <div className="flex gap-1 px-3 py-2 border-b border-slate-800/60 overflow-x-auto shrink-0">
            {TYPES.map(t => (
              <button key={t} onClick={() => setFilter(t)}
                className={`px-2 py-0.5 rounded text-[9px] font-orbitron whitespace-nowrap ${filter === t ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-500 hover:text-slate-300'}`}>
                {t}
              </button>
            ))}
          </div>
          <div className="flex-1 p-3 overflow-y-auto space-y-2 text-xs">
            {filtered.length === 0
              ? <div className="h-full flex items-center justify-center text-slate-600 italic">No events.</div>
              : filtered.map(l => <LogEntry key={l.id} log={l} />)}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
