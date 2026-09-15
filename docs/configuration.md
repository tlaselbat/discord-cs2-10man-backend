# Configuration Reference

## Runtime requirements

- Node.js 22 or newer
- pnpm 10.15.1 through Corepack
- PostgreSQL
- A public HTTPS origin reachable by Steam and the DatHost-hosted MatchZy server

## Environment variables

| Variable                             | Required | Default       | Validation and use                                                                                  |
| ------------------------------------ | -------- | ------------- | --------------------------------------------------------------------------------------------------- |
| `NODE_ENV`                           | no       | `development` | `development`, `test`, or `production`                                                              |
| `HOST`                               | no       | `0.0.0.0`     | Non-empty HTTP bind host                                                                            |
| `PORT`                               | no       | `3000`        | Integer from 1 through 65535                                                                        |
| `LOG_LEVEL`                          | no       | `info`        | `fatal`, `error`, `warn`, `info`, `debug`, or `trace`                                               |
| `POSTGRES_PASSWORD`                  | Docker   | —             | PostgreSQL container password used by `compose.yaml`                                                |
| `DATABASE_URL`                       | yes      | —             | Must start with `postgresql://`                                                                     |
| `DISCORD_TOKEN`                      | yes      | —             | Bot token; also used by `pnpm discord:register`                                                     |
| `DISCORD_CLIENT_ID`                  | yes      | —             | Application ID containing 17-20 digits                                                              |
| `DATHOST_EMAIL`                      | yes      | —             | DatHost API account email                                                                           |
| `DATHOST_PASSWORD`                   | yes      | —             | DatHost API account password                                                                        |
| `DATHOST_TEMPLATE_SERVER_ID`         | yes      | —             | Globally protected template ID used by ownership safety checks                                      |
| `PUBLIC_BASE_URL`                    | yes      | —             | HTTPS origin for Steam callbacks and MatchZy config/events                                          |
| `MATCH_TOKEN_SIGNING_SECRET`         | yes      | —             | At least 32 characters; signs Discord component IDs                                                 |
| `CREDENTIAL_ENCRYPTION_KEY`          | yes      | —             | Base64 value decoding to exactly 32 bytes                                                           |
| `DEFAULT_DATHOST_LOCATION`           | no       | —             | Present for environment compatibility; guild configuration currently controls provisioning location |
| `WORKER_POLL_INTERVAL_MS`            | no       | `1000`        | Integer from 100 through 60000 milliseconds                                                         |
| `MATCHZY_RECONCILIATION_INTERVAL_MS` | no       | `30000`       | Integer from 5000 through 300000 milliseconds; recurring reconciliation schedule                    |
| `MATCHZY_STALE_AFTER_MS`             | no       | `120000`      | Integer of at least 30000 milliseconds                                                              |

The application validates the complete runtime environment before startup. The dedicated command-registration script validates only its two Discord variables.

## Generating secrets

Generate the component signing secret and encryption key independently:

```bash
openssl rand -base64 32
openssl rand -base64 32
```

The second output must decode to exactly 32 bytes. Keep all values outside source control and rotate them through a planned operational procedure; changing the signing secret invalidates existing panel controls, and changing the encryption key prevents existing encrypted match passwords from being decrypted.

## Guild settings

`/match admin configure` stores:

- Lobby text channel used for the persistent panel
- Lobby, Team 1, and Team 2 voice channels
- Privileged, moderator, and administrator role IDs
- DatHost template server ID
- Default DatHost location (`dallas` when omitted)
- Default enabled game-profile key (`competitive_5v5` when omitted)
- Enabled flag

Settings are versioned and configuration changes are audited. Initial configuration requires native Discord Administrator permission. Later configuration accepts either native Administrator or the configured administrator role.

A match cannot be created until settings are enabled and have a default profile. Creation also requires the configured lobby text channel to remain available.

## Game profiles

Profiles are database records and must be seeded before guild configuration. Only profiles with `enabled = true` are offered or accepted.

Profile capacity is `players_per_team × 2`. Changing an unlocked match's profile:

- Rejects the change if the current roster exceeds the new capacity.
- Sets the match to `FULL` when the roster exactly equals capacity, otherwise `OPEN`.
- Resets team assignments to `UNASSIGNED`.
- Keeps the selected map only if the new profile allows it.
- Increments the match version, invalidating stale controls.

Discord selectors show at most 25 maps and profiles because of Discord API limits. Keep configured allowlists and enabled-profile counts within that accessible range until pagination is added.

## Managed Discord resources

Automated setup stores `managedResourceState`, a per-resource setup step, a UUID attempt ID, the managed category ID, managed child IDs, and `managedResourcesCreatedAt`. Existing/manual configurations remain `NONE` with no inferred ownership. `SETTING_UP` records durable progress and possible ambiguous Discord create outcomes; `ACTIVE` owns a complete managed layout; `TEARING_DOWN` retains only unresolved deletions.

No Discord API call occurs inside a PostgreSQL transaction. Each phase persists intent under a guild advisory transaction lock, commits, performs one Discord operation, then persists its outcome with optimistic settings-version and attempt checks. Active ownership timestamps are cleared at `NONE`; audit events retain history.

`MATCH_TOKEN_SIGNING_SECRET` also signs domain-separated administrative confirmations and must therefore be persistent and identical across all running instances.

## Database-owned invariants

The migration `20260914223000_unique_active_guild_slot` creates the PostgreSQL partial unique index `matches_one_active_slot_per_guild`. Prisma does not model this partial index directly; do not remove it when generating later migrations.

The migration intentionally fails when existing data has multiple `guild_slot_active = true` rows for one guild. Follow the preflight and remediation steps in [Operations](operations.md).
