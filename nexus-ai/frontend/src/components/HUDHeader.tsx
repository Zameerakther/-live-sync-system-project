import React, { useState, useEffect } from 'react';
import { useNexusStore } from '../store/nexusStore';
import { Wifi, WifiOff, Terminal, Shield, Clock, Settings, PanelLeft, PanelRight } from 'lucide-react';

interface Props {
  onToggleDevConsole: () => void;
  onToggleSettings: () => void;
  onToggleLeftDrawer?: () => void;
  onToggleRightDrawer?: () => void;
}

export const HUDHeader: React.FC<Props> = ({ onToggleDevConsole, onToggleSettings, onToggleLeftDrawer, onToggleRightDrawer }) => {
  const wsConnected = useNexusStore(s => s.wsConnected);
  const micActive = useNexusStore(s => s.micActive);
  const devLogsCount = useNexusStore(s => s.devLogs.length);
  const provider = useNexusStore(s => s.settings?.provider) || 'mock';
  const [time, setTime] = useState('');

  useEffect(() => {
    const update = () => setTime(new Date().toLocaleTimeString([], { hour12: false }));
    update();
    const i = setInterval(update, 1000);
    return () => clearInterval(i);
  }, []);

  return (
    <header className="w-full h-14 hud-glass-header px-4 md:px-6 flex items-center justify-between z-30 select-none shrink-0">
      <div className="flex items-center gap-3">
        {onToggleLeftDrawer && (
          <button onClick={onToggleLeftDrawer} className="xl:hidden p-1.5 text-cyan-400 hover:text-cyan-300"><PanelLeft className="w-4 h-4" /></button>
        )}
        <div className="relative flex items-center justify-center w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-400/40 hud-glow-cyan">
          <Shield className="w-5 h-5 text-cyan-400 animate-pulse" />
        </div>
        <div>
          <h1 className="font-orbitron font-extrabold text-base md:text-lg tracking-wider text-slate-100">
            NEXUS <span className="text-cyan-400 font-normal">AI OS</span>
          </h1>
          <p className="hidden sm:block text-[9px] text-cyan-400/70 font-mono tracking-widest uppercase">Autonomous Operating System</p>
        </div>
      </div>

      <div className="flex items-center gap-3 md:gap-5 text-xs font-mono">
        <span className="hidden md:inline-flex px-2 py-0.5 rounded bg-slate-900/70 border border-slate-800 text-fuchsia-300 font-orbitron text-[10px] uppercase">{provider}</span>

        <div className="flex items-center gap-1.5" title={micActive ? 'Microphone active' : 'Microphone off'}>
          <span className={`w-2.5 h-2.5 rounded-full ${micActive ? 'bg-red-500 animate-pulse' : 'bg-slate-600'}`} />
          <span className="hidden sm:inline text-[10px] text-slate-500">MIC</span>
        </div>

        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-900/60 border border-slate-800">
          {wsConnected ? <Wifi className="w-3.5 h-3.5 text-emerald-400" /> : <WifiOff className="w-3.5 h-3.5 text-red-400 animate-pulse" />}
          <span className={wsConnected ? 'text-emerald-400 font-bold text-[10px]' : 'text-red-400 text-[10px]'}>
            {wsConnected ? 'LINK SECURE' : 'LINK LOST — reconnecting'}
          </span>
        </div>

        <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded bg-slate-900/60 border border-slate-800">
          <Clock className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-cyan-300 font-bold font-orbitron tracking-wider text-[11px]">{time}</span>
        </div>

        <button onClick={onToggleDevConsole}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-400/40 text-cyan-300 text-[10px] font-orbitron transition-all">
          <Terminal className="w-3.5 h-3.5" /><span className="hidden md:inline">DEV</span>
          {devLogsCount > 0 && <span className="px-1 rounded-full bg-cyan-500 text-slate-950 font-bold text-[9px]">{devLogsCount}</span>}
        </button>
        <button onClick={onToggleSettings}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800/60 hover:bg-slate-700/60 border border-slate-600/50 text-slate-300 text-[10px] font-orbitron transition-all">
          <Settings className="w-3.5 h-3.5" /><span className="hidden md:inline">SETTINGS</span>
        </button>
        {onToggleRightDrawer && (
          <button onClick={onToggleRightDrawer} className="xl:hidden p-1.5 text-cyan-400 hover:text-cyan-300"><PanelRight className="w-4 h-4" /></button>
        )}
      </div>
    </header>
  );
};
