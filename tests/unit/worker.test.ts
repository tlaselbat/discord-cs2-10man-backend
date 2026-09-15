import { describe, expect, it, vi } from 'vitest';
import { DurableWorker, type JobStore, type LeasedJob } from '../../src/jobs/worker.js';

function store(job: LeasedJob | null): JobStore & {
  retry: ReturnType<typeof vi.fn>;
  complete: ReturnType<typeof vi.fn>;
  reschedule: ReturnType<typeof vi.fn>;
  fail: ReturnType<typeof vi.fn>;
} {
  return {
    lease: vi.fn().mockResolvedValue(job),
    retry: vi.fn().mockResolvedValue(undefined),
    complete: vi.fn().mockResolvedValue(undefined),
    reschedule: vi.fn().mockResolvedValue(undefined),
    fail: vi.fn().mockResolvedValue(undefined),
  };
}
const options = {
  workerId: 'worker',
  leaseMs: 30_000,
  maxAttempts: 3,
  baseRetryMs: 1000,
  maxRetryMs: 10_000,
};

describe('durable worker', () => {
  it('completes successful work', async () => {
    const jobs = store({ id: 'job', type: 'TEST', attempts: 0, payload: {} });
    const worker = new DurableWorker(
      jobs,
      new Map([['TEST', vi.fn().mockResolvedValue(undefined)]]),
      options,
    );
    await worker.runOnce(new Date(0));
    expect(jobs.complete).toHaveBeenCalledWith('job');
  });

  it('reschedules recurring work without completing it', async () => {
    const jobs = store({ id: 'job', type: 'TEST', attempts: 0, payload: {} });
    const runAt = new Date(10_000);
    const worker = new DurableWorker(
      jobs,
      new Map([['TEST', vi.fn().mockResolvedValue({ rescheduleAt: runAt })]]),
      options,
    );
    await worker.runOnce(new Date(0));
    expect(jobs.reschedule).toHaveBeenCalledWith('job', runAt);
    expect(jobs.complete).not.toHaveBeenCalled();
  });

  it('retries failures with bounded exponential delay', async () => {
    const jobs = store({ id: 'job', type: 'TEST', attempts: 1, payload: {} });
    const worker = new DurableWorker(
      jobs,
      new Map([['TEST', vi.fn().mockRejectedValue(new Error('temporary'))]]),
      options,
    );
    await worker.runOnce(new Date(0));
    expect(jobs.retry).toHaveBeenCalledWith('job', new Date(2000), 'temporary');
  });
});
