import React, { useState } from 'react';
import { useNexusStore } from '../../store/nexusStore';
import { api, NexusError } from '../../services/api';
import { refreshProduction } from '../../services/ws';
import { Activity, Youtube, Bell, Wrench, Clapperboard } from 'lucide-react';
import { SUPPORTED_GAMES } from '../../constants';

export const RightPanel: React.FC = () => {
  const [tab, setTab] = useState<'activity' | 'production' | 'notifications' | 'tools'>('production');
  const devLogs = useNexusStore(s => s.devLogs);
  const notifications = useNexusStore(s => s.notifications);
  const dismissNotification = useNexusStore(s => s.dismissNotification);
  const tools = useNexusStore(s => s.tools);
  const concepts = useNexusStore(s => s.concepts);
  const yt = useNexusStore(s => s.youtubeInfo);
  const queue = useNexusStore(s => s.youtubeQueue);
  const settings = useNexusStore(s => s.settings);
  const setError = useNexusStore(s => s.setError);
  const pushNotification = useNexusStore(s => s.pushNotification);
  const set = useNexusStore(s => s.set);

  const [game, setGame] = useState('GTA V');
  const [style, setStyle] = useState('Fast Cinematic');
  const [videosPerWeek, setVideosPerWeek] = useState(3);
  const [customCron, setCustomCron] = useState('');

  const guard = async (fn: () => Promise<void>) => {
    try { await fn(); } catch (e) {
      if (e instanceof NexusError) setError({ message: e.message, details: e.details, retry: () => guard(fn) });
    }
  };

  return (
    <div className="hud-panel corner-brackets flex flex-col h-full overflow-hidden w-[clamp(300px,26vw,420px)]">
      <div className="flex border-b border-cyan-500/15">
        {([['activity', Activity, 'ACTIVITY'], ['production', Clapperboard, 'PRODUCTION'], ['notifications', Bell, 'ALERTS'], ['tools', Wrench, 'TOOLS']] as const).map(([id, Icon, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex-1 flex items-center justify-center gap-1 py-2.5 text-[9px] font-orbitron tracking-wider transition-colors ${tab === id ? 'text-cyan-300 border-b-2 border-cyan-400 bg-cyan-500/5' : 'text-slate-500 hover:text-slate-300'}`}>
            <Icon className="w-3.5 h-3.5" />{label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {tab === 'activity' && (
          <div className="space-y-1.5">
            {devLogs.length === 0 && <p className="text-xs text-slate-500 italic text-center py-8">No activity yet.</p>}
            {devLogs.slice(0, 60).map(l => (
              <div key={l.id} className="text-[11px] font-mono flex gap-2">
                <span className="text-slate-600 shrink-0">{new Date(l.timestamp).toLocaleTimeString([], { hour12: false })}</span>
                <span className={`shrink-0 ${
                  l.type === 'ERROR' ? 'text-red-400' : l.type === 'TOOL_CALL' ? 'text-fuchsia-400' :
                  l.type === 'PROVIDER_LATENCY' ? 'text-emerald-400' : l.type === 'STATE_CHANGE' ? 'text-amber-400' : 'text-cyan-400'
                }`}>[{l.type}]</span>
                <span className="text-slate-300 break-words">{l.message}</span>
              </div>
            ))}
          </div>
        )}

        {tab === 'notifications' && (
          <div className="space-y-2">
            {notifications.length === 0 && <p className="text-xs text-slate-500 italic text-center py-8">No notifications.</p>}
            {notifications.map(n => (
              <div key={n.id} onClick={() => dismissNotification(n.id)}
                className={`hud-panel p-2.5 cursor-pointer border-l-2 ${
                  n.severity === 'ERROR' ? 'border-l-red-500' : n.severity === 'WARNING' ? 'border-l-amber-400' :
                  n.severity === 'SUCCESS' ? 'border-l-emerald-400' : 'border-l-cyan-400'
                }`}>
                <div className="text-xs font-orbitron text-slate-100">{n.title}</div>
                <div className="text-[11px] font-rajdhani text-slate-400">{n.body}</div>
                <div className="text-[9px] font-mono text-slate-600 mt-1">{new Date(n.ts).toLocaleTimeString([], { hour12: false })}</div>
              </div>
            ))}
          </div>
        )}

        {tab === 'tools' && (
          <div className="space-y-1.5">
            {tools.map(t => (
              <div key={t.name} className="hud-panel p-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-orbitron text-cyan-300">{t.name}</span>
                  <span className="text-[9px] font-mono text-slate-500">{t.category}</span>
                </div>
                <p className="text-[11px] font-rajdhani text-slate-400">{t.description}</p>
              </div>
            ))}
          </div>
        )}

        {tab === 'production' && (
          <>
            {/* YouTube card */}
            <div className="hud-panel p-3 space-y-2">
              <div className="flex items-center gap-2 text-xs font-orbitron text-slate-200"><Youtube className="w-4 h-4 text-red-400" />YOUTUBE CHANNEL</div>
              {yt?.isConnected ? (
                <div className="grid grid-cols-3 gap-2 text-center text-[11px] font-mono">
                  <div><div className="text-cyan-300 font-bold">{yt.subscriberCount.toLocaleString()}</div><div className="text-slate-500">subs</div></div>
                  <div><div className="text-cyan-300 font-bold">{yt.videoCount}</div><div className="text-slate-500">videos</div></div>
                  <div><div className="text-cyan-300 font-bold">{(yt.totalViews / 1e6).toFixed(1)}M</div><div className="text-slate-500">views</div></div>
                  <div className="col-span-3 text-slate-400">{yt.channelName}</div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400 font-rajdhani">Not connected</span>
                  <button className="hud-btn-mini" onClick={() => guard(async () => {
                    const { url } = await api.get<{ url: string }>('/api/youtube/auth/url');
                    if (url) window.open(url, '_blank');
                  })}>Connect</button>
                </div>
              )}
            </div>

            {/* Schedule + publish mode */}
            <div className="hud-panel p-3 space-y-2">
              <div className="text-xs font-orbitron text-slate-200">PUBLISH SCHEDULE</div>
              <div className="flex items-center gap-2">
                <select value={videosPerWeek} onChange={e => setVideosPerWeek(Number(e.target.value))}
                  className="hud-input flex-1">{[1,2,3,4,5].map(n => <option key={n} value={n}>{n} video{n>1?'s':''}/week</option>)}</select>
                <button className="hud-btn-mini" onClick={() => guard(async () => {
                  const schedule = customCron
                    ? [{ cronExpr: customCron, label: customCron }]
                    : [{ videosPerWeek }];
                  await api.put('/api/settings', { schedule });
                  pushNotification({ title: 'Schedule saved', body: customCron || `${videosPerWeek} video(s)/week`, severity: 'SUCCESS' });
                })}>Set</button>
              </div>
              <input value={customCron} onChange={e => setCustomCron(e.target.value)} placeholder="or custom cron e.g. 0 18 * * 1-5"
                className="hud-input w-full" />
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-slate-400">AUTO-PUBLISH</span>
                <button onClick={() => guard(async () => {
                  const next = settings?.autoPublishMode === 'AUTO' ? 'APPROVAL' : 'AUTO';
                  await api.put('/api/settings', { autoPublishMode: next });
                  set({ settings: { ...settings!, autoPublishMode: next } });
                })} className={`px-2.5 py-1 rounded text-[10px] font-orbitron border ${settings?.autoPublishMode === 'AUTO' ? 'border-emerald-400/50 text-emerald-300 bg-emerald-500/10' : 'border-amber-400/50 text-amber-300 bg-amber-500/10'}`}>
                  {settings?.autoPublishMode || 'APPROVAL'}
                </button>
              </div>
            </div>

            {/* Queue */}
            <div className="hud-panel p-3 space-y-2">
              <div className="text-xs font-orbitron text-slate-200">UPLOAD QUEUE</div>
              {queue.length === 0 && <p className="text-[11px] text-slate-500 italic">Queue empty.</p>}
              {queue.map(v => (
                <div key={v.id} className="flex items-center justify-between gap-2 text-[11px] font-rajdhani border-b border-slate-800/60 pb-1.5">
                  <div className="min-w-0">
                    <div className="text-slate-200 truncate">{v.title}</div>
                    <div className="text-[9px] font-mono text-slate-500">{v.status}{v.scheduledTime ? ` · ${new Date(v.scheduledTime).toLocaleDateString()}` : ''}</div>
                  </div>
                  {v.status === 'READY_FOR_APPROVAL' && (
                    <button className="hud-btn-mini shrink-0" onClick={() => guard(async () => {
                      await api.post(`/api/youtube/publish/${v.id}`);
                    })}>Approve & Publish</button>
                  )}
                </div>
              ))}
            </div>

            {/* Gaming */}
            <div className="hud-panel p-3 space-y-2">
              <div className="text-xs font-orbitron text-slate-200">GAMING PRODUCTION</div>
              <div className="flex flex-wrap gap-1.5">
                {SUPPORTED_GAMES.map(g => (
                  <button key={g} onClick={() => setGame(g)}
                    className={`px-2 py-1 rounded text-[10px] font-orbitron border transition-colors ${game === g ? 'border-cyan-400 text-cyan-300 bg-cyan-500/15' : 'border-slate-700 text-slate-400 hover:border-slate-500'}`}>
                    {g}
                  </button>
                ))}
              </div>
              <input value={style} onChange={e => setStyle(e.target.value)} placeholder="Style e.g. Fast Cinematic" className="hud-input w-full" />
              <div className="flex gap-2">
                <button className="hud-btn-mini flex-1" onClick={() => guard(async () => {
                  const c = await api.post('/api/gaming/generate', { gameTitle: game, style });
                  set({ concepts: [c as any, ...concepts] });
                })}>Generate concept</button>
                <button className="hud-btn-mini flex-1 text-emerald-300 border-emerald-500/40" onClick={() => guard(async () => {
                  await api.post('/api/gaming/produce', { gameTitle: game, style });
                  pushNotification({ title: 'Production started', body: `${game} — ${style}`, severity: 'SUCCESS' });
                  refreshProduction();
                })}>Start production</button>
              </div>
            </div>

            {/* Concepts */}
            {concepts.slice(0, 6).map(c => (
              <div key={c.id} className="hud-panel p-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-rajdhani font-semibold text-slate-100">{c.conceptTitle}</span>
                  <span className={`text-[10px] font-mono ${c.originalityScore >= 70 ? 'text-emerald-400' : 'text-amber-400'}`}>{Math.round(c.originalityScore)}% orig.</span>
                </div>
                <div className="text-[10px] font-mono text-slate-500">{c.gameTitle} · {c.style} · {c.targetDurationMin}min</div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
};
