import React, { useState, useEffect } from 'react';
import { Cpu, Wifi, Terminal, Shield, Clock } from 'lucide-react';

interface HUDHeaderProps {
  wsConnected: boolean;
  onToggleDevConsole: () => void;
  devLogsCount: number;
}

export const HUDHeader: React.FC<HUDHeaderProps> = ({
  wsConnected,
  onToggleDevConsole,
  devLogsCount
}) => {
  const [currentTime, setCurrentTime] = useState<string>('');

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('en-US', { hour12: false }) + ' UTC');
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="w-full h-14 hud-glass-header px-6 flex items-center justify-between z-30 select-none">
      {/* Brand & Identity */}
      <div className="flex items-center gap-3">
        <div className="relative flex items-center justify-center w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-400/40 hud-glow-cyan">
          <Shield className="w-5 h-5 text-cyan-400 animate-pulse" />
        </div>
        <div>
          <h1 className="font-orbitron font-extrabold text-lg tracking-wider text-slate-100 flex items-center gap-2">
            NEXUS <span className="text-cyan-400 font-normal">AI OS</span>
          </h1>
          <p className="text-[10px] text-cyan-400/70 font-mono tracking-widest uppercase">Autonomous Operating System v2.0</p>
        </div>
      </div>

      {/* System Status Indicators */}
      <div className="flex items-center gap-6 text-xs font-mono">
        {/* Connection Gateway */}
        <div className="flex items-center gap-2 px-3 py-1 rounded bg-slate-900/60 border border-slate-800">
          <Wifi className={`w-3.5 h-3.5 ${wsConnected ? 'text-emerald-400' : 'text-amber-400 animate-pulse'}`} />
          <span className="text-slate-400">LINK:</span>
          <span className={wsConnected ? 'text-emerald-400 font-bold' : 'text-amber-400'}>
            {wsConnected ? 'SECURE' : 'CONNECTING...'}
          </span>
        </div>

        {/* Live Clock */}
        <div className="flex items-center gap-2 px-3 py-1 rounded bg-slate-900/60 border border-slate-800">
          <Clock className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-cyan-300 font-bold font-orbitron tracking-wider">{currentTime}</span>
        </div>

        {/* System Core Load Status */}
        <div className="flex items-center gap-2 px-3 py-1 rounded bg-slate-900/60 border border-slate-800">
          <Cpu className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-slate-400">CORE:</span>
          <span className="text-cyan-400 font-semibold">NOMINAL</span>
        </div>
      </div>

      {/* Developer Console Toggle */}
      <button
        onClick={onToggleDevConsole}
        className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-400/40 text-cyan-300 text-xs font-orbitron transition-all"
      >
        <Terminal className="w-4 h-4 text-cyan-400" />
        <span>DEV CONSOLE</span>
        {devLogsCount > 0 && (
          <span className="px-1.5 py-0.2 rounded-full bg-cyan-500 text-slate-950 font-bold text-[10px]">
            {devLogsCount}
          </span>
        )}
      </button>
    </header>
  );
};
