import React, { useState } from 'react';
import { Mic, MicOff, Send, Globe, Radio, Volume2, Square } from 'lucide-react';
import { SupportedLanguage } from '../types';

interface ControlBarProps {
  isListening: boolean;
  isSpeaking: boolean;
  onToggleMic: () => void;
  onStopSpeaking: () => void;
  onSendMessage: (text: string) => void;
  selectedLanguage: SupportedLanguage;
  onSelectLanguage: (lang: SupportedLanguage) => void;
  wakeWord: string;
}

export const ControlBar: React.FC<ControlBarProps> = ({
  isListening,
  isSpeaking,
  onToggleMic,
  onStopSpeaking,
  onSendMessage,
  selectedLanguage,
  onSelectLanguage,
  wakeWord
}) => {
  const [inputText, setInputText] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    onSendMessage(inputText);
    setInputText('');
  };

  const languages: SupportedLanguage[] = [
    'AUTO', 'ENGLISH', 'ARABIC', 'HINDI', 'MALAYALAM',
    'TAMIL', 'URDU', 'FRENCH', 'SPANISH', 'GERMAN',
    'CHINESE', 'JAPANESE', 'KOREAN'
  ];

  return (
    <div className="w-full h-20 hud-glass border-t border-cyan-500/20 px-6 flex items-center justify-between z-30 select-none">
      {/* Mic & Wake-word Status */}
      <div className="flex items-center gap-4">
        <button
          onClick={onToggleMic}
          className={`relative p-3.5 rounded-full border transition-all duration-300 flex items-center justify-center ${
            isListening 
              ? 'bg-cyan-500 text-slate-950 border-cyan-300 shadow-[0_0_25px_rgba(0,240,255,0.8)] animate-pulse' 
              : 'bg-slate-900/80 text-cyan-400 border-cyan-500/30 hover:border-cyan-400'
          }`}
          title={isListening ? "Mute Microphone" : "Activate Microphone"}
        >
          {isListening ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
        </button>

        {isSpeaking && (
          <button
            onClick={onStopSpeaking}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-500/20 border border-red-500/50 text-red-400 text-xs font-orbitron hover:bg-red-500/30 transition-all"
          >
            <Square className="w-3.5 h-3.5 fill-red-400" />
            <span>BARGE-IN STOP</span>
          </button>
        )}

        {/* Wake Word Badge */}
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/70 border border-slate-800 text-xs font-mono">
          <Radio className={`w-3.5 h-3.5 ${isListening ? 'text-cyan-400 animate-ping' : 'text-slate-500'}`} />
          <span className="text-slate-400">WAKE WORD:</span>
          <span className="text-cyan-300 font-bold uppercase">"{wakeWord}"</span>
        </div>
      </div>

      {/* Natural Language Text Prompt Bar */}
      <form onSubmit={handleSubmit} className="flex-1 max-w-2xl mx-6">
        <div className="relative flex items-center">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder='Say or type "Hello Nexus", "Create this week&apos;s gaming videos", "Translate into Arabic"...'
            className="w-full h-11 pl-4 pr-12 rounded-xl bg-slate-950/80 border border-cyan-500/30 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-400 focus:shadow-[0_0_15px_rgba(0,240,255,0.25)] text-sm font-sans transition-all"
          />
          <button
            type="submit"
            disabled={!inputText.trim()}
            className="absolute right-1.5 p-2 rounded-lg bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/40 disabled:opacity-40 transition-all"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </form>

      {/* Language Selector */}
      <div className="flex items-center gap-2">
        <Globe className="w-4 h-4 text-cyan-400" />
        <select
          value={selectedLanguage}
          onChange={(e) => onSelectLanguage(e.target.value as SupportedLanguage)}
          className="h-9 px-3 rounded-lg bg-slate-950/80 border border-cyan-500/30 text-cyan-300 text-xs font-orbitron uppercase focus:outline-none focus:border-cyan-400 cursor-pointer"
        >
          {languages.map((lang) => (
            <option key={lang} value={lang} className="bg-slate-900 text-slate-200">
              {lang}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};
