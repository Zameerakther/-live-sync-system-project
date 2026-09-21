import React, { useRef, useEffect } from 'react';
import { AIState } from '../types';

interface AICoreProps {
  state: AIState;
  audioLevel?: number; // 0.0 to 1.0
  activeTaskProgress?: number; // 0 to 100
  onClick?: () => void;
}

export const AICore: React.FC<AICoreProps> = ({
  state,
  audioLevel = 0.0,
  activeTaskProgress = 0,
  onClick
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let rotationAngle = 0;
    let particles: Array<{ x: number; y: number; size: number; speed: number; angle: number; dist: number }> = [];

    // Initialize 60 ambient particles around core
    for (let i = 0; i < 60; i++) {
      particles.push({
        x: 0,
        y: 0,
        size: Math.random() * 2 + 1,
        speed: Math.random() * 0.02 + 0.005,
        angle: Math.random() * Math.PI * 2,
        dist: 70 + Math.random() * 90
      });
    }

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;
      const centerX = width / 2;
      const centerY = height / 2;

      ctx.clearRect(0, 0, width, height);

      // Determine state colors
      let primaryColor = '#00f0ff'; // Cyan
      let secondaryColor = '#0066ff'; // Blue
      let ringSpeed = 0.01;

      switch (state) {
        case 'LISTENING':
          primaryColor = '#00ffff';
          secondaryColor = '#00f0ff';
          ringSpeed = 0.02;
          break;
        case 'THINKING':
          primaryColor = '#ff0077'; // Magenta
          secondaryColor = '#00f0ff';
          ringSpeed = 0.05;
          break;
        case 'SPEAKING':
          primaryColor = '#0066ff';
          secondaryColor = '#00ffff';
          ringSpeed = 0.025;
          break;
        case 'EXECUTING':
          primaryColor = '#ffb700'; // Gold
          secondaryColor = '#00f0ff';
          ringSpeed = 0.03;
          break;
        case 'SUCCESS':
          primaryColor = '#00ff88'; // Emerald
          secondaryColor = '#00f0ff';
          ringSpeed = 0.015;
          break;
        case 'WARNING':
        case 'ERROR':
          primaryColor = '#ff2a2a'; // Danger Red
          secondaryColor = '#ffb700';
          ringSpeed = 0.04;
          break;
        case 'IDLE':
        default:
          primaryColor = '#00f0ff';
          secondaryColor = '#0066ff';
          ringSpeed = 0.008;
          break;
      }

      rotationAngle += ringSpeed;

      // 1. Central Orb Glow Base
      const pulseFactor = state === 'SPEAKING' || state === 'LISTENING' 
        ? 1 + audioLevel * 0.45 
        : 1 + Math.sin(rotationAngle * 2) * 0.08;

      const baseRadius = 55 * pulseFactor;

      const orbGradient = ctx.createRadialGradient(centerX, centerY, 5, centerX, centerY, baseRadius * 1.6);
      orbGradient.addColorStop(0, '#ffffff');
      orbGradient.addColorStop(0.3, primaryColor);
      orbGradient.addColorStop(0.7, secondaryColor);
      orbGradient.addColorStop(1, 'transparent');

      ctx.beginPath();
      ctx.arc(centerX, centerY, baseRadius * 1.5, 0, Math.PI * 2);
      ctx.fillStyle = orbGradient;
      ctx.fill();

      // 2. Audio Waveform Inner Circle
      if (state === 'LISTENING' || state === 'SPEAKING') {
        const waveBars = 32;
        const waveRadius = baseRadius + 15;
        ctx.strokeStyle = primaryColor;
        ctx.lineWidth = 2;

        for (let i = 0; i < waveBars; i++) {
          const angle = (i / waveBars) * Math.PI * 2;
          const barHeight = Math.random() * 20 * audioLevel + 4;

          const x1 = centerX + Math.cos(angle) * waveRadius;
          const y1 = centerY + Math.sin(angle) * waveRadius;
          const x2 = centerX + Math.cos(angle) * (waveRadius + barHeight);
          const y2 = centerY + Math.sin(angle) * (waveRadius + barHeight);

          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
        }
      }

      // 3. Three Rotating Concentric Energy Rings
      // Ring 1 - Outer segmented ring
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(rotationAngle);
      ctx.strokeStyle = primaryColor;
      ctx.lineWidth = 3;
      ctx.setLineDash([20, 15, 5, 15]);
      ctx.beginPath();
      ctx.arc(0, 0, 90, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // Ring 2 - Reverse rotating dashed ring
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(-rotationAngle * 1.4);
      ctx.strokeStyle = secondaryColor;
      ctx.lineWidth = 2;
      ctx.setLineDash([40, 20]);
      ctx.beginPath();
      ctx.arc(0, 0, 115, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // Ring 3 - Outer thin telemetry ring
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(rotationAngle * 0.7);
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.3)';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 8]);
      ctx.beginPath();
      ctx.arc(0, 0, 135, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // 4. Executing State Task Progress Ring
      if (state === 'EXECUTING' && activeTaskProgress > 0) {
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(-Math.PI / 2);
        ctx.strokeStyle = '#ffb700';
        ctx.lineWidth = 6;
        ctx.shadowColor = '#ffb700';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(0, 0, 102, 0, (Math.PI * 2 * activeTaskProgress) / 100);
        ctx.stroke();
        ctx.restore();
      }

      // 5. Data Particles Orbiting Core
      particles.forEach((p) => {
        p.angle += p.speed * (state === 'THINKING' ? 2.5 : 1);
        const px = centerX + Math.cos(p.angle) * p.dist;
        const py = centerY + Math.sin(p.angle) * p.dist;

        ctx.beginPath();
        ctx.arc(px, py, p.size, 0, Math.PI * 2);
        ctx.fillStyle = primaryColor;
        ctx.shadowColor = primaryColor;
        ctx.shadowBlur = 8;
        ctx.fill();
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [state, audioLevel, activeTaskProgress]);

  return (
    <div 
      className="relative flex flex-col items-center justify-center cursor-pointer group"
      onClick={onClick}
    >
      <canvas 
        ref={canvasRef} 
        width={340} 
        height={340} 
        className="w-[340px] h-[340px] transition-transform duration-500 group-hover:scale-105"
      />
      {/* State Text Label */}
      <div className="absolute bottom-2 px-4 py-1 rounded-full hud-glass text-xs font-orbitron font-semibold tracking-widest uppercase flex items-center gap-2 border border-cyan-500/30">
        <span className={`w-2 h-2 rounded-full animate-ping ${
          state === 'ERROR' || state === 'WARNING' ? 'bg-red-500' :
          state === 'THINKING' ? 'bg-fuchsia-500' :
          state === 'EXECUTING' ? 'bg-amber-400' : 'bg-cyan-400'
        }`} />
        <span className="text-cyan-300">{state}</span>
      </div>
    </div>
  );
};
