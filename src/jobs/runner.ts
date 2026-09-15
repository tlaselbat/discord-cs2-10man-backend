import type { Logger } from 'pino';
import { DurableWorker, type JobStore, type JobHandler } from './worker.js';

export interface WorkerRunnerOptions {
  workerId: string;
  pollIntervalMs: number;
  leaseMs: number;
  maxAttempts: number;
  baseRetryMs: number;
  maxRetryMs: number;
}

export class WorkerRunner {
  private readonly worker: DurableWorker;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running = false;
  private inFlight: Promise<void> | null = null;

  public constructor(
    store: JobStore,
    handlers: ReadonlyMap<string, JobHandler>,
    private readonly options: WorkerRunnerOptions,
    private readonly logger: Logger,
  ) {
    this.worker = new DurableWorker(store, handlers, {
      workerId: options.workerId,
      leaseMs: options.leaseMs,
      maxAttempts: options.maxAttempts,
      baseRetryMs: options.baseRetryMs,
      maxRetryMs: options.maxRetryMs,
    });
  }

  public start(): void {
    if (this.running) return;
    this.running = true;
    this.schedule();
  }

  public async stop(): Promise<void> {
    this.running = false;
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    await this.inFlight;
  }

  private schedule(): void {
    if (!this.running) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.inFlight = this.run().finally(() => {
        this.inFlight = null;
        this.schedule();
      });
    }, this.options.pollIntervalMs);
  }

  private async run(): Promise<void> {
    try {
      const hadWork = await this.worker.runOnce();
      if (hadWork) this.logger.debug({ workerId: this.options.workerId }, 'Worker completed a job');
    } catch (error: unknown) {
      this.logger.error({ err: error, workerId: this.options.workerId }, 'Worker loop error');
    }
  }
}
