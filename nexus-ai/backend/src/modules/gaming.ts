import { GamingConcept } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { getDB, getSetting } from '../database';
import { getLogger } from '../core/logger';
import { AIProvider } from '../ai/provider';
import { TaskRunnerModule, StepFn } from './tasks';
import { YouTubeModule } from './youtube';
import path from 'path';
import fs from 'fs';

export const SUPPORTED_GAMES = ['GTA V', 'Red Dead Redemption 2', 'Minecraft', 'GTA Online'];

function tokenize(s: string): Set<string> {
  return new Set(s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 2));
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const w of a) if (b.has(w)) inter++;
  return inter / (a.size + b.size - inter);
}

export class GamingModule {
  private provider?: AIProvider;
  private taskRunner?: TaskRunnerModule;
  private youtube?: YouTubeModule;
  private tools?: any; // ToolRegistry

  wire(provider: AIProvider, taskRunner: TaskRunnerModule, youtube: YouTubeModule, tools: any) {
    this.provider = provider;
    this.taskRunner = taskRunner;
    this.youtube = youtube;
    this.tools = tools;
  }

  getHistory(): GamingConcept[] {
    const rows = getDB().prepare('SELECT * FROM gaming_concepts ORDER BY created_at DESC').all() as any[];
    return rows.map(r => ({
      id: r.id, gameTitle: r.game_title, conceptTitle: r.concept_title,
      style: r.style || '', scriptOutline: r.script_outline || '',
      gameplayPlan: r.gameplay_plan || '', commentaryStyle: r.commentary_style || '',
      targetDurationMin: r.target_duration_min || 10,
      recommendedHashtags: JSON.parse(r.recommended_hashtags || '[]'),
      originalityScore: r.originality_score, createdAt: r.created_at
    }));
  }

  similarityScore(title: string, concept: string): number {
    const target = tokenize(`${title} ${concept}`);
    let max = 0;
    const rows = getDB().prepare('SELECT concept_title, script_outline FROM gaming_concepts').all() as any[];
    for (const r of rows) {
      const score = jaccard(target, tokenize(`${r.concept_title} ${r.script_outline || ''}`));
      if (score > max) max = score;
    }
    return max;
  }

  async generateConcept(gameTitle: string = 'GTA V', style: string = 'Fast Cinematic'): Promise<GamingConcept> {
    let chosenTitle = '';
    let originalityScore = 0;

    // Originality check: up to 3 attempts at Jaccard <= 0.6
    for (let attempt = 0; attempt < 3; attempt++) {
      let candidate = '';
      if (this.provider && this.provider.name !== 'Mock Local AI Engine') {
        try {
          candidate = (await this.provider.generateText(
            `Invent an original YouTube gaming video concept title for ${gameTitle} in a "${style}" style. Reply with just the title, no quotes.`
          )).trim().split('\n')[0].trim();
        } catch { candidate = ''; }
      }
      if (!candidate || candidate.length < 8) {
        const { genIdea } = require('../ai/contentGen');
        candidate = genIdea(gameTitle, style);
      }
      const sim = this.similarityScore(candidate, style);
      if (sim <= 0.6 || attempt === 2) {
        chosenTitle = sim > 0.6 ? `${candidate} — Reloaded` : candidate;
        originalityScore = Math.round((1 - Math.min(sim, 1)) * 100);
        break;
      }
    }

    const concept: GamingConcept = {
      id: uuidv4(),
      gameTitle,
      conceptTitle: chosenTitle,
      style,
      scriptOutline: '1. Hook viewers in first 5s\n2. Intro & challenge explanation\n3. Tension escalation\n4. Climax execution\n5. Outro & CTA',
      gameplayPlan: `Objective: execute "${chosenTitle}". Style: ${style} camera work and pacing.`,
      commentaryStyle: 'Calm, Confident & Intelligent',
      targetDurationMin: 10,
      recommendedHashtags: [`#${gameTitle.replace(/\s+/g, '')}`, '#Gaming', '#NEXUSAI'],
      originalityScore,
      createdAt: new Date().toISOString()
    };

    getDB().prepare(`INSERT INTO gaming_concepts (id, game_title, concept_title, style, script_outline, gameplay_plan, commentary_style, target_duration_min, recommended_hashtags, originality_score, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(concept.id, concept.gameTitle, concept.conceptTitle, concept.style, concept.scriptOutline,
        concept.gameplayPlan, concept.commentaryStyle, concept.targetDurationMin,
        JSON.stringify(concept.recommendedHashtags), concept.originalityScore, concept.createdAt);

    return concept;
  }

  /** Full production pipeline — creates a real multi-step task. */
  async startProduction(gameTitle: string, style: string): Promise<{ taskId: string }> {
    if (!this.taskRunner) throw new Error('GamingModule not wired to TaskRunner');
    const self = this;

    const steps: string[] = [
      'Generate Video Idea & Concept',
      'Draft Script & Commentary Outline',
      'Plan Gameplay Sequence',
      'Generate Voice Commentary Audio',
      'Render Final Video (FFmpeg)',
      'Design Thumbnail',
      'Generate Title, Description & Hashtags',
      'Originality & Quality Check',
      'Queue to YouTube'
    ];

    const stepFns: StepFn[] = [
      // 1. Idea
      async (ctx, step, _t, update) => {
        update(30, '[GAMING]: Generating concept via Originality Engine...');
        const concept = await self.generateConcept(gameTitle, style);
        ctx.concept = concept;
        step.output = concept.conceptTitle;
        update(100, `[GAMING]: Concept "${concept.conceptTitle}" (originality ${concept.originalityScore}%).`);
      },
      // 2. Script
      async (ctx, step, _t, update) => {
        update(30);
        const script = await (self.provider?.generateScript(gameTitle, ctx.concept.conceptTitle)
          || Promise.resolve(`Script for ${ctx.concept.conceptTitle}`));
        ctx.script = script;
        const dir = self.scriptsDir();
        const p = path.join(dir, `${ctx.concept.id}.txt`);
        fs.writeFileSync(p, script);
        getDB().prepare('UPDATE gaming_concepts SET script = ? WHERE id = ?').run(script, ctx.concept.id);
        step.output = p;
        update(100, `[GAMING]: Script drafted and saved to ${p}.`);
      },
      // 3. Gameplay plan
      async (ctx, step, _t, update) => {
        const plan = await (self.provider?.generateText(
          `Create a gameplay plan for a ${gameTitle} video titled "${ctx.concept.conceptTitle}" in ${style} style. List shots, locations and mechanics.`
        ).catch(() => ctx.concept.gameplayPlan) || Promise.resolve(ctx.concept.gameplayPlan));
        ctx.gameplayPlan = plan;
        getDB().prepare('UPDATE gaming_concepts SET gameplay_plan = ? WHERE id = ?').run(plan, ctx.concept.id);
        step.output = plan.slice(0, 200);
        update(100, '[GAMING]: Gameplay sequence planned.');
      },
      // 4. Audio (non-fatal)
      async (ctx, step, _t, update) => {
        update(40);
        if (self.tools) {
          const res = await self.tools.executeTool('audio_generator', { scriptText: ctx.script, title: ctx.concept.conceptTitle });
          if (res.success) {
            ctx.audioPath = res.resultData?.path;
            step.output = ctx.audioPath;
            update(100, '[AUDIO]: Commentary audio synthesized.');
            return;
          }
          step.status = 'SKIPPED';
          step.output = res.message;
          update(100, `[AUDIO]: Skipped — ${res.message}`);
          return;
        }
        step.status = 'SKIPPED';
      },
      // 5. Render via video_editor
      async (ctx, step, task, update) => {
        if (!self.tools) throw new Error('Tool registry unavailable');
        const res = await self.tools.executeTool('video_editor', {
          title: ctx.concept.conceptTitle,
          durationSec: 15
        });
        if (!res.success) throw new Error(res.message);
        ctx.videoPath = res.resultData?.path;
        step.output = ctx.videoPath;
        update(100, `[VIDEO]: Rendered to ${ctx.videoPath}.`);
      },
      // 6. Thumbnail
      async (ctx, step, _t, update) => {
        update(40);
        if (!self.tools) throw new Error('Tool registry unavailable');
        const res = await self.tools.executeTool('image_generator', { title: ctx.concept.conceptTitle, style });
        if (!res.success) throw new Error(res.message);
        ctx.thumbnailPath = res.resultData?.path;
        step.output = ctx.thumbnailPath;
        update(100, `[THUMBNAIL]: Saved to ${ctx.thumbnailPath}.`);
      },
      // 7. Title/description/hashtags
      async (ctx, step, _t, update) => {
        update(40);
        let titles: string[] = [];
        try {
          const raw = await self.provider?.generateText(
            `Suggest 3 catchy YouTube titles and a short description with hashtags for a ${gameTitle} video about "${ctx.concept.conceptTitle}".`
          );
          titles = (raw || '').split('\n').map((l: string) => l.trim())
            .filter((l: string) => l.length > 5 && !l.startsWith('[') && !/^(suggest|here are|titles?)/i.test(l))
            .map((l: string) => l.replace(/^\d+[.)]\s*/, '').replace(/^["']|["']$/g, ''))
            .slice(0, 3);
        } catch { /* ignore */ }
        if (titles.length === 0) titles = [`${gameTitle}: ${ctx.concept.conceptTitle}`];
        ctx.titles = titles;
        const { genDescription } = require('../ai/contentGen');
        ctx.description = genDescription(gameTitle, ctx.concept.conceptTitle, ctx.concept.recommendedHashtags);
        getDB().prepare('UPDATE gaming_concepts SET video_titles = ? WHERE id = ?').run(JSON.stringify(titles), ctx.concept.id);
        step.output = titles[0];
        update(100, `[SEO]: Title selected: "${titles[0]}".`);
      },
      // 8. Originality QC
      async (ctx, step, _t, update) => {
        const sim = self.similarityScore(ctx.titles?.[0] || ctx.concept.conceptTitle, ctx.script || '');
        const score = Math.round((1 - Math.min(sim, 1)) * 100);
        ctx.qcScore = score;
        getDB().prepare('UPDATE gaming_concepts SET originality_score = ? WHERE id = ?').run(score, ctx.concept.id);
        step.output = `${score}%`;
        update(100, `[QC]: Originality verified at ${score}%.`);
      },
      // 9. Queue to YouTube
      async (ctx, step, _t, update) => {
        if (!self.youtube) throw new Error('YouTube module unavailable');
        const mode = (getSetting('autoPublishMode') as string) || 'APPROVAL';
        const queued = self.youtube.enqueue({
          title: ctx.titles?.[0] || `${gameTitle}: ${ctx.concept.conceptTitle}`,
          description: ctx.description || '',
          tags: ctx.concept.recommendedHashtags,
          thumbnailUrl: ctx.thumbnailPath,
          videoPath: ctx.videoPath,
          status: 'READY_FOR_APPROVAL'
        } as any);
        ctx.queueId = queued.id;
        step.output = queued.id;
        if (mode === 'AUTO' && self.youtube.isConfigured()) {
          update(60, '[YOUTUBE]: AUTO mode — uploading...');
          const res = await self.youtube.approveAndPublish(queued.id);
          update(100, `[YOUTUBE]: ${res.message}`);
        } else {
          update(100, '[YOUTUBE]: Queued as READY_FOR_APPROVAL.');
        }
      }
    ];

    const task = this.taskRunner.createTask(
      `${gameTitle} — ${style} Video Production`,
      'GAMING',
      steps,
      stepFns,
      { gameTitle, style }
    );
    return { taskId: task.id };
  }

  private scriptsDir(): string {
    const base = process.env.NEXUS_STORAGE_DIR || path.join(require('os').homedir(), 'NexusAI');
    const p = path.join(base, 'Scripts');
    fs.mkdirSync(p, { recursive: true });
    return p;
  }
}
