import type { Client } from 'discord.js';
import type { Logger } from 'pino';
import type { PrismaClient } from '../generated/prisma/client.js';
import type { DatHostClient } from '../integrations/dathost/client.js';
import { ProvisioningOrchestrator } from '../orchestrator/provisioning.js';
import { CleanupOrchestrator } from '../orchestrator/cleanup.js';
import { PrismaProvisioningRepository } from '../database/provisioning-repository.js';
import { PrismaCleanupRepository } from '../database/cleanup-repository.js';
import { DiscordVoiceAdapter } from '../services/discord-voice.js';
import { PanelService } from '../services/panel-service.js';
import { OrphanScanner } from '../services/orphan-scanner.js';
import { MatchZyReconciliationService } from '../services/matchzy-reconciliation-service.js';
import type { CredentialCipher } from '../services/credential-cipher.js';
import type { MatchCredentialService } from '../services/match-credential-service.js';
import { ProvisioningService } from '../services/provisioning-service.js';
import type { JobHandler, LeasedJob } from './worker.js';

export interface WorkerDependencies {
  prisma: PrismaClient;
  dathost: DatHostClient;
  discord: Client;
  cipher: CredentialCipher;
  credentials: MatchCredentialService;
  publicBaseUrl: URL;
  templateServerIds: ReadonlySet<string>;
  componentSigningSecret: string;
  matchzyStaleAfterMs: number;
  logger: Logger;
}

export function createJobHandlers(dependencies: WorkerDependencies): Map<string, JobHandler> {
  const provisioningOrchestrator = new ProvisioningOrchestrator(
    new PrismaProvisioningRepository(dependencies.prisma),
    dependencies.dathost,
    dependencies.templateServerIds,
  );

  const provisioning = new ProvisioningService(
    dependencies.prisma,
    provisioningOrchestrator,
    dependencies.dathost,
    dependencies.credentials,
    dependencies.cipher,
    dependencies.publicBaseUrl,
    dependencies.logger,
  );

  const voice = new DiscordVoiceAdapter(dependencies.prisma, dependencies.discord);

  const cleanup = new CleanupOrchestrator(
    new PrismaCleanupRepository(dependencies.prisma),
    dependencies.dathost,
    voice,
    dependencies.templateServerIds,
  );

  const panel = new PanelService(
    dependencies.prisma,
    dependencies.discord,
    dependencies.componentSigningSecret,
  );

  const orphanScanner = new OrphanScanner(
    dependencies.prisma,
    dependencies.dathost,
    dependencies.templateServerIds,
  );

  const matchzyReconciliation = new MatchZyReconciliationService(
    dependencies.prisma,
    dependencies.dathost,
    dependencies.matchzyStaleAfterMs,
    dependencies.logger,
  );

  return new Map<string, JobHandler>([
    [
      'PROVISION_SERVER',
      (job: LeasedJob) => {
        const payload = job.payload as { matchId: string };
        return provisioning.runProvisionJob(payload.matchId);
      },
    ],
    [
      'POLL_SERVER_BOOT',
      (job: LeasedJob) => {
        const payload = job.payload as { matchId: string; serverId: string; startedAt: number };
        return provisioning.runBootPollJob(payload.matchId, payload.serverId, payload.startedAt);
      },
    ],
    [
      'CLEANUP_MATCH',
      (job: LeasedJob) => {
        const { matchId } = job.payload as { matchId: string };
        return cleanupJob(dependencies.prisma, cleanup, matchId);
      },
    ],
    [
      'VOICE_RECONCILE',
      (job: LeasedJob) => {
        const { matchId } = job.payload as { matchId: string };
        return voice.reconcileMatchVoice(matchId);
      },
    ],
    [
      'PANEL_REFRESH',
      (job: LeasedJob) => {
        const { matchId } = job.payload as { matchId: string };
        return panel.refresh(matchId);
      },
    ],
    [
      'ORPHAN_SCAN',
      async () => {
        await orphanScanner.scan();
        const nextRun = new Date(Date.now() + 60 * 60 * 1000);
        await dependencies.prisma.job.upsert({
          where: { idempotencyKey: 'orphan-scan' },
          update: { runAt: nextRun },
          create: {
            type: 'ORPHAN_SCAN',
            idempotencyKey: 'orphan-scan',
            payload: {},
            runAt: nextRun,
          },
        });
      },
    ],
    [
      'MATCHZY_RECONCILE',
      async () => {
        await matchzyReconciliation.runPeriodicReconciliation();
        const nextRun = new Date(Date.now() + 60 * 1000);
        await dependencies.prisma.job.upsert({
          where: { idempotencyKey: 'matchzy-reconcile' },
          update: { runAt: nextRun },
          create: {
            type: 'MATCHZY_RECONCILE',
            idempotencyKey: 'matchzy-reconcile',
            payload: {},
            runAt: nextRun,
          },
        });
      },
    ],
  ]);
}

async function cleanupJob(
  prisma: PrismaClient,
  cleanup: CleanupOrchestrator,
  matchId: string,
): Promise<void> {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: { dathostServerId: true, cleanupStatus: true },
  });
  if (match === null) return;
  await cleanup.cleanup({
    matchId,
    serverId: match.dathostServerId,
    ownedServerId: match.dathostServerId,
    cleanupStatus: match.cleanupStatus as 'PENDING' | 'RUNNING' | 'RETRY' | 'FAILED',
  });
}
