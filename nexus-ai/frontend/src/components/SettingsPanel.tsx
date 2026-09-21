import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNexusStore } from '../store/nexusStore';
import { api, NexusError } from '../services/api';
import { X, Plus, Trash2, Save } from 'lucide-react';
import { LANGUAGES } from '../constants';
import { SupportedLanguage } from '../types';

export const SettingsPanel: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const settings = useNexusStore(s => s.settings);
  const memories = useNexusStore(s => s.memories);
  const set = useNexusStore(s => s.set);
  const setError = useNexusStore(s => s.setError);
  const pushNotification = useNexusStore(s => s.pushNotification);
  const [newDir, setNewDir] = useState('');
  const [newAliasKey, setNewAliasKey] = useState('');
  const [newAliasVal, setNewAliasVal] = useState('');
  const [token, setToken] = useState(useNexusStore.getState().apiToken);
  const [audit, setAudit] = useState<any[] | null>(null);

  const save = async (patch: Record<string, any>) => {
    try {
      await api.put('/api/settings', patch);
      set({ settings: { ...settings!, ...patch } });
      pushNotification({ title: 'Settings saved', body: Object.keys(patch).join(', '), severity: 'SUCCESS' });
    } catch (e) {
      if (e instanceof NexusError) setError({ message: e.message, details: e.details, retry: () => save(patch) });
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ x: 460 }} animate={{ x: 0 }} exit={{ x: 460 }} transition={{ type: 'tween', duration: 0.25 }}
          className="fixed inset-y-0 right-0 w-[min(460px,95vw)] hud-glass-header border-l border-cyan-500/30 z-[70] flex flex-col">
          <div className="h-14 px-4 border-b border-cyan-500/20 flex items-center justify-between shrink-0">
            <span className="font-orbitron font-bold text-sm tracking-wider text-cyan-300">SYSTEM SETTINGS</span>
            <button onClick={onClose} className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-cyan-300"><X className="w-5 h-5" /></button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-5 text-sm">
            <Field label="WAKE WORD">
              <div className="flex gap-2">
                <input className="hud-input flex-1" value={settings?.wakeWord || ''} onChange={e => set({ settings: { ...settings!, wakeWord: e.target.value } })} />
                <button className="hud-btn-mini" onClick={() => save({ wakeWord: settings?.wakeWord })}><Save className="w-3 h-3" /></button>
              </div>
            </Field>

            <Field label="LANGUAGE">
              <select className="hud-input w-full" value={settings?.language || 'AUTO'}
                onChange={e => save({ language: e.target.value as SupportedLanguage })}>
                {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </Field>

            <Field label="AI PROVIDER">
              <div className="space-y-1.5">
                {(settings?.availableProviders || []).map(p => (
                  <button key={p.id} onClick={() => save({ provider: p.id })}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded border text-xs font-orbitron transition-colors ${
                      settings?.provider === p.id ? 'border-cyan-400 bg-cyan-500/15 text-cyan-300' : 'border-slate-700 text-slate-300 hover:border-slate-500'
                    }`}>
                    <span>{p.name}</span>
                    <span className={p.configured ? 'text-emerald-400' : 'text-slate-600'}>{p.configured ? '● configured' : '○ no key'}</span>
                  </button>
                ))}
              </div>
            </Field>

            <Field label="AUTO-PUBLISH MODE">
              <select className="hud-input w-full" value={settings?.autoPublishMode || 'APPROVAL'}
                onChange={e => save({ autoPublishMode: e.target.value })}>
                <option value="APPROVAL">APPROVAL (queue for review)</option>
                <option value="AUTO">AUTO (publish immediately)</option>
              </select>
            </Field>

            <Field label="API TOKEN (stored locally only)">
              <div className="flex gap-2">
                <input className="hud-input flex-1" type="password" value={token} onChange={e => setToken(e.target.value)} placeholder="NEXUS_API_TOKEN" />
                <button className="hud-btn-mini" onClick={() => set({ apiToken: token })}><Save className="w-3 h-3" /></button>
              </div>
            </Field>

            <Field label="APPROVED DIRECTORIES">
              <div className="space-y-1">
                {(settings?.approvedDirs || []).map(d => (
                  <div key={d} className="text-[11px] font-mono text-cyan-200/80 bg-slate-950/50 rounded px-2 py-1 break-all">{d}</div>
                ))}
                <div className="flex gap-2">
                  <input className="hud-input flex-1" value={newDir} onChange={e => setNewDir(e.target.value)} placeholder="/path/to/dir" />
                  <button className="hud-btn-mini" onClick={() => { if (newDir) { save({ approvedDirs: [...(settings?.approvedDirs || []), newDir] }); setNewDir(''); } }}><Plus className="w-3 h-3" /></button>
                </div>
              </div>
            </Field>

            <Field label="APP ALIASES">
              <div className="space-y-1">
                {Object.entries(settings?.appAliases || {}).map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between text-[11px] font-mono bg-slate-950/50 rounded px-2 py-1">
                    <span className="text-cyan-300">{k}</span><span className="text-slate-400">{v}</span>
                    <button onClick={() => { const a = { ...(settings?.appAliases || {}) }; delete a[k]; save({ appAliases: a }); }}
                      className="text-slate-600 hover:text-red-400"><Trash2 className="w-3 h-3" /></button>
                  </div>
                ))}
                <div className="flex gap-1.5">
                  <input className="hud-input flex-1" value={newAliasKey} onChange={e => setNewAliasKey(e.target.value)} placeholder="name" />
                  <input className="hud-input flex-1" value={newAliasVal} onChange={e => setNewAliasVal(e.target.value)} placeholder="command or URL" />
                  <button className="hud-btn-mini" onClick={() => {
                    if (newAliasKey && newAliasVal) {
                      save({ appAliases: { ...(settings?.appAliases || {}), [newAliasKey]: newAliasVal } });
                      setNewAliasKey(''); setNewAliasVal('');
                    }
                  }}><Plus className="w-3 h-3" /></button>
                </div>
              </div>
            </Field>

            <Field label="MEMORY">
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {memories.length === 0 && <p className="text-[11px] text-slate-500 italic">No memories.</p>}
                {memories.map(m => (
                  <div key={m.id} className="flex items-center justify-between text-[11px] font-mono bg-slate-950/50 rounded px-2 py-1">
                    <span className="text-slate-300"><span className="text-fuchsia-400/70">{m.category}/</span>{m.key} = {JSON.stringify(m.value).slice(0, 40)}</span>
                    <button onClick={async () => {
                      await api.del(`/api/memory/${m.id}`).catch(() => {});
                      set({ memories: memories.filter(x => x.id !== m.id) });
                    }} className="text-slate-600 hover:text-red-400 shrink-0"><Trash2 className="w-3 h-3" /></button>
                  </div>
                ))}
              </div>
            </Field>

            <Field label="AUDIT LOG">
              <button className="hud-btn-mini mb-1" onClick={async () => {
                try { setAudit(await api.get('/api/audit')); } catch { setAudit([]); }
              }}>{audit === null ? 'Load audit log' : 'Refresh'}</button>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {(audit || []).map((a: any) => (
                  <div key={a.id} className="text-[10px] font-mono bg-slate-950/50 rounded px-2 py-1">
                    <span className={a.outcome === 'FAILURE' ? 'text-red-400' : 'text-emerald-400'}>[{a.outcome}]</span>
                    <span className="text-slate-400"> {a.action}: </span>
                    <span className="text-slate-300">{a.detail}</span>
                  </div>
                ))}
              </div>
            </Field>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <div className="text-[10px] font-orbitron tracking-widest text-cyan-500/80 mb-1.5">{label}</div>
    {children}
  </div>
);
