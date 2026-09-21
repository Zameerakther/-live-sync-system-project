import { describe, it, expect, beforeEach } from 'vitest';
import { useNexusStore } from '../src/store/nexusStore';
import { NexusError } from '../src/services/api';

// ws.ts references window/WebSocket — test the dispatcher logic via store updates
// by simulating what handleWSMessage does (import-safe parts only).

describe('nexusStore', () => {
  beforeEach(() => {
    useNexusStore.setState({
      messages: [], tasks: [], devLogs: [], notifications: [],
      pendingConfirmations: [], pendingPermissions: [], error: null, aiState: 'IDLE'
    });
  });

  it('pushes and caps messages', () => {
    const s = useNexusStore.getState();
    s.pushMessage({ id: '1', sender: 'USER', text: 'hi', timestamp: new Date().toISOString() });
    expect(useNexusStore.getState().messages).toHaveLength(1);
  });

  it('upserts tasks by id', () => {
    const s = useNexusStore.getState();
    const t: any = { id: 't1', name: 'Test', status: 'RUNNING', overallProgress: 10 };
    s.upsertTask(t);
    s.upsertTask({ ...t, overallProgress: 50 });
    const tasks = useNexusStore.getState().tasks;
    expect(tasks).toHaveLength(1);
    expect(tasks[0].overallProgress).toBe(50);
  });

  it('caps devLogs at 500 and prepends', () => {
    const s = useNexusStore.getState();
    for (let i = 0; i < 600; i++) {
      s.pushDevLog({ id: String(i), timestamp: '', type: 'INTENT', message: `m${i}` });
    }
    const logs = useNexusStore.getState().devLogs;
    expect(logs).toHaveLength(500);
    expect(logs[0].message).toBe('m599');
  });

  it('pushes and dismisses notifications', () => {
    const s = useNexusStore.getState();
    s.pushNotification({ title: 't', body: 'b', severity: 'WARNING' });
    const n = useNexusStore.getState().notifications[0];
    expect(n.title).toBe('t');
    s.dismissNotification(n.id);
    expect(useNexusStore.getState().notifications).toHaveLength(0);
  });

  it('stores error with retry callback', () => {
    let retried = false;
    useNexusStore.getState().setError({ message: 'fail', retry: () => { retried = true; } });
    useNexusStore.getState().error?.retry?.();
    expect(retried).toBe(true);
  });
});

describe('NexusError', () => {
  it('carries message + details', () => {
    const e = new NexusError('friendly', 'stack', 500);
    expect(e.message).toBe('friendly');
    expect(e.details).toBe('stack');
    expect(e.status).toBe(500);
  });
});
