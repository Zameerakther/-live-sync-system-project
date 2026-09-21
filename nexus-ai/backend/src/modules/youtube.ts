import { YouTubeChannelInfo, YouTubeVideoMetadata } from '../types';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import fs from 'fs';
import { getDB, getSetting, setSetting } from '../database';
import { getLogger } from '../core/logger';

const ENC_KEY = () => crypto.createHash('sha256').update(process.env.NEXUS_ENCRYPTION_KEY || 'nexus-default-dev-key').digest();

function encrypt(text: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', ENC_KEY(), iv);
  const enc = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  return JSON.stringify({ iv: iv.toString('hex'), tag: cipher.getAuthTag().toString('hex'), data: enc.toString('hex') });
}

function decrypt(payload: string): string {
  const { iv, tag, data } = JSON.parse(payload);
  const decipher = crypto.createDecipheriv('aes-256-gcm', ENC_KEY(), Buffer.from(iv, 'hex'));
  decipher.setAuthTag(Buffer.from(tag, 'hex'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'hex')), decipher.final()]).toString('utf8');
}

export class YouTubeModule {
  private oauth2: any = null;
  private configured: boolean = false;
  private broadcastFn?: (type: string, data: any) => void;

  setBroadcast(fn: (type: string, data: any) => void) { this.broadcastFn = fn; }
  private notifyQueue() { try { this.broadcastFn?.('QUEUE_UPDATED', this.getQueue()); } catch { /* non-fatal */ } }

  constructor() {
    const clientId = process.env.YOUTUBE_CLIENT_ID;
    const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
    const redirectUri = process.env.YOUTUBE_REDIRECT_URI || 'http://localhost:5000/api/youtube/oauth2callback';
    this.configured = !!(clientId && !clientId.startsWith('your_') && clientSecret && !clientSecret.startsWith('your_'));
    if (this.configured) {
      try {
        const { google } = require('googleapis');
        this.oauth2 = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
        const stored = getSetting('youtube_tokens');
        if (stored) {
          this.oauth2.setCredentials(JSON.parse(decrypt(stored)));
        }
      } catch (e) {
        getLogger().warn('googleapis init failed', e);
      }
    }
  }

  isConfigured(): boolean { return this.configured; }

  getAuthUrl(): string | null {
    if (!this.oauth2) return null;
    return this.oauth2.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: [
        'https://www.googleapis.com/auth/youtube.readonly',
        'https://www.googleapis.com/auth/youtube.upload'
      ]
    });
  }

  async handleOAuthCallback(code: string): Promise<boolean> {
    if (!this.oauth2) return false;
    const { tokens } = await this.oauth2.getToken(code);
    this.oauth2.setCredentials(tokens);
    setSetting('youtube_tokens', encrypt(JSON.stringify(tokens)));
    getLogger().info('YouTube OAuth tokens stored (encrypted).');
    return true;
  }

  private youtubeClient(): any {
    if (!this.oauth2) return null;
    const { google } = require('googleapis');
    return google.youtube({ version: 'v3', auth: this.oauth2 });
  }

  async getChannelInfo(): Promise<YouTubeChannelInfo> {
    const mode = (getSetting('autoPublishMode') as string) || 'APPROVAL';
    const schedule = (getSetting('publishSchedule') as string[]) || [];
    const base: YouTubeChannelInfo = {
      channelName: '', subscriberCount: 0, videoCount: 0, totalViews: 0,
      isConnected: false, autoPublishMode: mode === 'AUTO' ? 'AUTO' : 'APPROVAL',
      publishSchedule: schedule
    };
    const yt = this.youtubeClient();
    if (!yt || !this.oauth2.credentials?.access_token) return base;
    try {
      const res = await yt.channels.list({ part: ['snippet', 'statistics'], mine: true });
      const ch = res.data.items?.[0];
      if (!ch) return base;
      return {
        ...base,
        channelName: ch.snippet?.title || '',
        subscriberCount: Number(ch.statistics?.subscriberCount || 0),
        videoCount: Number(ch.statistics?.videoCount || 0),
        totalViews: Number(ch.statistics?.viewCount || 0),
        isConnected: true
      };
    } catch (e) {
      getLogger().error('YouTube channels.list failed', e);
      return base;
    }
  }

  getQueue(): YouTubeVideoMetadata[] {
    const rows = getDB().prepare('SELECT * FROM youtube_queue ORDER BY created_at DESC').all() as any[];
    return rows.map(r => ({
      id: r.id, title: r.title, description: r.description || '',
      tags: JSON.parse(r.tags || '[]'), thumbnailUrl: r.thumbnail_url || undefined,
      scheduledTime: r.scheduled_time || undefined, status: r.status
    }));
  }

  enqueue(video: Omit<YouTubeVideoMetadata, 'id' | 'status'> & { videoPath?: string; status?: YouTubeVideoMetadata['status'] }): YouTubeVideoMetadata {
    const id = uuidv4();
    const status = video.status || 'READY_FOR_APPROVAL';
    getDB().prepare(`INSERT INTO youtube_queue (id, title, description, tags, thumbnail_url, video_path, scheduled_time, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, video.title, video.description || '', JSON.stringify(video.tags || []),
        video.thumbnailUrl || null, (video as any).videoPath || null, video.scheduledTime || null,
        status, new Date().toISOString());
    const item = { id, ...video, status };
    this.notifyQueue();
    return item;
  }

  updateStatus(id: string, status: YouTubeVideoMetadata['status']) {
    getDB().prepare('UPDATE youtube_queue SET status = ? WHERE id = ?').run(status, id);
    this.notifyQueue();
  }

  updateAutoPublishMode(mode: 'AUTO' | 'APPROVAL') {
    setSetting('autoPublishMode', mode);
  }

  /** Approve and upload a queued video via resumable upload + thumbnails.set + optional publishAt. */
  async approveAndPublish(id: string): Promise<{ ok: boolean; message: string; videoId?: string }> {
    const row = getDB().prepare('SELECT * FROM youtube_queue WHERE id = ?').get(id) as any;
    if (!row) return { ok: false, message: 'Queue item not found' };
    if (!this.configured) return { ok: false, message: 'YouTube not configured — set YOUTUBE_CLIENT_ID/SECRET and complete OAuth.' };
    const yt = this.youtubeClient();
    if (!yt) return { ok: false, message: 'YouTube not authenticated. Visit /api/youtube/auth/url first.' };
    if (!row.video_path || !fs.existsSync(row.video_path)) {
      return { ok: false, message: `Video file missing: ${row.video_path || '(none recorded)'}` };
    }
    try {
      this.updateStatus(id, 'UPLOADING');
      const insertRes = await yt.videos.insert({
        part: ['snippet', 'status'],
        requestBody: {
          snippet: { title: row.title, description: row.description, tags: JSON.parse(row.tags || '[]') },
          status: row.scheduled_time
            ? { privacyStatus: 'private', publishAt: row.scheduled_time }
            : { privacyStatus: 'private' }
        },
        media: { body: fs.createReadStream(row.video_path) }
      });
      const videoId = insertRes.data.id;
      if (row.thumbnail_url && fs.existsSync(row.thumbnail_url) && videoId) {
        try {
          await yt.thumbnails.set({ videoId, media: { body: fs.createReadStream(row.thumbnail_url) } });
        } catch (e) { getLogger().warn('thumbnail.set failed', e); }
      }
      this.updateStatus(id, 'PUBLISHED');
      return { ok: true, message: `Uploaded to YouTube as video ${videoId}`, videoId };
    } catch (e: any) {
      this.updateStatus(id, 'FAILED');
      getLogger().error('YouTube upload failed', e);
      return { ok: false, message: `Upload failed: ${e.message}` };
    }
  }
}
