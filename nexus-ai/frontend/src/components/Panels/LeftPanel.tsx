import React, { useState, useRef, useEffect } from 'react';
import { useNexusStore } from '../../store/nexusStore';
import { api, NexusError } from '../../services/api';
import { TaskItem } from '../../types';
import { MessageSquare, ListTodo, Activity, ChevronDown, ChevronRight, Pause, Play, XCircle, Cpu } from 'lucide-react';

const STATUS_COLOR: Record<string, string> = {
  RUNNING: 'text-cyan-300', PAUSED: 'text-amber-300', COMPLETED: 'text-emerald-400',
  FAILED: 'text-red-400', CANCELLED: 'text-slate-500', PENDING: 'text-slate-300', WAITING_APPROVAL: 'text-fuchsia-300'
};

function TaskCard({ task }: { task: TaskItem }) {
  const [open, setOpen] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const setError = useNexusStore(s => s.setError);
  const act = async (action: 'pause' | 'resume' | 'cancel') => {
    try { await api.post(`/api/tasks/${task.id}/${action}`); }
    catch (e) { if (e instanceof NexusError) setError({ message: e.message, details: e.details, retry: () => act(action) }); }
  };
  return (
    <div className="hud-panel p-3 space-y-2">
      <div className="flex items-center justify-between cursor-pointer" onClick={() => setOpen(!open)}>
        <div className="flex items-center gap-2 min-w-0">
          {open ? <ChevronDown className="w-3.5 h-3.5 text-cyan-400 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-cyan-400 shrink-0" />}
          <span className="text-sm font-rajdhani font-semibold text-slate-100 truncate">{task.name}</span>
        </div>
        <span className={`text-[10px] font-orbitron ${STATUS_COLOR[task.status] || 'text-slate-300'}`}>{task.status}</span>
      </div>
      <div className="h-1.5 rounded bg-slate-800 overflow-hidden">
        <div className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-500" style={{ width: `${task.overallProgress}%` }} />
      </div>
      <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
        <span>{Math.round(task.overallProgress)}%</span>
        <span>started {new Date(task.startedAt).toLocaleTimeString([], { hour12: false })}</span>
        <span>step {Math.min(task.currentStepIndex + 1, task.steps.length)}/{task.steps.length}</span>
      </div>
      {open && (
        <>
          <div className="space-y-1 pt-1">
            {task.steps.map((s, i) => (
              <div key={s.id} className="flex items-center text-[11px] font-mono">
                <span className={`w-2 h-2 rounded-full mr-2 shrink-0 ${
                  s.status === 'COMPLETE' ? 'bg-emerald-400' : s.status === 'IN_PROGRESS' ? 'bg-cyan-400 animate-pulse' :
                  s.status === 'FAILED' ? 'bg-red-500' : s.status === 'SKIPPED' ? 'bg-amber-400' : 'bg-slate-600'
                }`} />
                <span className="text-slate-300 whitespace-nowrap">{s.name}</span>
                <span className="flex-1 mx-2 border-b border-dotted border-slate-700" />
                <span className="text-slate-500">{s.status === 'SKIPPED' ? 'SKIP' : `${Math.round(s.progress)}%`}</span>
                {i === task.currentStepIndex && task.status === 'RUNNING' && <span className="ml-1 text-cyan-500">◂</span>}
              </div>
            ))}
          </div>
          <div className="flex gap-1.5 pt-1">
            {task.status === 'RUNNING' && <button onClick={() => act('pause')} className="hud-btn-mini"><Pause className="w-3 h-3" />Pause</button>}
            {task.status === 'PAUSED' && <button onClick={() => act('resume')} className="hud-btn-mini"><Play className="w-3 h-3" />Resume</button>}
            {(task.status === 'RUNNING' || task.status === 'PAUSED' || task.status === 'PENDING') &&
              <button onClick={() => act('cancel')} className="hud-btn-mini text-red-400 border-red-500/30"><XCircle className="w-3 h-3" />Cancel</button>}
            <button onClick={() => setShowLogs(!showLogs)} className="hud-btn-mini ml-auto">Logs</button>
          </div>
          {showLogs && (
            <pre className="max-h-32 overflow-y-auto text-[10px] font-mono text-cyan-200/70 bg-slate-950/60 rounded p-2 whitespace-pre-wrap">
              {task.logs.join('\n')}
            </pre>
          )}
        </>
      )}
    </div>
  );
}

function GaugeRow({ label, value }: { label: string; value: number | null | undefined }) {
  const v = typeof value === 'number' ? value : null;
  return (
    <div className="flex items-center justify-between text-xs font-mono">
      <span className="text-slate-400 w-12">{label}</span>
      <div className="flex-1 mx-3 h-1.5 rounded bg-slate-800 overflow-hidden">
        <div className={`h-full transition-all duration-700 ${v !== null && v > 85 ? 'bg-red-400' : 'bg-cyan-400'}`} style={{ width: `${v ?? 0}%` }} />
      </div>
      <span className="text-cyan-300 w-14 text-right">{v !== null ? `${v}%` : 'N/A'}</span>
    </div>
  );
}

export const LeftPanel: React.FC = () => {
  const [tab, setTab] = useState<'chat' | 'tasks' | 'system'>('chat');
  const messages = useNexusStore(s => s.messages);
  const tasks = useNexusStore(s => s.tasks);
  const metrics = useNexusStore(s => s.metrics);
  const aiState = useNexusStore(s => s.aiState);
  const typingMessageId = useNexusStore(s => s.typingMessageId);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="hud-panel corner-brackets flex flex-col h-full overflow-hidden w-[clamp(300px,26vw,420px)]">
      <div className="flex border-b border-cyan-500/15">
        {([['chat', MessageSquare, 'CONVERSATION'], ['tasks', ListTodo, 'TASKS'], ['system', Activity, 'SYSTEM']] as const).map(([id, Icon, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[10px] font-orbitron tracking-wider transition-colors ${tab === id ? 'text-cyan-300 border-b-2 border-cyan-400 bg-cyan-500/5' : 'text-slate-500 hover:text-slate-300'}`}>
            <Icon className="w-3.5 h-3.5" />{label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {tab === 'chat' && (
          <div ref={scrollRef} className="space-y-3 h-full overflow-y-auto">
            {messages.map(m => (
              <div key={m.id} className={`flex flex-col ${m.sender === 'USER' ? 'items-end' : 'items-start'}`}>
                <div className={`max-w-[90%] rounded-lg px-3 py-2 text-sm font-rajdhani ${m.sender === 'USER' ? 'bg-cyan-500/15 text-cyan-50 border border-cyan-500/25' : 'bg-slate-800/50 text-slate-100 border border-slate-700/50'}`}
                  dir={m.language === 'ARABIC' || m.language === 'URDU' ? 'rtl' : 'ltr'}>
                  {m.text}
                </div>
                <div className="flex gap-1.5 mt-0.5 text-[9px] font-mono text-slate-500">
                  <span>{m.sender}</span>
                  <span>{new Date(m.timestamp).toLocaleTimeString([], { hour12: false })}</span>
                  {m.language && <span className="text-cyan-500/70">{m.language}</span>}
                  {m.toolExecuted && <span className="text-fuchsia-400/80">⚙ {m.toolExecuted}</span>}
                </div>
              </div>
            ))}
            {(aiState === 'THINKING' || typingMessageId) && (
              <div className="flex gap-1 items-center text-cyan-400/70 text-xs font-mono pl-1">
                <span className="animate-bounce">●</span><span className="animate-bounce" style={{ animationDelay: '0.15s' }}>●</span><span className="animate-bounce" style={{ animationDelay: '0.3s' }}>●</span>
              </div>
            )}
          </div>
        )}

        {tab === 'tasks' && (
          <div className="space-y-2">
            {tasks.length === 0 && <p className="text-xs text-slate-500 italic text-center py-8">No tasks. Ask NEXUS to create a gaming video.</p>}
            {tasks.map(t => <TaskCard key={t.id} task={t} />)}
          </div>
        )}

        {tab === 'system' && (
          <div className="space-y-4 pt-2">
            {!metrics && <p className="text-xs text-slate-500 italic text-center py-8">Waiting for telemetry…</p>}
            {metrics && (
              <>
                <GaugeRow label="CPU" value={metrics.cpuUsage} />
                <GaugeRow label="GPU" value={metrics.gpuUsage} />
                <GaugeRow label="RAM" value={metrics.ramUsage} />
                <GaugeRow label="DISK" value={metrics.diskUsage} />
                <div className="grid grid-cols-2 gap-2 pt-2 text-[11px] font-mono">
                  <div className="hud-panel p-2"><span className="text-slate-500">NET</span><div className="text-cyan-300">{metrics.networkSpeed.toFixed(2)} Mbps</div></div>
                  <div className="hud-panel p-2"><span className="text-slate-500">FREE</span><div className="text-cyan-300">{metrics.storageFreeGb} GB</div></div>
                  <div className="hud-panel p-2"><span className="text-slate-500">TEMP</span><div className="text-cyan-300">{metrics.temperature != null ? `${metrics.temperature}°C` : 'not reported by OS'}</div></div>
                  <div className="hud-panel p-2 col-span-2"><span className="text-slate-500">CPU</span><div className="text-cyan-300 truncate">{metrics.cpuName || 'not reported by OS'}</div></div>
                  <div className="hud-panel p-2 col-span-2"><span className="text-slate-500">GPU</span><div className="text-cyan-300 truncate">{metrics.gpuName || 'not reported by OS'}</div></div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export { GaugeRow };
