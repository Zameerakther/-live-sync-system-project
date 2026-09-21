import React, { useState } from 'react';
import { MessageSquare, ListTodo, Activity, Cpu, HardDrive, Wifi, ShieldAlert, CheckCircle2, Play, Square } from 'lucide-react';
import { ChatMessage, TaskItem, SystemMetrics } from '../../types';

interface LeftPanelProps {
  messages: ChatMessage[];
  tasks: TaskItem[];
  metrics: SystemMetrics;
  onCancelTask: (id: string) => void;
}

export const LeftPanel: React.FC<LeftPanelProps> = ({
  messages,
  tasks,
  metrics,
  onCancelTask
}) => {
  const [activeTab, setActiveTab] = useState<'CHAT' | 'TASKS' | 'SYSTEM'>('CHAT');

  return (
    <div className="w-80 h-full hud-glass rounded-2xl flex flex-col overflow-hidden border border-cyan-500/20 select-none">
      {/* Panel Tab Buttons */}
      <div className="flex items-center justify-between border-b border-cyan-500/20 bg-slate-950/50 p-1.5">
        <button
          onClick={() => setActiveTab('CHAT')}
          className={`flex-1 py-1.5 rounded-lg text-xs font-orbitron flex items-center justify-center gap-1.5 transition-all ${
            activeTab === 'CHAT' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/40' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span>CHAT</span>
        </button>
        <button
          onClick={() => setActiveTab('TASKS')}
          className={`flex-1 py-1.5 rounded-lg text-xs font-orbitron flex items-center justify-center gap-1.5 transition-all ${
            activeTab === 'TASKS' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/40' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <ListTodo className="w-3.5 h-3.5" />
          <span>TASKS ({tasks.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('SYSTEM')}
          className={`flex-1 py-1.5 rounded-lg text-xs font-orbitron flex items-center justify-center gap-1.5 transition-all ${
            activeTab === 'SYSTEM' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/40' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          <span>SYSTEM</span>
        </button>
      </div>

      {/* Tab Content Body */}
      <div className="flex-1 p-4 overflow-y-auto space-y-4">
        {/* TAB 1: CONVERSATION FEED */}
        {activeTab === 'CHAT' && (
          <div className="space-y-3">
            {messages.map((msg) => {
              const isRtl = msg.language === 'ARABIC' || msg.language === 'URDU';
              const isUser = msg.sender === 'USER';
              return (
                <div
                  key={msg.id}
                  className={`p-3 rounded-xl border text-xs leading-relaxed transition-all ${
                    isUser
                      ? 'bg-cyan-950/40 border-cyan-500/30 text-cyan-100 ml-4'
                      : 'bg-slate-900/80 border-slate-800 text-slate-200 mr-4'
                  }`}
                  dir={isRtl ? 'rtl' : 'ltr'}
                >
                  <div className="flex items-center justify-between mb-1.5 text-[10px] font-mono text-cyan-400/70">
                    <span className="font-bold">{msg.sender}</span>
                    <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <p className="font-sans">{msg.text}</p>
                  {msg.toolExecuted && (
                    <div className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/30 text-[10px] font-mono text-cyan-300">
                      <span>TOOL:</span>
                      <span className="font-bold">{msg.toolExecuted}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* TAB 2: TASK MANAGER */}
        {activeTab === 'TASKS' && (
          <div className="space-y-4">
            {tasks.map((task) => (
              <div key={task.id} className="p-3 rounded-xl bg-slate-950/80 border border-cyan-500/20 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-orbitron font-semibold text-cyan-300 truncate max-w-[180px]">
                    {task.name}
                  </span>
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                    task.status === 'RUNNING' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse' :
                    task.status === 'COMPLETED' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' :
                    'bg-slate-800 text-slate-400'
                  }`}>
                    {task.status}
                  </span>
                </div>

                {/* Overall Progress Bar */}
                <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden border border-cyan-500/20">
                  <div
                    className="bg-gradient-to-r from-cyan-500 to-blue-500 h-full transition-all duration-500"
                    style={{ width: `${task.overallProgress}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                  <span>PROGRESS: {task.overallProgress}%</span>
                  {task.status === 'RUNNING' && (
                    <button
                      onClick={() => onCancelTask(task.id)}
                      className="text-red-400 hover:text-red-300 flex items-center gap-0.5"
                    >
                      <Square className="w-2.5 h-2.5" /> CANCEL
                    </button>
                  )}
                </div>

                {/* Steps Accordion / Details */}
                <div className="pt-2 border-t border-slate-900 space-y-1">
                  {task.steps.map((step) => (
                    <div key={step.id} className="flex items-center justify-between text-[11px]">
                      <span className={`truncate max-w-[200px] ${
                        step.status === 'COMPLETE' ? 'text-slate-400 line-through' :
                        step.status === 'IN_PROGRESS' ? 'text-cyan-300 font-semibold' : 'text-slate-600'
                      }`}>
                        {step.name}
                      </span>
                      {step.status === 'COMPLETE' && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
                      {step.status === 'IN_PROGRESS' && <span className="text-[10px] font-mono text-cyan-400">{step.progress}%</span>}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* TAB 3: SYSTEM HARDWARE STATUS */}
        {activeTab === 'SYSTEM' && (
          <div className="space-y-4">
            {/* CPU Metric */}
            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
              <div className="flex items-center justify-between text-xs font-mono text-slate-300">
                <span className="flex items-center gap-1.5"><Cpu className="w-4 h-4 text-cyan-400" /> CPU USAGE</span>
                <span className="font-bold text-cyan-400">{metrics.cpuUsage}%</span>
              </div>
              <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden">
                <div className="bg-cyan-400 h-full transition-all duration-500" style={{ width: `${metrics.cpuUsage}%` }} />
              </div>
            </div>

            {/* GPU Metric */}
            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
              <div className="flex items-center justify-between text-xs font-mono text-slate-300">
                <span className="flex items-center gap-1.5"><Activity className="w-4 h-4 text-fuchsia-400" /> GPU PIPELINE</span>
                <span className="font-bold text-fuchsia-400">{metrics.gpuUsage}%</span>
              </div>
              <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden">
                <div className="bg-fuchsia-400 h-full transition-all duration-500" style={{ width: `${metrics.gpuUsage}%` }} />
              </div>
            </div>

            {/* RAM Metric */}
            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
              <div className="flex items-center justify-between text-xs font-mono text-slate-300">
                <span className="flex items-center gap-1.5"><HardDrive className="w-4 h-4 text-amber-400" /> RAM MEMORY</span>
                <span className="font-bold text-amber-400">{metrics.ramUsage}%</span>
              </div>
              <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden">
                <div className="bg-amber-400 h-full transition-all duration-500" style={{ width: `${metrics.ramUsage}%` }} />
              </div>
            </div>

            {/* Network Metric */}
            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between text-xs font-mono">
              <span className="flex items-center gap-1.5 text-slate-300"><Wifi className="w-4 h-4 text-emerald-400" /> NETWORK SPEED</span>
              <span className="font-bold text-emerald-400">{metrics.networkSpeed} Mbps</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
