import { useNexusStore } from '../store/nexusStore';
import { VoiceEngine } from './voiceEngine';

let ws: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let voiceRef: VoiceEngine | null = null;

export function setVoiceEngineRef(v: VoiceEngine) {
  voiceRef = v;
}

export function connectWS() {
  const store = useNexusStore.getState;
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = import.meta.env.DEV
    ? `ws://${window.location.hostname}:5000/ws`
    : `${protocol}//${window.location.host}/ws`;

  try { ws?.close(); } catch { /* ignore */ }
  ws = new WebSocket(wsUrl);

  ws.onopen = () => store().set({ wsConnected: true });
  ws.onclose = () => {
    store().set({ wsConnected: false });
    if (!reconnectTimer) {
      reconnectTimer = setTimeout(() => { reconnectTimer = null; connectWS(); }, 3000);
    }
  };
  ws.onerror = () => { ws?.close(); };

  ws.onmessage = (event) => {
    let payload: any;
    try { payload = JSON.parse(event.data); } catch { return; }
    const s = store();
    switch (payload.type) {
      case 'SYSTEM_METRICS':
        s.set({ metrics: payload.data });
        break;
      case 'TASK_UPDATED':
        s.upsertTask(payload.data);
        break;
      case 'DEV_LOG':
        s.pushDevLog(payload.data);
        break;
      case 'AI_STATE':
        s.set({ aiState: payload.data.state });
        if (payload.data.state === 'ERROR') {
          setTimeout(() => { if (useNexusStore.getState().aiState === 'ERROR') useNexusStore.getState().set({ aiState: 'IDLE' }); }, 3000);
        }
        break;
      case 'NOTIFICATION': {
        const n = payload.data;
        s.pushNotification({ title: n.title, body: n.body, severity: n.severity || 'INFO' });
        if (n.speak && voiceRef) voiceRef.speak(`${n.title}. ${n.body}`);
        break;
      }
      case 'CONFIRMATION_REQUIRED':
        s.set({ pendingConfirmations: [...s.pendingConfirmations.filter(c => c.id !== payload.data.id), payload.data] });
        s.pushNotification({ title: 'Confirmation required', body: payload.data.summary, severity: 'WARNING' });
        break;
      case 'CONFIRMATION_RESOLVED':
        s.set({ pendingConfirmations: s.pendingConfirmations.filter(c => c.id !== payload.data.id) });
        break;
      case 'PERMISSION_REQUEST':
        s.set({ pendingPermissions: [...s.pendingPermissions.filter(p => p.id !== payload.data.id), payload.data] });
        s.pushNotification({ title: 'Permission required', body: payload.data.path, severity: 'WARNING' });
        break;
      case 'RESEARCH_STATUS':
        s.set({ researchStatus: payload.data });
        if (payload.data.status === 'COMPLETE') {
          setTimeout(() => { const cur = useNexusStore.getState().researchStatus; if (cur?.status === 'COMPLETE') useNexusStore.getState().set({ researchStatus: null }); }, 6000);
        }
        break;
    }
  };
}
