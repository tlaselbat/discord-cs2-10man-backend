# Architecture

## Overview

```text
Discord manages users and human workflow.
The backend manages orchestration and authorization.
DatHost manages disposable server infrastructure.
MatchZy manages the actual CS2 match.
CS2 executes gameplay.
```

## Runtime components

| Component            | Responsibility                                                                   |
| -------------------- | -------------------------------------------------------------------------------- |
| Discord bot          | Slash commands, buttons, persistent panel, voice movement                        |
| Fastify HTTP service | Health checks, Steam OpenID callback, MatchZy webhooks, config endpoint          |
| Worker runner        | Leases durable jobs from PostgreSQL and executes handlers                        |
| PostgreSQL           | Match state, jobs, credentials, events, audit log                                |
| DatHost client       | Disposable server lifecycle (duplicate, configure, start, stop, delete, console) |
| MatchZy integration  | Config builder, event ingestion, semantic command allowlist                      |

## State machines

### Match state

`CREATED → OPEN → FULL → TEAM_SETUP → TEAMS_LOCKED → SERVER_PROVISIONING → SERVER_BOOTING → SERVER_READY → MATCH_LOADED → WARMUP → LIVE ↔ PAUSED → FINISHED`

Terminal states: `FINISHED`, `CANCELED`, `FAILED`.

### Cleanup state

`NOT_REQUIRED → PENDING → RUNNING → RETRY → COMPLETE`

Cleanup is independent of match outcome and runs on a separate state machine. A new match is blocked while a guild slot's cleanup is not `COMPLETE`.

### Provisioning attempt state

`DUPLICATE_REQUEST_PENDING → DUPLICATE_OUTCOME_UNKNOWN → SERVER_IDENTIFIED → COMPLETE`

Ambiguous outcomes require operator review and do not auto-retry.

## Job types

- `PROVISION_SERVER` — create/reconcile DatHost destination, configure, start
- `POLL_SERVER_BOOT` — poll DatHost until the server reports `booting=false`
- `VOICE_RECONCILE` — move Discord users to correct voice channels
- `PANEL_REFRESH` — update the persistent match panel
- `CLEANUP_MATCH` — revoke credentials, return users to lobby, delete server
- `ORPHAN_SCAN` — list DatHost servers and report unaccounted resources
- `MATCHZY_RECONCILE` — recover from missed `series_end` or stale events

## Security model

- No raw Discord-to-RCON path exists.
- MatchZy commands are allowlisted and rendered in `src/integrations/matchzy/commands.ts`.
- MatchZy tokens are scoped (`CONFIG_READ` / `EVENT_WRITE`) and bound to a match + server generation.
- Credentials are AES-256-GCM encrypted and hashed in the database.
- DatHost template IDs are never deleted or reconfigured by the bot.
