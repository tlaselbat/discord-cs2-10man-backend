import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';

const payloadSchema = z.object({
  action: z.string().regex(/^[A-Z_]+$/),
  matchId: z.uuid(),
  version: z.number().int().nonnegative(),
});
export type ComponentPayload = z.infer<typeof payloadSchema>;

export function createCustomId(payload: ComponentPayload, secret: string): string {
  const parsed = payloadSchema.parse(payload);
  const body = `${parsed.action}:${parsed.matchId.replaceAll('-', '')}:${parsed.version.toString(36)}`;
  const customId = `tm:${body}:${sign(body, secret)}`;
  if (customId.length > 100) throw new Error('Discord custom ID exceeds 100 characters');
  return customId;
}

export function parseCustomId(customId: string, secret: string): ComponentPayload {
  const [namespace, action, compactMatchId, encodedVersion, signature, extra] = customId.split(':');
  if (
    namespace !== 'tm' ||
    action === undefined ||
    compactMatchId === undefined ||
    encodedVersion === undefined ||
    signature === undefined ||
    extra !== undefined
  ) {
    throw new Error('Invalid component ID');
  }
  const body = `${action}:${compactMatchId}:${encodedVersion}`;
  const expected = Buffer.from(sign(body, secret));
  const received = Buffer.from(signature);
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    throw new Error('Invalid component signature');
  }
  if (!/^[a-f0-9]{32}$/u.test(compactMatchId) || !/^[0-9a-z]+$/u.test(encodedVersion)) {
    throw new Error('Invalid component payload');
  }
  const matchId = compactMatchId.replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/u, '$1-$2-$3-$4-$5');
  return payloadSchema.parse({ action, matchId, version: Number.parseInt(encodedVersion, 36) });
}

function sign(body: string, secret: string): string {
  return createHmac('sha256', secret).update(body).digest('base64url').slice(0, 16);
}
