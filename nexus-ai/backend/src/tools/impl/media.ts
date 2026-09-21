import { spawn, execFileSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { ToolContext, ok, fail } from './helpers';
import { getLogger } from '../../core/logger';

let ffmpegAvailable: boolean | null = null;
export function ffmpegInstalled(): boolean {
  if (ffmpegAvailable !== null) return ffmpegAvailable;
  try {
    execFileSync('ffmpeg', ['-version'], { stdio: 'pipe' });
    ffmpegAvailable = true;
  } catch {
    ffmpegAvailable = false;
  }
  return ffmpegAvailable;
}

const FFMPEG_HINT = 'FFmpeg not installed. Install with: sudo apt install ffmpeg (Linux) or brew install ffmpeg (macOS).';

function runFFmpeg(args: string[], onProgress?: (pct: number) => void): Promise<{ ok: boolean; stderr: string }> {
  return new Promise((resolve) => {
    const proc = spawn('ffmpeg', ['-y', ...args]);
    let stderr = '';
    proc.stderr.on('data', (d) => {
      stderr += d.toString();
      if (onProgress) {
        const matches = [...stderr.matchAll(/time=(\d+):(\d+):([\d.]+)/g)];
        const last = matches[matches.length - 1];
        if (last) {
          const secs = Number(last[1]) * 3600 + Number(last[2]) * 60 + Number(last[3]);
          onProgress(secs);
        }
      }
    });
    proc.on('error', (e) => resolve({ ok: false, stderr: e.message }));
    proc.on('exit', (code) => resolve({ ok: code === 0, stderr }));
  });
}

export async function video_editor(params: Record<string, any>, ctx: ToolContext) {
  if (!ffmpegInstalled()) return fail('video_editor', FFMPEG_HINT);
  const title = String(params.title || 'NEXUS Production');
  const durationSec = Math.min(Math.max(Number(params.durationSec) || 15, 2), 120);
  const clips: string[] = Array.isArray(params.clips) ? params.clips : [];
  const exportsDir = ctx.permissions.storagePath('Exports');
  const outPath = path.join(exportsDir, `nexus_${Date.now()}.mp4`);
  const safeTitle = title.replace(/'/g, '').replace(/:/g, '-').slice(0, 60);

  let args: string[];
  if (clips.length > 0 && clips.every(c => fs.existsSync(c))) {
    const listFile = path.join(exportsDir, `concat_${Date.now()}.txt`);
    fs.writeFileSync(listFile, clips.map(c => `file '${c}'`).join('\n'));
    args = ['-f', 'concat', '-safe', '0', '-i', listFile,
      '-vf', `drawtext=text='${safeTitle}':fontcolor=white:fontsize=48:x=(w-text_w)/2:y=40`,
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p', outPath];
  } else {
    args = ['-f', 'lavfi', '-i', `color=c=0x0a0a1e:s=1280x720:d=${durationSec}:r=30`,
      '-f', 'lavfi', '-i', `sine=frequency=220:duration=${durationSec}`,
      '-vf', `drawtext=text='${safeTitle}':fontcolor=white:fontsize=64:x=(w-text_w)/2:y=(h-text_h)/2,drawtext=text='NEXUS AI':fontcolor=0x66ccff:fontsize=32:x=(w-text_w)/2:y=h-80`,
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', outPath];
  }

  const res = await runFFmpeg(args, (secs) => {
    ctx.broadcast('DEV_LOG', {
      id: `ff_${Date.now()}`, timestamp: new Date().toISOString(), type: 'STATE_CHANGE',
      message: `[FFmpeg] render ${Math.round((secs / durationSec) * 100)}%`
    });
  });
  if (!res.ok || !fs.existsSync(outPath)) {
    getLogger().error('ffmpeg render failed', res.stderr.slice(-500));
    return fail('video_editor', 'FFmpeg render failed.', { stderr: res.stderr.slice(-500) });
  }
  return ok('video_editor', { path: outPath, durationSec }, `Rendered video to ${outPath}.`);
}

export async function image_generator(params: Record<string, any>, ctx: ToolContext) {
  if (!ffmpegInstalled()) return fail('image_generator', FFMPEG_HINT);
  const title = String(params.title || params.prompt || 'NEXUS');
  const dir = ctx.permissions.storagePath('Thumbnails');
  const outPath = path.join(dir, `thumb_${Date.now()}.png`);
  const safeTitle = title.replace(/'/g, '').replace(/:/g, '-').slice(0, 60);
  const res = await runFFmpeg([
    '-f', 'lavfi', '-i', 'gradients=s=1280x720:c0=0x0a0a1e:c1=0x1e3a5f:d=1',
    '-frames:v', '1',
    '-vf', `drawtext=text='${safeTitle}':fontcolor=white:fontsize=64:x=(w-text_w)/2:y=(h-text_h)/2`,
    outPath
  ]);
  if (!res.ok || !fs.existsSync(outPath)) {
    return fail('image_generator', 'Thumbnail render failed.', { stderr: res.stderr.slice(-300) });
  }
  return ok('image_generator', { path: outPath }, `Thumbnail saved to ${outPath}.`);
}

let ttsBinary: string | null | undefined;
function findTTS(): string | null {
  if (ttsBinary !== undefined) return ttsBinary;
  for (const bin of ['espeak-ng', 'espeak', 'say']) {
    try { execFileSync('which', [bin], { stdio: 'pipe' }); ttsBinary = bin; return bin; } catch { /* next */ }
  }
  ttsBinary = null;
  return null;
}

export async function audio_generator(params: Record<string, any>, ctx: ToolContext) {
  const text = String(params.scriptText || params.text || 'NEXUS AI production.');
  const dir = ctx.permissions.storagePath('Audio');
  const outPath = path.join(dir, `tts_${Date.now()}.wav`);
  const bin = findTTS();
  if (!bin) {
    return fail('audio_generator', 'No TTS engine found. Install espeak-ng (apt install espeak-ng) or run on macOS for "say".');
  }
  try {
    if (bin === 'say') {
      execFileSync('say', ['-o', outPath, text.slice(0, 5000)]);
    } else {
      execFileSync(bin, ['-w', outPath, text.slice(0, 5000)]);
    }
    return ok('audio_generator', { path: outPath, engine: bin }, `Audio synthesized to ${outPath}.`);
  } catch (e: any) {
    return fail('audio_generator', `TTS failed: ${e.message}`);
  }
}

export async function video_generator(params: Record<string, any>, ctx: ToolContext) {
  const gameTitle = String(params.gameTitle || 'GTA V');
  const style = String(params.style || 'Fast Cinematic');
  try {
    const { taskId } = await ctx.gaming.startProduction(gameTitle, style);
    return ok('video_generator', { taskId, gameTitle, style }, `Production task started for ${gameTitle} (${style}).`);
  } catch (e: any) {
    return fail('video_generator', `Could not start production: ${e.message}`);
  }
}

export async function youtube(params: Record<string, any>, ctx: ToolContext) {
  const action = String(params.action || 'get_status');
  if (!ctx.youtube.isConfigured()) {
    return fail('youtube', 'YouTube not configured — set YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET, then authorize via /api/youtube/auth/url.');
  }
  switch (action) {
    case 'get_status': {
      const info = await ctx.youtube.getChannelInfo();
      if (!info.isConnected) return fail('youtube', 'YouTube account not connected. Complete OAuth via /api/youtube/auth/url.', info);
      return ok('youtube', info, `Channel "${info.channelName}" — ${info.subscriberCount} subscribers.`);
    }
    case 'queue':
      return ok('youtube', { queue: ctx.youtube.getQueue() }, 'Upload queue retrieved.');
    case 'publish': {
      const id = String(params.id || params.videoId || '');
      if (!id) return fail('youtube', 'id parameter required for publish');
      const res = await ctx.youtube.approveAndPublish(id);
      return res.ok ? ok('youtube', res, res.message) : fail('youtube', res.message);
    }
    default:
      return fail('youtube', `Unknown youtube action "${action}". Supported: get_status, queue, publish.`);
  }
}
