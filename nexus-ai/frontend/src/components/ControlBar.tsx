import React, { useState } from 'react';
import { Mic, MicOff, Send, Globe, Radio, Square, Ear } from 'lucide-react';
import { useNexusStore } from '../store/nexusStore';
import { LANGUAGES } from '../constants';
import { SupportedLanguage } from '../types';

interface Props {
  onToggleMic: () => void;
  onToggleWakeMode: () => void;
  onStopSpeaking: () => void;
  onSendMessage: (text: string) => void;
}

export const ControlBar: React.FC<Props> = ({ onToggleMic, onToggleWakeMode, onStopSpeaking, onSendMessage }) => {
  const micActive = useNexusStore(s => s.micActive);
  const pttActive = useNexusStore(s => s.pttActive);
  const speaking = useNexusStore(s => s.speaking);
  const language = useNexusStore(s => s.language);
  const wakeWord = useNexusStore(s => s.wakeWord);
  const aiState = useNexusStore(s => s.aiState);
  const set = useNexusStore(s => s.set);
  const [wakeMode, setWakeMode] = useState(false);
  const [input, setInput] = useState('');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    onSendMessage(input);
    setInput('');
  };

  const statusText = speaking ? 'SPEAKING — talk to barge in'
    : pttActive ? 'PUSH-TO-TALK active'
    : wakeMode ? `Listening for "${wakeWord}"…`
    : micActive ? 'Listening…' : 'Mic off';

  return (
    <div className="w-full hud-glass border-t border-cyan-500/20 px-4 md:px-6 py-3 flex items-center gap-3 md:gap-4 z-30 select-none shrink-0">
      <div className="flex items-center gap-2.5">
        <button
          onClick={onToggleMic}
          className={`relative p-3 rounded-full border transition-all duration-300 ${
            pttActive
              ? 'bg-cyan-500 text-slate-950 border-cyan-300 shadow-[0_0_25px_rgba(0,240,255,0.8)]'
              : 'bg-slate-900/80 text-cyan-400 border-cyan-500/30 hover:border-cyan-400'
          }`}
          title="Push-to-talk (Ctrl+Space)"
        >
          {pttActive && <span className="absolute inset-0 rounded-full border-2 border-cyan-300 animate-ping" />}
          {pttActive ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
        </button>

        <button onClick={() => { setWakeMode(!wakeMode); onToggleWakeMode(); }}
          className={`p-2.5 rounded-full border transition-all ${wakeMode ? 'bg-fuchsia-500/20 border-fuchsia-400/60 text-fuchsia-300' : 'bg-slate-900/80 border-slate-700 text-slate-500 hover:text-slate-300'}`}
          title="Toggle wake-word mode">
          <Ear className="w-4 h-4" />
        </button>

        {speaking && (
          <button onClick={onStopSpeaking}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-500/20 border border-red-500/50 text-red-400 text-[10px] font-orbitron hover:bg-red-500/30">
            <Square className="w-3 h-3 fill-red-400" />STOP
          </button>
        )}
      </div>

      <div className="hidden md:flex flex-col text-[9px] font-mono leading-tight w-36">
        <span className="text-slate-500 flex items-center gap-1"><Radio className={`w-3 h-3 ${micActive ? 'text-red-400 animate-pulse' : 'text-slate-600'}`} />{statusText}</span>
        <span className="text-cyan-500/70">WAKE: "{wakeWord}" · {aiState}</span>
      </div>

      <form onSubmit={submit} className="flex-1 max-w-3xl mx-auto">
        <div className="relative flex items-center">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder='Command NEXUS — "create a gaming video", "search GTA 6 news", "open youtube"…'
            className="w-full h-11 pl-4 pr-12 rounded-xl bg-slate-950/80 border border-cyan-500/30 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-400 focus:shadow-[0_0_15px_rgba(0,240,255,0.25)] text-sm font-rajdhani transition-all"
          />
          <button type="submit" disabled={!input.trim()}
            className="absolute right-1.5 p-2 rounded-lg bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/40 disabled:opacity-40 transition-all">
            <Send className="w-4 h-4" />
          </button>
        </div>
      </form>

      <div className="flex items-center gap-2">
        <Globe className="w-4 h-4 text-cyan-400 hidden sm:block" />
        <select value={language} onChange={e => set({ language: e.target.value as SupportedLanguage })}
          className="h-9 px-2 md:px-3 rounded-lg bg-slate-950/80 border border-cyan-500/30 text-cyan-300 text-[10px] font-orbitron uppercase focus:outline-none focus:border-cyan-400 cursor-pointer">
          {LANGUAGES.map(l => <option key={l} value={l} className="bg-slate-900">{l}</option>)}
        </select>
      </div>
    </div>
  );
};
