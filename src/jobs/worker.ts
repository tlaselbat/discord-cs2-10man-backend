export interface LeasedJob {
  id: string;
  type: string;
  attempts: number;
  payload: unknown;
}

export interface JobStore {
  lease(workerId: string, leaseUntil: Date): Promise<LeasedJob | null>;
  complete(jobId: string): Promise<void>;
  retry(jobId: string, runAt: Date, error: string): Promise<void>;
  fail(jobId: string, error: string): Promise<void>;
}

export type JobHandler = (job: LeasedJob) => Promise<void>;

export interface WorkerOptions {
  workerId: string;
  leaseMs: number;
  maxAttempts: number;
  baseRetryMs: number;
  maxRetryMs: number;
}

export class DurableWorker {
  public constructor(
    private readonly store: JobStore,
    private readonly handlers: ReadonlyMap<string, JobHandler>,
    private readonly options: WorkerOptions,
  ) {}

  public async runOnce(now = new Date()): Promise<boolean> {
    const job = await this.store.lease(
      this.options.workerId,
      new Date(now.getTime() + this.options.leaseMs),
    );
    if (job === null) return false;
    const handler = this.handlers.get(job.type);
    if (handler === undefined) {
      await this.store.fail(job.id, `No handler registered for ${job.type}`);
      return true;
    }
    try {
      await handler(job);
      await this.store.complete(job.id);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown job error';
      const nextAttempt = job.attempts + 1;
      if (nextAttempt >= this.options.maxAttempts) await this.store.fail(job.id, message);
      else {
        const exponential = this.options.baseRetryMs * 2 ** Math.max(0, nextAttempt - 1);
        const delay = Math.min(exponential, this.options.maxRetryMs);
        await this.store.retry(job.id, new Date(now.getTime() + delay), message);
      }
    }
    return true;
  }
}
