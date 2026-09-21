import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HUDHeader } from './components/HUDHeader';
import { ControlBar } from './components/ControlBar';
import { AICore } from './components/AICore';
import { LeftPanel } from './components/Panels/LeftPanel';
import { RightPanel } from './components/Panels/RightPanel';
import { DeveloperConsole } from './components/DeveloperConsole';
import { SettingsPanel } from './components/SettingsPanel';
import { Modals } from './components/Modals/Modals';
import { ToastStack } from './components/Toasts';
import { VoiceEngine } from './services/voiceEngine';
import { connectWS, setVoiceEngineRef } from './services/ws';
import { api, NexusError } from './services/api';
import { useNexusStore } from './store/nexusStore';
import { ChatMessage } from './types';

const RESEARCH_STEPS = ['SEARCHING', 'ANALYZING', 'VERIFYING', 'COMPLETE'];

function ResearchStepper() {
  const rs = useNexusStore(s => s.researchStatus);
  if (!rs) return null;
  const idx = RESEARCH_STEPS.indexOf(rs.status);
  return (
    <div className="flex items-center gap-1.5 text-[9px] font-orbitron">
      {RESEARCH_STEPS.map((s, i) => (
        <React.Fragment key={s}>
          <span className={i <= idx ? 'text-cyan-300' : 'text-slate-600'}>{s}</span>
          {i < RESEARCH_STEPS.length - 1 && <span className={`w-4 border-t ${i < idx ? 'border-cyan-400' : 'border-slate-700 border-dotted'}`} />}
        </React.Fragment>
      ))}
    </div>
  );
}

function CornerGauge({ label, value, className }: { label: string; value: number | null | undefined; className: string }) {
  const v = typeof value === 'number' ? Math.min(100, Math.max(0, value)) : 0;
  const r = 26, circ = 2 * Math.PI * r;
  return (
    <div className={`absolute ${className} flex flex-col items-center`}>
      <svg width="72" height="72" viewBox="0 0 72 72" className="drop-shadow-[0_0_8px_rgba(0,240,255,0.3)]">
        <circle cx="36" cy="36" r={r} fill="none" stroke="#1a2e5a" strokeWidth="4" />
        <motion.circle cx="36" cy="36" r={r} fill="none" stroke={v > 85 ? '#ff2a2a' : '#00f0ff'} strokeWidth="4"
          strokeLinecap="round" strokeDasharray={circ}
          style={{ strokeDashoffset: circ * (1 - v / 100) }}
          animate={{ strokeDashoffset: circ * (1 - v / 100) }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          transform="rotate(-90 36 36)" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span className="text-[11px] font-orbitron text-cyan-200">{value == null ? '—' : `${Math.round(v)}`}</span>
        <span className="text-[8px] font-mono text-slate-500">{label}</span>
      </div>
    </div>
  );
}

function ActivityTicker() {
  const latest = useNexusStore(s => s.devLogs[0]);
  return (
    <div className="w-full max-w-2xl overflow-hidden hud-panel px-3 py-1 text-[10px] font-mono text-cyan-300/80 whitespace-nowrap">
      <span className="text-slate-500 mr-2">ACTIVITY&gt;</span>
      {latest ? <span className="inline-block animate-pulse">{latest.message}</span> : <span className="text-slate-600">Standing by…</span>}
    </div>
  );
}

export const App: React.FC = () => {
  const store = useNexusStore;
  const aiState = store(s => s.aiState);
  const set = store(s => s.set);
  const tasks = store(s => s.tasks);
  const metrics = store(s => s.metrics);
  const setError = store(s => s.setError);
  const pushMessage = store(s => s.pushMessage);
  const pushDevLog = store(s => s.pushDevLog);

  const [devOpen, setDevOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [leftOpen, setLeftOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);
  const [isMobileLayout, setIsMobileLayout] = useState(false);
  const voiceRef = useRef<VoiceEngine | null>(null);
  const typewriterTimer = useRef<any>(null);

  useEffect(() => {
    const check = () => setIsMobileLayout(window.innerWidth < 1100);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Voice engine init
  useEffect(() => {
    const ve = new VoiceEngine({
      onSpeechResult: (text) => sendMessage(text),
      onWakeWordDetected: (word) => pushDevLog({
        id: crypto.randomUUID(), timestamp: new Date().toISOString(), type: 'INTENT',
        message: `Wake word "${word}" detected.`
      }),
      onMicActiveChange: (active) => useNexusStore.getState().set({ micActive: active }),
      onSpeakingChange: (speaking) => useNexusStore.getState().set({ speaking })
    });
    voiceRef.current = ve;
    setVoiceEngineRef(ve);
    connectWS();
    fetchInitial();
    // Welcome message on first load
    if (useNexusStore.getState().messages.length === 0) {
      pushMessage({
        id: crypto.randomUUID(), sender: 'NEXUS',
        text: 'NEXUS online. Systems nominal. Say "Nexus" or press Ctrl+Space.',
        timestamp: new Date().toISOString()
      });
    }
    // Electron bridge (desktop app): global Ctrl+Space + native notifications
    const nx = (window as any).nexus;
    if (nx?.onToggleMic) nx.onToggleMic(() => toggleMic());
  }, []);

  // Sync language + wake word to voice engine
  const language = store(s => s.language);
  const wakeWord = store(s => s.wakeWord);
  useEffect(() => {
    voiceRef.current?.setLanguage(language);
    voiceRef.current?.setWakeWord(wakeWord);
  }, [language, wakeWord]);

  // Ctrl+Space toggles mic, Esc closes overlays
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.code === 'Space' && e.ctrlKey) { e.preventDefault(); toggleMic(); }
      if (e.key === 'Escape') { setDevOpen(false); setSettingsOpen(false); setLeftOpen(false); setRightOpen(false); setError(null); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  const fetchInitial = async () => {
    const safe = async <T,>(p: Promise<T>): Promise<T | null> => p.catch(() => null);
    const [tasks, concepts, ytInfo, ytQueue, tools, settings, memories] = await Promise.all([
      safe(api.get<any[]>('/api/tasks')),
      safe(api.get<any[]>('/api/gaming/concepts')),
      safe(api.get<any>('/api/youtube/info')),
      safe(api.get<any[]>('/api/youtube/queue')),
      safe(api.get<any[]>('/api/tools')),
      safe(api.get<any>('/api/settings')),
      safe(api.get<any[]>('/api/memory'))
    ]);
    const patch: any = {};
    if (Array.isArray(tasks)) patch.tasks = tasks;
    if (Array.isArray(concepts)) patch.concepts = concepts;
    if (ytInfo) patch.youtubeInfo = ytInfo;
    if (Array.isArray(ytQueue)) patch.youtubeQueue = ytQueue;
    if (Array.isArray(tools)) patch.tools = tools;
    if (settings) {
      patch.settings = settings;
      if (settings.wakeWord) patch.wakeWord = settings.wakeWord;
      if (settings.language) patch.language = settings.language;
    }
    if (Array.isArray(memories)) patch.memories = memories;
    set(patch);
  };

  /** Typewriter-animated NEXUS reply synced to TTS start (~30ms/char). */
  const typewriter = (msg: ChatMessage) => {
    const id = msg.id;
    set({ typingMessageId: id });
    pushMessage({ ...msg, text: '' });
    let i = 0;
    voiceRef.current?.speak(msg.text);
    clearInterval(typewriterTimer.current);
    typewriterTimer.current = setInterval(() => {
      i += 1;
      const partial = msg.text.slice(0, i);
      useNexusStore.getState().set({
        messages: useNexusStore.getState().messages.map(m => m.id === id ? { ...m, text: partial } : m)
      });
      if (i >= msg.text.length) {
        clearInterval(typewriterTimer.current);
        set({ typingMessageId: null });
      }
    }, 30);
  };

  const sendMessage = async (text: string) => {
    const lang = useNexusStore.getState().language;
    pushMessage({ id: crypto.randomUUID(), sender: 'USER', text, timestamp: new Date().toISOString(), language: lang });
    set({ aiState: 'THINKING' });
    try {
      const data = await api.chat(text, lang);
      if (data.replyMessage) {
        const reply: ChatMessage = { ...data.replyMessage, toolResult: data.toolResult };
        if (reply.language && reply.language !== 'AUTO' && reply.language !== lang && reply.language !== undefined) {
          // keep language in sync when user switched
          if (data.stateChange === 'SWITCH_LANGUAGE') set({ language: reply.language as any });
        }
        typewriter(reply);
      }
      if (data.devLogs) data.devLogs.forEach((l: any) => pushDevLog(l));
    } catch (e) {
      set({ aiState: 'ERROR' });
      setTimeout(() => { if (useNexusStore.getState().aiState === 'ERROR') set({ aiState: 'IDLE' }); }, 3000);
      if (e instanceof NexusError) {
        setError({ message: e.message, details: e.details, retry: () => sendMessage(text) });
      }
    }
  };

  const toggleMic = () => {
    const ve = voiceRef.current;
    if (!ve) return;
    if (useNexusStore.getState().pttActive) {
      ve.stopPTT();
      set({ pttActive: false });
    } else {
      ve.startPTT();
      set({ pttActive: true });
    }
  };

  const wakeModeRef = useRef(false);
  const toggleWakeMode = () => {
    wakeModeRef.current = !wakeModeRef.current;
    voiceRef.current?.setWakeWordMode(wakeModeRef.current);
  };

  const activeTask = tasks.find(t => t.status === 'RUNNING');
  const latestTask = tasks[0];

  const coreEl = (
    <div className="flex-1 flex flex-col items-center justify-center relative min-h-0">
      <div className="relative">
        <CornerGauge label="CPU" value={metrics?.cpuUsage} className="-top-4 -left-10 md:-left-14" />
        <CornerGauge label="GPU" value={metrics?.gpuUsage} className="-top-4 -right-10 md:-right-14" />
        <CornerGauge label="RAM" value={metrics?.ramUsage} className="-bottom-4 -left-10 md:-left-14" />
        <CornerGauge label="DSK" value={metrics?.diskUsage} className="-bottom-4 -right-10 md:-right-14" />
        <AICore
          state={aiState}
          getWaveform={() => voiceRef.current?.getWaveform() || new Uint8Array(0)}
          activeTaskProgress={activeTask?.overallProgress ?? latestTask?.overallProgress ?? 0}
          activeTaskName={activeTask?.name}
          onClick={toggleMic}
        />
      </div>
      <div className="mt-6 mb-2"><ResearchStepper /></div>
      <ActivityTicker />
    </div>
  );

  return (
    <div className="w-screen h-screen overflow-hidden flex flex-col bg-[#040711] text-slate-100 relative nexus-bg">
      <HUDHeader
        onToggleDevConsole={() => setDevOpen(!devOpen)}
        onToggleSettings={() => setSettingsOpen(!settingsOpen)}
        onToggleLeftDrawer={isMobileLayout ? () => setLeftOpen(!leftOpen) : undefined}
        onToggleRightDrawer={isMobileLayout ? () => setRightOpen(!rightOpen) : undefined}
      />

      <main className="flex-1 px-4 md:px-6 py-4 flex items-stretch justify-between gap-4 md:gap-6 overflow-hidden relative z-10 min-h-0">
        {isMobileLayout ? (
          <AnimatePresence>
            {leftOpen && (
              <motion.div initial={{ x: -460 }} animate={{ x: 0 }} exit={{ x: -460 }} transition={{ type: 'tween', duration: 0.25 }}
                className="fixed inset-y-14 bottom-20 left-0 z-40 p-2"><LeftPanel /></motion.div>
            )}
          </AnimatePresence>
        ) : <LeftPanel />}

        {coreEl}

        {isMobileLayout ? (
          <AnimatePresence>
            {rightOpen && (
              <motion.div initial={{ x: 460 }} animate={{ x: 0 }} exit={{ x: 460 }} transition={{ type: 'tween', duration: 0.25 }}
                className="fixed inset-y-14 bottom-20 right-0 z-40 p-2"><RightPanel /></motion.div>
            )}
          </AnimatePresence>
        ) : <RightPanel />}
      </main>

      <ControlBar
        onToggleMic={toggleMic}
        onToggleWakeMode={toggleWakeMode}
        onStopSpeaking={() => voiceRef.current?.stopSpeaking()}
        onSendMessage={sendMessage}
      />

      <DeveloperConsole isOpen={devOpen} onClose={() => setDevOpen(false)} />
      <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <Modals />
      <ToastStack />
    </div>
  );
};
