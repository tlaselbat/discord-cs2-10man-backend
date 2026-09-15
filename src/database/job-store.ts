import type { PrismaClient } from '../generated/prisma/client.js';
import type { JobStore, LeasedJob } from '../jobs/worker.js';

interface JobRow {
  id: string;
  type: string;
  attempts: number;
  payload: unknown;
}

export class PrismaJobStore implements JobStore {
  public constructor(private readonly prisma: PrismaClient) {}

  public async lease(workerId: string, leaseUntil: Date): Promise<LeasedJob | null> {
    const rows = await this.prisma.$queryRaw<JobRow[]>`
      WITH candidate AS (
        SELECT id FROM jobs
        WHERE (
          status IN ('PENDING', 'RETRY')
            AND run_at <= NOW()
            AND (lease_expires_at IS NULL OR lease_expires_at < NOW())
        ) OR (
          status = 'RUNNING'
            AND lease_expires_at IS NOT NULL
            AND lease_expires_at < NOW()
        )
        ORDER BY run_at, created_at
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      )
      UPDATE jobs
      SET status = 'RUNNING', lease_owner = ${workerId}, lease_expires_at = ${leaseUntil}, updated_at = NOW()
      WHERE id IN (SELECT id FROM candidate)
      RETURNING id, type, attempts, payload
    `;
    return rows[0] ?? null;
  }

  public async complete(jobId: string): Promise<void> {
    await this.prisma.job.update({
      where: { id: jobId },
      data: { status: 'COMPLETE', leaseOwner: null, leaseExpiresAt: null, lastError: null },
    });
  }

  public async reschedule(jobId: string, runAt: Date): Promise<void> {
    await this.prisma.job.update({
      where: { id: jobId },
      data: {
        status: 'PENDING',
        attempts: 0,
        runAt,
        leaseOwner: null,
        leaseExpiresAt: null,
        lastError: null,
      },
    });
  }

  public async retry(jobId: string, runAt: Date, error: string): Promise<void> {
    await this.prisma.job.update({
      where: { id: jobId },
      data: {
        status: 'RETRY',
        attempts: { increment: 1 },
        runAt,
        leaseOwner: null,
        leaseExpiresAt: null,
        lastError: error.slice(0, 2000),
      },
    });
  }

  public async fail(jobId: string, error: string): Promise<void> {
    await this.prisma.job.update({
      where: { id: jobId },
      data: {
        status: 'FAILED',
        attempts: { increment: 1 },
        leaseOwner: null,
        leaseExpiresAt: null,
        lastError: error.slice(0, 2000),
      },
    });
  }
}
