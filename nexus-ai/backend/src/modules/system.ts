import { SystemMetrics } from '../types';
import si from 'systeminformation';
import { getLogger } from '../core/logger';

export class SystemMonitorModule {
  private lastNet: { rx: number; tx: number; ts: number } | null = null;
  private gpuCache: { name?: string; usage: number | null; ts: number } = { usage: null, ts: 0 };
  private cpuName: string | undefined;

  async getMetrics(): Promise<SystemMetrics> {
    try {
      const [load, mem, fsSize, net, temp] = await Promise.all([
        si.currentLoad(),
        si.mem(),
        si.fsSize(),
        si.networkStats(),
        si.cpuTemperature().catch(() => ({ main: null } as any))
      ]);

      if (!this.cpuName) {
        si.cpu().then(c => { this.cpuName = c.brand || undefined; }).catch(() => {});
      }

      // GPU usage — only when measurable; refresh every 10s
      let gpuUsage: number | null = this.gpuCache.usage;
      let gpuName = this.gpuCache.name;
      if (Date.now() - this.gpuCache.ts > 10000) {
        this.gpuCache.ts = Date.now();
        si.graphics().then(g => {
          const ctrl = g?.controllers?.[0];
          const util = (ctrl as any)?.utilizationGpu;
          this.gpuCache = {
            usage: typeof util === 'number' ? Math.round(util) : null,
            name: ctrl?.model || undefined,
            ts: Date.now()
          };
        }).catch(() => { this.gpuCache.usage = null; });
      }

      // Network speed in Mbps from rx/tx delta
      let networkSpeed = 0;
      const rx = net.reduce((a, n) => a + (n.rx_bytes || 0), 0);
      const tx = net.reduce((a, n) => a + (n.tx_bytes || 0), 0);
      const now = Date.now();
      if (this.lastNet) {
        const dt = (now - this.lastNet.ts) / 1000;
        if (dt > 0) {
          networkSpeed = Math.round((((rx - this.lastNet.rx) + (tx - this.lastNet.tx)) * 8) / dt / 1e6 * 100) / 100;
        }
      }
      this.lastNet = { rx, tx, ts: now };

      const fs0 = fsSize.find(f => f.mount === '/') || fsSize[0];
      const diskUsage = fs0 ? Math.round(fs0.use) : 0;
      const storageFreeGb = fs0 ? Math.round(fs0.available / 1e9) : 0;

      return {
        cpuUsage: Math.round(load.currentLoad),
        gpuUsage,
        ramUsage: Math.round((mem.used / mem.total) * 100),
        diskUsage,
        networkSpeed,
        temperature: typeof temp.main === 'number' ? temp.main : null,
        storageFreeGb,
        gpuName,
        cpuName: this.cpuName
      };
    } catch (err) {
      getLogger().error('systeminformation metrics failed', err);
      return {
        cpuUsage: 0, gpuUsage: null, ramUsage: 0, diskUsage: 0,
        networkSpeed: 0, temperature: null, storageFreeGb: 0
      };
    }
  }
}
