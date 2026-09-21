import { TaskItem, TaskStep } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { getDB } from '../database';
import { getLogger } from '../core/logger';

export interface TaskContext {
  [key: string]: any;
}

export type StepFn = (ctx: TaskContext, step: TaskStep, task: TaskItem, update: (progress: number, log?: string) => void) => Promise<void>;

interface RunningTask {
  task: TaskItem;
  ctx: TaskContext;
  stepFns: StepFn[];
  paused: boolean;
  cancelled: boolean;
}

export class TaskRunnerModule {
  private tasks: Map<string, TaskItem> = new Map();
  private running: Map<string, RunningTask> = new Map();
  private onTaskUpdateCallback?: (task: TaskItem) => void;
  private stateEmitter?: (state: string, detail?: string) => void;

  constructor() {
    // Load persisted tasks
    try {
      const rows = getDB().prepare('SELECT * FROM tasks ORDER BY started_at DESC').all() as any[];
      for (const r of rows) {
        const task: TaskItem = {
          id: r.id,
          name: r.name,
          category: r.category,
          status: r.status,
          overallProgress: r.overall_progress,
          startedAt: r.started_at,
          estimatedCompletionAt: r.estimated_completion_at || undefined,
          currentStepIndex: r.current_step_index,
          steps: JSON.parse(r.steps),
          logs: JSON.parse(r.logs)
        };
        // Tasks interrupted by shutdown are marked FAILED
        if (task.status === 'RUNNING' || task.status === 'PAUSED') {
          task.status = 'FAILED';
          task.logs.push('[SYSTEM]: Task interrupted by backend restart.');
          this.persist(task);
        }
        this.tasks.set(task.id, task);
      }
    } catch (e) {
      getLogger().warn('Could not load persisted tasks', e);
    }
  }

  public setTaskUpdateListener(listener: (task: TaskItem) => void) {
    this.onTaskUpdateCallback = listener;
  }

  public setStateEmitter(fn: (state: string, detail?: string) => void) {
    this.stateEmitter = fn;
  }

  private emitState(state: string, detail?: string) {
    try { this.stateEmitter?.(state, detail); } catch { /* listener errors must not kill the executor */ }
  }

  private persist(task: TaskItem, ctx?: TaskContext) {
    try {
      getDB().prepare(`INSERT INTO tasks (id, name, category, status, overall_progress, started_at, estimated_completion_at, current_step_index, steps, logs, context)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET status=excluded.status, overall_progress=excluded.overall_progress,
          current_step_index=excluded.current_step_index, steps=excluded.steps, logs=excluded.logs,
          estimated_completion_at=excluded.estimated_completion_at, context=excluded.context`)
        .run(task.id, task.name, task.category, task.status, task.overallProgress, task.startedAt,
          task.estimatedCompletionAt || null, task.currentStepIndex, JSON.stringify(task.steps),
          JSON.stringify(task.logs.slice(-200)), JSON.stringify(ctx || {}));
    } catch (e) {
      getLogger().warn('Task persist failed', e);
    }
  }

  private notify(task: TaskItem) {
    if (this.onTaskUpdateCallback) this.onTaskUpdateCallback(task);
  }

  getTasks(): TaskItem[] {
    return Array.from(this.tasks.values()).sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  }

  getTask(id: string): TaskItem | undefined {
    return this.tasks.get(id);
  }

  getContext(id: string): TaskContext | undefined {
    return this.running.get(id)?.ctx;
  }

  /**
   * Create a task with named steps. If stepFns given, executes them for real;
   * otherwise a minimal wait-step runs (placeholder for generic API-created tasks).
   */
  createTask(name: string, category: TaskItem['category'], stepNames: string[], stepFns?: StepFn[], ctx: TaskContext = {}): TaskItem {
    const steps: TaskStep[] = stepNames.map((s, idx) => ({
      id: uuidv4(),
      name: s.match(/^\d+\./) ? s : `${idx + 1}. ${s}`,
      status: 'WAITING',
      progress: 0
    }));

    const task: TaskItem = {
      id: uuidv4(),
      name,
      category,
      status: 'PENDING',
      overallProgress: 0,
      startedAt: new Date().toISOString(),
      currentStepIndex: 0,
      steps,
      logs: [`[SYSTEM]: Task "${name}" initialised.`]
    };

    this.tasks.set(task.id, task);
    this.persist(task, ctx);
    this.notify(task);

    const rt: RunningTask = { task, ctx, stepFns: stepFns || [], paused: false, cancelled: false };
    this.running.set(task.id, rt);
    this.execute(rt).catch(err => getLogger().error('Task executor error', err));

    return task;
  }

  private async execute(rt: RunningTask) {
    const { task, ctx, stepFns } = rt;
    task.status = 'RUNNING';
    this.persist(task, ctx);
    this.notify(task);

    for (let i = task.currentStepIndex; i < task.steps.length; i++) {
      // pause/cancel gates
      while (rt.paused && !rt.cancelled) {
        await new Promise(r => setTimeout(r, 500));
      }
      if (rt.cancelled) {
        task.status = 'CANCELLED';
        task.logs.push('[SYSTEM]: Task cancelled by user command.');
        this.persist(task, ctx);
        this.notify(task);
        this.running.delete(task.id);
        this.emitState('IDLE');
        return;
      }

      const step = task.steps[i];
      task.currentStepIndex = i;
      step.status = 'IN_PROGRESS';
      step.progress = 5;
      task.logs.push(`[EXECUTION]: Starting step "${step.name}".`);
      this.recalc(task);
      this.persist(task, ctx);
      this.notify(task);
      this.emitState('EXECUTING', `${task.name} — ${step.name} (${task.overallProgress}%)`);

      const update = (progress: number, log?: string) => {
        step.progress = Math.min(99, Math.max(step.progress, progress));
        if (log) task.logs.push(log);
        this.recalc(task);
        this.notify(task);
      };

      try {
        const fn = stepFns[i];
        if (fn) {
          await fn(ctx, step, task, update);
        } else {
          // Generic API-created task: minimal real wait step
          await new Promise(r => setTimeout(r, 500));
        }
        step.status = 'COMPLETE';
        step.progress = 100;
        task.logs.push(`[EXECUTION]: Completed step "${step.name}".`);
      } catch (err: any) {
        step.status = 'FAILED';
        step.error = err.message || String(err);
        task.status = 'FAILED';
        task.logs.push(`[ERROR]: Step "${step.name}" failed: ${step.error}`);
        this.recalc(task);
        this.persist(task, ctx);
        this.notify(task);
        this.running.delete(task.id);
        this.emitState('ERROR', `${task.name} — ${step.name} failed`);
        return;
      }
      this.recalc(task);
      this.persist(task, ctx);
      this.notify(task);
      this.emitState('EXECUTING', `${task.name} — ${task.overallProgress}%`);
    }

    task.status = 'COMPLETED';
    task.overallProgress = 100;
    task.logs.push(`[SYSTEM]: Task "${task.name}" completed successfully.`);
    this.persist(task, ctx);
    this.notify(task);
    this.running.delete(task.id);
    this.emitState('SUCCESS', `${task.name} completed`);
    setTimeout(() => this.emitState('IDLE'), 3000);
  }

  private recalc(task: TaskItem) {
    const total = task.steps.length;
    const done = task.steps.filter(s => s.status === 'COMPLETE').length;
    const cur = task.steps[task.currentStepIndex]?.progress || 0;
    task.overallProgress = Math.min(100, Math.round(((done + cur / 100) / total) * 100));
  }

  pauseTask(id: string): boolean {
    const rt = this.running.get(id);
    const task = this.tasks.get(id);
    if (rt && task && task.status === 'RUNNING') {
      rt.paused = true;
      task.status = 'PAUSED';
      task.logs.push('[SYSTEM]: Task paused.');
      this.persist(task, rt.ctx);
      this.notify(task);
      return true;
    }
    return false;
  }

  resumeTask(id: string): boolean {
    const rt = this.running.get(id);
    const task = this.tasks.get(id);
    if (rt && task && task.status === 'PAUSED') {
      rt.paused = false;
      task.status = 'RUNNING';
      task.logs.push('[SYSTEM]: Task resumed.');
      this.persist(task, rt.ctx);
      this.notify(task);
      return true;
    }
    return false;
  }

  cancelTask(id: string): boolean {
    const rt = this.running.get(id);
    const task = this.tasks.get(id);
    if (task && (task.status === 'RUNNING' || task.status === 'PAUSED' || task.status === 'PENDING')) {
      if (rt) rt.cancelled = true;
      task.status = 'CANCELLED';
      task.logs.push('[SYSTEM]: Task cancelled by user command.');
      this.persist(task, rt?.ctx);
      this.notify(task);
      return true;
    }
    return false;
  }
}
