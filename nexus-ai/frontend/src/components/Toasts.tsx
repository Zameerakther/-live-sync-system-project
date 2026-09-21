import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNexusStore } from '../store/nexusStore';
import { Info, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';

const ICONS = { INFO: Info, SUCCESS: CheckCircle, WARNING: AlertTriangle, ERROR: XCircle };
const COLORS = {
  INFO: 'border-cyan-400/50 text-cyan-300',
  SUCCESS: 'border-emerald-400/50 text-emerald-300',
  WARNING: 'border-amber-400/50 text-amber-300',
  ERROR: 'border-red-500/50 text-red-400'
};

function Toast({ n }: { n: any }) {
  const dismiss = useNexusStore(s => s.dismissNotification);
  useEffect(() => {
    const t = setTimeout(() => dismiss(n.id), 6000);
    return () => clearTimeout(t);
  }, [n.id]);
  const Icon = ICONS[n.severity as keyof typeof ICONS] || Info;
  return (
    <motion.div
      initial={{ opacity: 0, x: 60 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 60 }}
      onClick={() => dismiss(n.id)}
      className={`hud-panel corner-brackets cursor-pointer w-72 p-3 border ${COLORS[n.severity as keyof typeof COLORS] || COLORS.INFO}`}>
      <div className="flex items-start gap-2">
        <Icon className="w-4 h-4 mt-0.5 shrink-0" />
        <div className="min-w-0">
          <div className="text-xs font-orbitron text-slate-100">{n.title}</div>
          <div className="text-[11px] font-rajdhani text-slate-400 break-words">{n.body}</div>
        </div>
      </div>
    </motion.div>
  );
}

export const ToastStack: React.FC = () => {
  const notifications = useNexusStore(s => s.notifications);
  return (
    <div className="fixed top-16 right-4 z-[90] space-y-2">
      <AnimatePresence>
        {notifications.slice(-5).map(n => <Toast key={n.id} n={n} />)}
      </AnimatePresence>
    </div>
  );
};
