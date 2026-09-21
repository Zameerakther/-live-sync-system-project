import React, { useRef, useEffect } from 'react';
import { AIState } from '../types';

interface AICoreProps {
  state: AIState;
  getWaveform: () => Uint8Array;
  activeTaskProgress?: number;
  activeTaskName?: string;
  onClick?: () => void;
}

const STATE_COLORS: Record<AIState, { primary: string; secondary: string; speed: number }> = {
  IDLE:      { primary: '#00f0ff', secondary: '#0066ff', speed: 0.006 },
  LISTENING: { primary: '#00ffff', secondary: '#00f0ff', speed: 0.016 },
  THINKING:  { primary: '#c77dff', secondary: '#00f0ff', speed: 0.045 },
  SPEAKING:  { primary: '#4d9fff', secondary: '#00ffff', speed: 0.02 },
  EXECUTING: { primary: '#ffb700', secondary: '#00f0ff', speed: 0.028 },
  SUCCESS:   { primary: '#00ff88', secondary: '#00f0ff', speed: 0.012 },
  WARNING:   { primary: '#ffb700', secondary: '#ff8800', speed: 0.035 },
  ERROR:     { primary: '#ff2a2a', secondary: '#ffb700', speed: 0.04 }
};

export const AICore: React.FC<AICoreProps> = ({ state, getWaveform, activeTaskProgress = 0, activeTaskName, onClick }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // Refs so the rAF loop never restarts on prop change
  const stateRef = useRef(state);
  const progressRef = useRef(activeTaskProgress);
  const waveformRef = useRef(getWaveform);
  stateRef.current = state;
  progressRef.current = activeTaskProgress;
  waveformRef.current = getWaveform;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let raf = 0;
    let angle = 0;
    let pulse = 0;           // SUCCESS expanding pulse
    let flicker = 0;

    const particles = Array.from({ length: 80 }, () => ({
      angle: Math.random() * Math.PI * 2,
      dist: 0.55 + Math.random() * 0.45, // fraction of radius
      speed: 0.004 + Math.random() * 0.012,
      size: 0.5 + Math.random() * 1.8
    }));

    const resize = () => {
      const size = canvas.clientWidth;
      canvas.width = size * dpr;
      canvas.height = size * dpr;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const drawRing = (r: number, rot: number, color: string, width: number, dash: number[], ticks = 0) => {
      ctx.save();
      ctx.translate(0, 0);
      ctx.rotate(rot);
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.setLineDash(dash);
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      if (ticks > 0) {
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        for (let i = 0; i < ticks; i++) {
          const a = (i / ticks) * Math.PI * 2;
          const inner = r - 4 * dpr;
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * inner, Math.sin(a) * inner);
          ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
          ctx.stroke();
        }
      }
      ctx.restore();
    };

    const render = () => {
      const w = canvas.width, h = canvas.height;
      const cx = w / 2, cy = h / 2;
      const R = Math.min(w, h) / 2 - 6 * dpr;
      const s = STATE_COLORS[stateRef.current] || STATE_COLORS.IDLE;
      const st = stateRef.current;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
      ctx.translate(cx / dpr, cy / dpr);

      angle += s.speed;
      flicker += 0.15;

      // ERROR/WARNING flicker
      const alpha = (st === 'ERROR' || st === 'WARNING')
        ? 0.7 + 0.3 * Math.abs(Math.sin(flicker * 3))
        : 1;
      ctx.globalAlpha = alpha;

      const rOuter = R * 0.95, r2 = R * 0.78, r3 = R * 0.62, r4 = R * 0.5;

      // 4 concentric counter-rotating rings
      drawRing(rOuter / dpr, angle, s.primary + '55', 1 * dpr, [2 * dpr, 6 * dpr], 48);
      drawRing(r2 / dpr, -angle * 1.5, s.secondary, 2 * dpr, [30 * dpr, 14 * dpr, 6 * dpr, 14 * dpr]);
      drawRing(r3 / dpr, angle * 0.8, s.primary, 2.5 * dpr, [18 * dpr, 12 * dpr]);
      drawRing(r4 / dpr, -angle * 0.6, s.primary + '88', 1 * dpr, [4 * dpr, 10 * dpr], 24);

      // THINKING: inner sweep arc
      if (st === 'THINKING') {
        ctx.save();
        ctx.rotate(angle * 3);
        ctx.strokeStyle = s.primary;
        ctx.lineWidth = 3 * dpr;
        ctx.shadowColor = s.primary;
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(0, 0, r4 * 0.8 / dpr, 0, Math.PI * 0.5);
        ctx.stroke();
        ctx.restore();
      }

      // EXECUTING: progress arc
      if (st === 'EXECUTING' && progressRef.current > 0) {
        ctx.save();
        ctx.rotate(-Math.PI / 2);
        ctx.strokeStyle = '#ffb700';
        ctx.lineWidth = 5 * dpr;
        ctx.shadowColor = '#ffb700';
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.arc(0, 0, r2 * 0.9 / dpr, 0, Math.PI * 2 * progressRef.current / 100);
        ctx.stroke();
        ctx.restore();
      }

      // SUCCESS: expanding pulse ring
      if (st === 'SUCCESS') {
        pulse = (pulse + 0.02) % 1;
        ctx.strokeStyle = `rgba(0,255,136,${1 - pulse})`;
        ctx.lineWidth = 2 * dpr;
        ctx.beginPath();
        ctx.arc(0, 0, rOuter * 0.3 / dpr + pulse * rOuter * 0.6 / dpr, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Waveform ring when LISTENING / SPEAKING
      if (st === 'LISTENING' || st === 'SPEAKING') {
        const wave = waveformRef.current();
        if (wave.length) {
          const base = r4 * 1.05 / dpr;
          ctx.strokeStyle = s.primary;
          ctx.lineWidth = 1.8 * dpr;
          ctx.shadowColor = s.primary;
          ctx.shadowBlur = 6;
          ctx.beginPath();
          const N = 96;
          for (let i = 0; i <= N; i++) {
            const idx = Math.floor((i / N) * (wave.length - 1));
            const amp = ((wave[idx] - 128) / 128) * r4 * 0.35 / dpr;
            const rr = base + amp;
            const a = (i / N) * Math.PI * 2;
            const x = Math.cos(a) * rr, y = Math.sin(a) * rr;
            i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
          }
          ctx.closePath();
          ctx.stroke();
          ctx.shadowBlur = 0;
        }
      }

      // Inner orb — radial gradient + bloom
      const orbR = r4 * 0.75 / dpr;
      const g = ctx.createRadialGradient(0, 0, orbR * 0.1, 0, 0, orbR * 1.4);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(0.35, s.primary);
      g.addColorStop(0.75, s.secondary + '66');
      g.addColorStop(1, 'transparent');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, orbR * 1.4, 0, Math.PI * 2);
      ctx.fill();

      // Orbiting particle streams (faster when THINKING)
      const pSpeed = st === 'THINKING' ? 3 : 1;
      ctx.fillStyle = s.primary;
      ctx.shadowColor = s.primary;
      ctx.shadowBlur = 6;
      for (const p of particles) {
        p.angle += p.speed * pSpeed;
        const rr = p.dist * rOuter / dpr;
        ctx.beginPath();
        ctx.arc(Math.cos(p.angle) * rr, Math.sin(p.angle) * rr, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;

      raf = requestAnimationFrame(render);
    };
    raf = requestAnimationFrame(render);

    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);

  return (
    <div className="relative flex flex-col items-center justify-center cursor-pointer select-none" onClick={onClick}
         style={{ width: 'min(48vh, 520px)', height: 'min(48vh, 520px)', willChange: 'transform', transform: 'translateZ(0)' }}>
      <canvas ref={canvasRef} className="w-full h-full" />
      <div className="absolute -bottom-2 px-4 py-1 rounded-full hud-glass text-xs font-orbitron font-semibold tracking-widest uppercase flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full animate-ping ${
          state === 'ERROR' ? 'bg-red-500' : state === 'WARNING' ? 'bg-amber-400' :
          state === 'THINKING' ? 'bg-fuchsia-400' : state === 'EXECUTING' ? 'bg-amber-400' :
          state === 'SUCCESS' ? 'bg-emerald-400' : 'bg-cyan-400'
        }`} />
        <span className="text-cyan-300">{state}</span>
        {state === 'EXECUTING' && activeTaskName && (
          <span className="text-amber-300 normal-case tracking-normal font-rajdhani truncate max-w-[180px]">{activeTaskName} {Math.round(activeTaskProgress)}%</span>
        )}
      </div>
    </div>
  );
};
