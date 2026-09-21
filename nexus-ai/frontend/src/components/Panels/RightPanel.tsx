import React, { useState } from 'react';
import { Gamepad2, Youtube, Wrench, Bell, Sparkles, CheckCircle, Clock, ShieldCheck, Play } from 'lucide-react';
import { GamingConcept, YouTubeChannelInfo, YouTubeVideoMetadata, ToolDefinition } from '../../types';

interface RightPanelProps {
  gamingConcepts: GamingConcept[];
  youtubeInfo: YouTubeChannelInfo;
  youtubeQueue: YouTubeVideoMetadata[];
  tools: ToolDefinition[];
  onGenerateConcept: (gameTitle: string) => void;
  onApprovePublish: (id: string) => void;
}

export const RightPanel: React.FC<RightPanelProps> = ({
  gamingConcepts,
  youtubeInfo,
  youtubeQueue,
  tools,
  onGenerateConcept,
  onApprovePublish
}) => {
  const [activeTab, setActiveTab] = useState<'GAMING' | 'YOUTUBE' | 'TOOLS'>('GAMING');
  const [selectedGame, setSelectedGame] = useState<string>('GTA V');

  return (
    <div className="w-80 h-full hud-glass rounded-2xl flex flex-col overflow-hidden border border-cyan-500/20 select-none">
      {/* Tab Buttons */}
      <div className="flex items-center justify-between border-b border-cyan-500/20 bg-slate-950/50 p-1.5">
        <button
          onClick={() => setActiveTab('GAMING')}
          className={`flex-1 py-1.5 rounded-lg text-xs font-orbitron flex items-center justify-center gap-1.5 transition-all ${
            activeTab === 'GAMING' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/40' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Gamepad2 className="w-3.5 h-3.5" />
          <span>GAMING</span>
        </button>
        <button
          onClick={() => setActiveTab('YOUTUBE')}
          className={`flex-1 py-1.5 rounded-lg text-xs font-orbitron flex items-center justify-center gap-1.5 transition-all ${
            activeTab === 'YOUTUBE' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/40' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Youtube className="w-3.5 h-3.5" />
          <span>STUDIO</span>
        </button>
        <button
          onClick={() => setActiveTab('TOOLS')}
          className={`flex-1 py-1.5 rounded-lg text-xs font-orbitron flex items-center justify-center gap-1.5 transition-all ${
            activeTab === 'TOOLS' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/40' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Wrench className="w-3.5 h-3.5" />
          <span>TOOLS ({tools.length})</span>
        </button>
      </div>

      {/* Tab Body */}
      <div className="flex-1 p-4 overflow-y-auto space-y-4">
        {/* TAB 1: GAMING AI STUDIO */}
        {activeTab === 'GAMING' && (
          <div className="space-y-4">
            {/* Generator Action Box */}
            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-cyan-500/30 space-y-3">
              <h3 className="text-xs font-orbitron text-cyan-300 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-cyan-400" /> GAMING CONCEPT ENGINE
              </h3>
              <div className="flex items-center gap-2">
                <select
                  value={selectedGame}
                  onChange={(e) => setSelectedGame(e.target.value)}
                  className="flex-1 h-8 px-2 rounded bg-slate-900 border border-cyan-500/30 text-xs text-slate-200 font-sans focus:outline-none"
                >
                  <option value="GTA V">GTA V</option>
                  <option value="Red Dead Redemption 2">RDR 2</option>
                  <option value="Minecraft">Minecraft</option>
                  <option value="GTA Online">GTA Online</option>
                </select>
                <button
                  onClick={() => onGenerateConcept(selectedGame)}
                  className="px-3 h-8 rounded bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-orbitron font-bold transition-all"
                >
                  GENERATE
                </button>
              </div>
            </div>

            {/* Concepts List */}
            <div className="space-y-3">
              <h4 className="text-[11px] font-orbitron text-slate-400 uppercase tracking-wider">Concept History</h4>
              {gamingConcepts.map((concept) => (
                <div key={concept.id} className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-orbitron font-bold text-cyan-300">{concept.gameTitle}</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3" /> {concept.originalityScore}% ORIGINAL
                    </span>
                  </div>
                  <h5 className="text-xs font-semibold text-slate-200">{concept.conceptTitle}</h5>
                  <p className="text-[11px] text-slate-400 line-clamp-2">{concept.scriptOutline}</p>
                  <div className="flex flex-wrap gap-1 pt-1">
                    {concept.recommendedHashtags.map((tag) => (
                      <span key={tag} className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-900 text-cyan-400/80">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 2: YOUTUBE AUTOMATION STUDIO */}
        {activeTab === 'YOUTUBE' && (
          <div className="space-y-4">
            {/* Channel Metrics Overview */}
            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-red-500/30 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-orbitron text-red-400 flex items-center gap-1.5">
                  <Youtube className="w-4 h-4 text-red-500" /> {youtubeInfo.channelName}
                </span>
                <span className="text-[10px] font-mono text-emerald-400">CONNECTED</span>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-900 text-center">
                <div className="p-2 rounded bg-slate-900/60">
                  <p className="text-[10px] text-slate-400">SUBSCRIBERS</p>
                  <p className="text-sm font-orbitron font-bold text-slate-100">{(youtubeInfo.subscriberCount / 1000).toFixed(1)}K</p>
                </div>
                <div className="p-2 rounded bg-slate-900/60">
                  <p className="text-[10px] text-slate-400">PUBLISH MODE</p>
                  <p className="text-xs font-orbitron font-bold text-amber-400">{youtubeInfo.autoPublishMode}</p>
                </div>
              </div>
            </div>

            {/* Video Queue */}
            <div className="space-y-3">
              <h4 className="text-[11px] font-orbitron text-slate-400 uppercase tracking-wider">Publication Queue</h4>
              {youtubeQueue.map((video) => (
                <div key={video.id} className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-slate-200 truncate max-w-[170px]">{video.title}</span>
                    <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${
                      video.status === 'READY_FOR_APPROVAL' ? 'bg-amber-500/20 text-amber-300' :
                      video.status === 'PUBLISHED' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-400'
                    }`}>
                      {video.status}
                    </span>
                  </div>
                  {video.status === 'READY_FOR_APPROVAL' && (
                    <button
                      onClick={() => onApprovePublish(video.id)}
                      className="w-full py-1.5 rounded bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-orbitron font-bold text-xs flex items-center justify-center gap-1 transition-all"
                    >
                      <CheckCircle className="w-3.5 h-3.5" /> APPROVE & PUBLISH
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: AI TOOL REGISTRY */}
        {activeTab === 'TOOLS' && (
          <div className="space-y-2">
            {tools.map((tool) => (
              <div key={tool.name} className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-cyan-500/40 transition-all">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="font-bold text-cyan-300">{tool.name}</span>
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-900 text-slate-400">{tool.category}</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">{tool.description}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
