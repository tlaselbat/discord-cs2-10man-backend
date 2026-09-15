import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import Fastify, { type FastifyBaseLogger } from 'fastify';
import type { Logger } from 'pino';
import { registerSteamRoutes, type SteamRoutesDependencies } from './routes/steam.js';
import { registerMatchZyRoutes, type MatchZyRoutesDependencies } from './routes/matchzy.js';

export interface HttpServerDependencies {
  logger: Logger;
  readiness: () => Promise<boolean>;
  steam?: SteamRoutesDependencies;
  matchzy?: MatchZyRoutesDependencies;
}

export async function createHttpServer(dependencies: HttpServerDependencies) {
  const app = Fastify({
    loggerInstance: dependencies.logger as FastifyBaseLogger,
    bodyLimit: 64 * 1024,
    requestIdHeader: false,
  });
  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(rateLimit, { max: 100, timeWindow: '1 minute' });
  if (dependencies.steam !== undefined) registerSteamRoutes(app, dependencies.steam);
  if (dependencies.matchzy !== undefined) registerMatchZyRoutes(app, dependencies.matchzy);

  app.get('/health/live', { config: { rateLimit: { max: 300, timeWindow: '1 minute' } } }, () => ({
    status: 'ok',
  }));
  app.get('/health/ready', async (_request, reply) => {
    const ready = await dependencies.readiness();
    return reply.code(ready ? 200 : 503).send({ status: ready ? 'ready' : 'unavailable' });
  });

  app.setErrorHandler((error: unknown, request, reply) => {
    request.log.warn(
      { err: error, action: 'http_request', result: 'failed' },
      'HTTP request failed',
    );
    const statusCode =
      typeof error === 'object' &&
      error !== null &&
      'statusCode' in error &&
      typeof error.statusCode === 'number'
        ? error.statusCode
        : 500;
    const safeStatusCode = statusCode >= 400 && statusCode < 500 ? statusCode : 500;
    void reply.code(safeStatusCode).send({
      error: safeStatusCode < 500 ? 'invalid_request' : 'internal_error',
      requestId: request.id,
    });
  });
  return app;
}
