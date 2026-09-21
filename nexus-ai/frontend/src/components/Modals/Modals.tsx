import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNexusStore } from '../../store/nexusStore';
import { api } from '../../services/api';
import { AlertTriangle, ShieldAlert, FolderLock, X, Check, Ban } from 'lucide-react';

const Overlay: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <motion.div
    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[80] flex items-center justify-center p-4">
    {children}
  </motion.div>
);

export const Modals: React.FC = () => {
  const confirmations = useNexusStore(s => s.pendingConfirmations);
  const permissions = useNexusStore(s => s.pendingPermissions);
  const error = useNexusStore(s => s.error);
  const setError = useNexusStore(s => s.setError);
  const set = useNexusStore(s => s.set);
  const [showDetails, setShowDetails] = useState(false);

  const rejectConfirmation = async (id: string) => {
    await api.post(`/api/confirmations/${id}/reject`).catch(() => {});
    set({ pendingConfirmations: useNexusStore.getState().pendingConfirmations.filter(x => x.id !== id) });
  };
  const denyPermission = (id: string) => {
    set({ pendingPermissions: useNexusStore.getState().pendingPermissions.filter(x => x.id !== id) });
  };

  // Esc = Reject (confirmation) / Deny (permission)
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (confirmations.length) { e.stopPropagation(); rejectConfirmation(confirmations[0].id); }
      else if (permissions.length) { e.stopPropagation(); denyPermission(permissions[0].id); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [confirmations, permissions]);

  return (
    <AnimatePresence>
      {confirmations.map(c => (
        <Overlay key={c.id}>
          <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0 }}
            className="hud-panel corner-brackets w-full max-w-md p-5 space-y-4 border-amber-400/40">
            <div className="flex items-center gap-2 text-amber-300 font-orbitron text-sm tracking-widest">
              <ShieldAlert className="w-5 h-5" />CONFIRMATION REQUIRED
            </div>
            <p className="text-sm font-rajdhani text-slate-200">{c.summary}</p>
            <div className="text-[10px] font-mono text-slate-400 bg-slate-950/70 rounded p-2 break-all">
              {c.toolName} · {JSON.stringify(c.params)}
            </div>
            <div className="flex gap-2 justify-end">
              <button className="hud-btn-mini text-red-400 border-red-500/40" onClick={async () => {
                await api.post(`/api/confirmations/${c.id}/reject`).catch(() => {});
                set({ pendingConfirmations: confirmations.filter(x => x.id !== c.id) });
              }}><Ban className="w-3 h-3" />Reject</button>
              <button className="hud-btn-mini text-emerald-300 border-emerald-500/40" onClick={async () => {
                const r = await api.post(`/api/confirmations/${c.id}/approve`).catch(() => null);
                set({ pendingConfirmations: confirmations.filter(x => x.id !== c.id) });
                if (r && !(r as any).ok) setError({ message: 'Action failed after approval.', details: (r as any).error });
              }}><Check className="w-3 h-3" />Approve</button>
            </div>
          </motion.div>
        </Overlay>
      ))}

      {permissions.map(p => (
        <Overlay key={p.id}>
          <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0 }}
            className="hud-panel corner-brackets w-full max-w-md p-5 space-y-4 border-cyan-400/40">
            <div className="flex items-center gap-2 text-cyan-300 font-orbitron text-sm tracking-widest">
              <FolderLock className="w-5 h-5" />PERMISSION REQUEST
            </div>
            <p className="text-sm font-rajdhani text-slate-200">NEXUS requests access to directory:</p>
            <div className="text-xs font-mono text-cyan-200 bg-slate-950/70 rounded p-2 break-all">{p.path}</div>
            <div className="flex gap-2 justify-end">
              <button className="hud-btn-mini" onClick={() => set({ pendingPermissions: permissions.filter(x => x.id !== p.id) })}>
                <X className="w-3 h-3" />Deny
              </button>
              <button className="hud-btn-mini text-emerald-300 border-emerald-500/40" onClick={async () => {
                await api.post(`/api/permissions/${p.id}/grant`).catch(() => {});
                set({ pendingPermissions: permissions.filter(x => x.id !== p.id) });
              }}><Check className="w-3 h-3" />Grant</button>
            </div>
          </motion.div>
        </Overlay>
      ))}

      {error && (
        <Overlay key="error">
          <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0 }}
            className="hud-panel corner-brackets w-full max-w-md p-5 space-y-4 border-red-500/40">
            <div className="flex items-center gap-2 text-red-400 font-orbitron text-sm tracking-widest">
              <AlertTriangle className="w-5 h-5" />SYSTEM FAULT
            </div>
            <p className="text-sm font-rajdhani text-slate-200">{error.message}</p>
            {error.details && (
              <button onClick={() => setShowDetails(!showDetails)} className="text-[10px] font-mono text-slate-500 hover:text-slate-300">
                {showDetails ? '▾ hide details' : '▸ details'}
              </button>
            )}
            {showDetails && error.details && (
              <pre className="text-[10px] font-mono text-red-300/80 bg-slate-950/70 rounded p-2 max-h-32 overflow-auto whitespace-pre-wrap">{error.details}</pre>
            )}
            <div className="flex gap-2 justify-end">
              <button className="hud-btn-mini" onClick={() => setError(null)}>Cancel</button>
              {error.retry && (
                <button className="hud-btn-mini text-cyan-300 border-cyan-500/40" onClick={() => { const r = error.retry; setError(null); r?.(); }}>Retry</button>
              )}
            </div>
          </motion.div>
        </Overlay>
      )}
    </AnimatePresence>
  );
};
