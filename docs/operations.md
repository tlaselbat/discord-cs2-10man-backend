# Operations Runbook

## Startup

```bash
corepack pnpm prisma migrate deploy
corepack pnpm prisma db seed
corepack pnpm build
corepack pnpm start
```

The worker loop starts after Prisma connects and Discord logs in. Startup recovery scans for unfinished matches and jobs.

## Health checks

- Liveness: `GET /health`
- Readiness: `GET /health/ready`

## Logs

Structured Pino logs. Sensitive fields are redacted by `src/logging/logger.ts`.

## Common operational tasks

### Stuck provisioning attempt

If a `DUPLICATE_OUTCOME_UNKNOWN` or `AMBIGUOUS` provisioning attempt is logged:

1. List DatHost servers matching the ownership marker.
2. Identify the correct server by `user_data`, name, location, and creation time.
3. Manually update `ProvisioningAttempt.dathostServerId` or `Match.dathostServerId`.
4. Enqueue `PROVISION_SERVER` or `POLL_SERVER_BOOT` as appropriate.

### Orphaned server

The `ORPHAN_SCAN` job logs unknown and orphaned resources. Orphaned servers require operator review before deletion. Adoption candidates should be reconciled manually.

### Cleanup retry exhaustion

When cleanup reaches `FAILED` after max attempts:

1. Fix the underlying issue (DatHost credentials, Discord permissions, network).
2. Re-enqueue cleanup via the admin diagnostics command or directly create a `CLEANUP_MATCH` job with idempotency key `cleanup:<matchId>`.

### Guild slot blocked

If a new `/10man create` is rejected because cleanup is not `COMPLETE`, inspect the prior match. Run or re-run cleanup, then verify `guildSlotActive` is released.

### Steam relink

If a user needs to replace their Steam link outside normal flow, a moderator/admin can use `/steam replace` once implemented.
