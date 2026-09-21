import React, { useState, useEffect, useRef } from 'react';
import { HUDHeader } from './components/HUDHeader';
import { ControlBar } from './components/ControlBar';
import { AICore } from './components/AICore';
import { LeftPanel } from './components/Panels/LeftPanel';
import { RightPanel } from './components/Panels/RightPanel';
import { DeveloperConsole } from './components/DeveloperConsole';
import { VoiceEngine } from './services/voiceEngine';
import {
  AIState,
  SupportedLanguage,
  ChatMessage,
  TaskItem,
  SystemMetrics,
  GamingConcept,
  YouTubeChannelInfo,
  YouTubeVideoMetadata,
  ToolDefinition,
  DevConsoleLog
} from './types';

export const App: React.FC = () => {
  // State management
  const [aiState, setAiState] = useState<AIState>('IDLE');
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [selectedLanguage, setSelectedLanguage] = useState<SupportedLanguage>('AUTO');
  const [wakeWord, setWakeWord] = useState<string>('Nexus');
  
  const [isListening, setIsListening] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);

  const [wsConnected, setWsConnected] = useState<boolean>(false);
  const [devConsoleOpen, setDevConsoleOpen] = useState<boolean>(false);
  
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome_1',
      sender: 'NEXUS',
      text: 'NEXUS AI Operating System online. Systems verified. Standing by for voice or text instructions.',
      timestamp: new Date().toISOString()
    }
  ]);

  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [metrics, setMetrics] = useState<SystemMetrics>({
    cpuUsage: 34,
    gpuUsage: 57,
    ramUsage: 61,
    diskUsage: 42,
    networkSpeed: 120,
    storageFreeGb: 480
  });

  const [gamingConcepts, setGamingConcepts] = useState<GamingConcept[]>([]);
  const [youtubeInfo, setYoutubeInfo] = useState<YouTubeChannelInfo>({
    channelName: 'NEXUS Gaming Studio',
    subscriberCount: 142500,
    videoCount: 84,
    totalViews: 12850000,
    isConnected: true,
    autoPublishMode: 'APPROVAL',
    publishSchedule: ['Mon 18:00', 'Wed 18:00', 'Fri 18:00']
  });
  const [youtubeQueue, setYoutubeQueue] = useState<YouTubeVideoMetadata[]>([]);
  const [tools, setTools] = useState<ToolDefinition[]>([]);
  const [devLogs, setDevLogs] = useState<DevConsoleLog[]>([]);

  const voiceEngineRef = useRef<VoiceEngine | null>(null);

  // Initialize Voice Engine
  useEffect(() => {
    voiceEngineRef.current = new VoiceEngine({
      onSpeechResult: (text) => {
        handleSendMessage(text);
      },
      onWakeWordDetected: (word) => {
        setDevLogs(prev => [
          {
            id: String(Date.now()),
            timestamp: new Date().toISOString(),
            type: 'INTENT',
            message: `Wake word "${word}" detected via continuous microphone analysis.`
          },
          ...prev
        ]);
      },
      onAudioLevel: (level) => {
        setAudioLevel(level);
      },
      onStateChange: (listening, speaking) => {
        setIsListening(listening);
        setIsSpeaking(speaking);
        if (speaking) setAiState('SPEAKING');
        else if (listening) setAiState('LISTENING');
        else setAiState('IDLE');
      }
    });

    fetchInitialData();
    connectWebSocket();
  }, []);

  // Sync Voice Engine settings
  useEffect(() => {
    if (voiceEngineRef.current) {
      voiceEngineRef.current.setLanguage(selectedLanguage);
      voiceEngineRef.current.setWakeWord(wakeWord);
    }
  }, [selectedLanguage, wakeWord]);

  const fetchInitialData = async () => {
    try {
      const [tasksRes, conceptsRes, ytInfoRes, ytQueueRes, toolsRes] = await Promise.all([
        fetch('/api/tasks').then(r => r.json()),
        fetch('/api/gaming/concepts').then(r => r.json()),
        fetch('/api/youtube/info').then(r => r.json()),
        fetch('/api/youtube/queue').then(r => r.json()),
        fetch('/api/tools').then(r => r.json())
      ]);

      if (Array.isArray(tasksRes)) setTasks(tasksRes);
      if (Array.isArray(conceptsRes)) setGamingConcepts(conceptsRes);
      if (ytInfoRes) setYoutubeInfo(ytInfoRes);
      if (Array.isArray(ytQueueRes)) setYoutubeQueue(ytQueueRes);
      if (Array.isArray(toolsRes)) setTools(toolsRes);
    } catch (e) {
      console.warn('[NEXUS Frontend] API fetch warning (running offline fallback):', e);
    }
  };

  const connectWebSocket = () => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = !import.meta.env.DEV ? `${protocol}//${host}/ws` : 'ws://localhost:5000/ws';

    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      setWsConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === 'SYSTEM_METRICS') {
          setMetrics(payload.data);
        } else if (payload.type === 'TASK_UPDATED') {
          setTasks(prev => {
            const idx = prev.findIndex(t => t.id === payload.data.id);
            if (idx >= 0) {
              const updated = [...prev];
              updated[idx] = payload.data;
              return updated;
            }
            return [payload.data, ...prev];
          });
        } else if (payload.type === 'DEV_LOG') {
          setDevLogs(prev => [payload.data, ...prev]);
        }
      } catch (err) {}
    };

    ws.onclose = () => {
      setWsConnected(false);
      setTimeout(connectWebSocket, 4000);
    };
  };

  const handleSendMessage = async (text: string) => {
    // 1. Add User Message
    const userMsg: ChatMessage = {
      id: String(Date.now()),
      sender: 'USER',
      text,
      timestamp: new Date().toISOString(),
      language: selectedLanguage
    };
    setMessages(prev => [...prev, userMsg]);
    setAiState('THINKING');

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, language: selectedLanguage })
      });

      const data = await res.json();
      if (data.replyMessage) {
        setMessages(prev => [...prev, data.replyMessage]);
        
        // Multilingual switch check
        if (data.replyMessage.language && data.replyMessage.language !== selectedLanguage) {
          setSelectedLanguage(data.replyMessage.language);
        }

        // Trigger Assistant Voice Speech
        if (voiceEngineRef.current) {
          setAiState('SPEAKING');
          voiceEngineRef.current.speak(data.replyMessage.text, () => {
            setAiState('IDLE');
          });
        } else {
          setAiState('IDLE');
        }
      }

      // Refresh tasks if task created
      if (data.replyMessage?.taskCreatedId) {
        setAiState('EXECUTING');
        const tasksRes = await fetch('/api/tasks').then(r => r.json());
        if (Array.isArray(tasksRes)) setTasks(tasksRes);
      }
    } catch (err) {
      setAiState('ERROR');
      setTimeout(() => setAiState('IDLE'), 3000);
    }
  };

  const handleToggleMic = () => {
    if (!voiceEngineRef.current) return;
    if (isListening) {
      voiceEngineRef.current.stopListening();
    } else {
      voiceEngineRef.current.startListening();
    }
  };

  const handleStopSpeaking = () => {
    if (voiceEngineRef.current) {
      voiceEngineRef.current.stopSpeaking();
    }
  };

  const handleGenerateConcept = async (gameTitle: string) => {
    setAiState('THINKING');
    try {
      const res = await fetch('/api/gaming/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameTitle })
      });
      const newConcept = await res.json();
      setGamingConcepts(prev => [newConcept, ...prev]);
      setAiState('SUCCESS');
      setTimeout(() => setAiState('IDLE'), 2000);
    } catch (e) {
      setAiState('ERROR');
    }
  };

  const handleApprovePublish = async (id: string) => {
    try {
      await fetch(`/api/youtube/publish/${id}`, { method: 'POST' });
      const queueRes = await fetch('/api/youtube/queue').then(r => r.json());
      if (Array.isArray(queueRes)) setYoutubeQueue(queueRes);
    } catch (e) {}
  };

  const handleCancelTask = async (id: string) => {
    try {
      await fetch(`/api/tasks/${id}/cancel`, { method: 'POST' });
      const tasksRes = await fetch('/api/tasks').then(r => r.json());
      if (Array.isArray(tasksRes)) setTasks(tasksRes);
    } catch (e) {}
  };

  // Find active task progress for core animation
  const activeTask = tasks.find(t => t.status === 'RUNNING');

  return (
    <div className="w-screen h-screen overflow-hidden flex flex-col justify-between bg-[#040711] text-slate-100 relative">
      {/* HUD Header Bar */}
      <HUDHeader
        wsConnected={wsConnected}
        onToggleDevConsole={() => setDevConsoleOpen(!devConsoleOpen)}
        devLogsCount={devLogs.length}
      />

      {/* Main Center HUD Area with Side Panels & Core */}
      <main className="flex-1 px-6 py-4 flex items-center justify-between gap-6 overflow-hidden relative z-10">
        {/* Left Glass Panel */}
        <LeftPanel
          messages={messages}
          tasks={tasks}
          metrics={metrics}
          onCancelTask={handleCancelTask}
        />

        {/* Center Futuristic AI Core */}
        <div className="flex-1 flex flex-col items-center justify-center relative">
          <AICore
            state={aiState}
            audioLevel={audioLevel}
            activeTaskProgress={activeTask?.overallProgress || 0}
            onClick={handleToggleMic}
          />
        </div>

        {/* Right Glass Panel */}
        <RightPanel
          gamingConcepts={gamingConcepts}
          youtubeInfo={youtubeInfo}
          youtubeQueue={youtubeQueue}
          tools={tools}
          onGenerateConcept={handleGenerateConcept}
          onApprovePublish={handleApprovePublish}
        />
      </main>

      {/* Bottom Control Bar */}
      <ControlBar
        isListening={isListening}
        isSpeaking={isSpeaking}
        onToggleMic={handleToggleMic}
        onStopSpeaking={handleStopSpeaking}
        onSendMessage={handleSendMessage}
        selectedLanguage={selectedLanguage}
        onSelectLanguage={setSelectedLanguage}
        wakeWord={wakeWord}
      />

      {/* Slide-over Developer Console */}
      <DeveloperConsole
        isOpen={devConsoleOpen}
        onClose={() => setDevConsoleOpen(false)}
        logs={devLogs}
        onClearLogs={() => setDevLogs([])}
      />
    </div>
  );
};
