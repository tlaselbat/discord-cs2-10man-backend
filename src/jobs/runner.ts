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
  private interval: ReturnType<typeof setInterval> | null = null;
  private running = false;

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
    this.interval = setInterval(() => {
      this.worker
        .runOnce()
        .then((hadWork) => {
          if (hadWork) {
            this.logger.debug({ workerId: this.options.workerId }, 'Worker completed a job');
          }
        })
        .catch((error: unknown) => {
          this.logger.error({ err: error, workerId: this.options.workerId }, 'Worker loop error');
        });
    }, this.options.pollIntervalMs);
  }

  public stop(): void {
    if (this.interval !== null) {
      clearInterval(this.interval);
      this.interval = null;
    }
    this.running = false;
  }
}
