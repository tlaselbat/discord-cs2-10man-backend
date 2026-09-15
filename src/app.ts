import type { Client } from 'discord.js';
import type { FastifyInstance } from 'fastify';
import { createDiscordClient } from './bot/client.js';
import type { Environment } from './config/environment.js';
import { createPrismaClient } from './database/prisma.js';
import { PrismaJobStore } from './database/job-store.js';
import { PrismaSteamLinkRepository } from './database/steam-link-repository.js';
import type { PrismaClient } from './generated/prisma/client.js';
import { createHttpServer } from './http/server.js';
import type { Logger } from 'pino';
import { MatchService } from './services/match-service.js';
import { SteamLinkService } from './services/steam-link-service.js';
import { MatchCredentialService } from './services/match-credential-service.js';
import { MatchZyEventService } from './services/matchzy-event-service.js';
import { StartupRecovery } from './services/startup-recovery.js';
import { MatchControlService } from './services/match-control-service.js';
import { CredentialCipher } from './services/credential-cipher.js';
import { DatHostClient } from './integrations/dathost/client.js';
import { createJobHandlers } from './jobs/handlers.js';
import { WorkerRunner } from './jobs/runner.js';

export interface Application {
  prisma: PrismaClient;
  http: FastifyInstance;
  discord: Client;
  worker: WorkerRunner;
  start(): Promise<void>;
  stop(): Promise<void>;
}

export async function createApplication(
  environment: Environment,
  logger: Logger,
): Promise<Application> {
  const prisma = createPrismaClient(environment.DATABASE_URL);
  const steamLinkService = new SteamLinkService(
    new PrismaSteamLinkRepository(prisma),
    new URL(environment.PUBLIC_BASE_URL),
  );
  const matchService = new MatchService(prisma);
  const credentialService = new MatchCredentialService(prisma);
  const matchzyEventService = new MatchZyEventService(prisma);
  const cipher = new CredentialCipher(environment.CREDENTIAL_ENCRYPTION_KEY);
  const dathost = new DatHostClient({
    email: environment.DATHOST_EMAIL,
    password: environment.DATHOST_PASSWORD,
  });
  const matchControlService = new MatchControlService(prisma, dathost, logger);
  const http = await createHttpServer({
    logger,
    readiness: async () => {
      try {
        await prisma.$queryRaw`SELECT 1`;
        return true;
      } catch {
        return false;
      }
    },
    steam: { steamLinkService, publicBaseUrl: new URL(environment.PUBLIC_BASE_URL) },
    matchzy: { prisma, credentials: credentialService, events: matchzyEventService },
  });
  const discord = createDiscordClient({
    token: environment.DISCORD_TOKEN,
    clientId: environment.DISCORD_CLIENT_ID,
    prisma,
    matchService,
    steamLinkService,
    matchControlService,
    dathost,
    cipher,
    componentSigningSecret: environment.MATCH_TOKEN_SIGNING_SECRET,
  });
  const worker = new WorkerRunner(
    new PrismaJobStore(prisma),
    createJobHandlers({
      prisma,
      dathost,
      discord,
      cipher,
      credentials: credentialService,
      publicBaseUrl: new URL(environment.PUBLIC_BASE_URL),
      templateServerIds: new Set([environment.DATHOST_TEMPLATE_SERVER_ID]),
      componentSigningSecret: environment.MATCH_TOKEN_SIGNING_SECRET,
      matchzyStaleAfterMs: environment.MATCHZY_STALE_AFTER_MS,
      logger,
    }),
    {
      workerId: 'primary',
      pollIntervalMs: environment.WORKER_POLL_INTERVAL_MS,
      leaseMs: 30_000,
      maxAttempts: 100,
      baseRetryMs: 5_000,
      maxRetryMs: 60_000,
    },
    logger,
  );
  return {
    prisma,
    http,
    discord,
    worker,
    async start() {
      await prisma.$connect();
      await http.listen({ host: environment.HOST, port: environment.PORT });
      await discord.login(environment.DISCORD_TOKEN);
      await new StartupRecovery(prisma).run();
      worker.start();
    },
    async stop() {
      worker.stop();
      await discord.destroy();
      await http.close();
      await prisma.$disconnect();
    },
  };
}
