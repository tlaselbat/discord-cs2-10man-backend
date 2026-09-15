import pino from 'pino';
import { afterEach, describe, expect, it } from 'vitest';
import { createHttpServer } from '../../src/http/server.js';

const servers: Awaited<ReturnType<typeof createHttpServer>>[] = [];
afterEach(async () => Promise.all(servers.map(async (server) => server.close())));

describe('health endpoints', () => {
  it('does not expose dependency details', async () => {
    const server = await createHttpServer({
      logger: pino({ enabled: false }),
      readiness: () => Promise.resolve(false),
    });
    servers.push(server);
    const response = await server.inject({ method: 'GET', url: '/health/ready' });
    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ status: 'unavailable' });
  });
});
