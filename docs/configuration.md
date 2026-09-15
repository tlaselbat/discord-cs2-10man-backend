# Configuration Reference

## Environment variables

| Variable                             | Required | Default       | Description                                  |
| ------------------------------------ | -------- | ------------- | -------------------------------------------- |
| `NODE_ENV`                           | no       | `development` | `development`, `test`, or `production`       |
| `HOST`                               | no       | `0.0.0.0`     | HTTP bind host                               |
| `PORT`                               | no       | `3000`        | HTTP port                                    |
| `LOG_LEVEL`                          | no       | `info`        | Pino log level                               |
| `DATABASE_URL`                       | yes      | —             | PostgreSQL URL                               |
| `DISCORD_TOKEN`                      | yes      | —             | Bot token                                    |
| `DISCORD_CLIENT_ID`                  | yes      | —             | Application ID (17-20 digits)                |
| `DATHOST_EMAIL`                      | yes      | —             | DatHost account email                        |
| `DATHOST_PASSWORD`                   | yes      | —             | DatHost account password                     |
| `DATHOST_TEMPLATE_SERVER_ID`         | yes      | —             | Protected template server ID                 |
| `PUBLIC_BASE_URL`                    | yes      | —             | Public HTTPS URL (Steam & MatchZy callbacks) |
| `MATCH_TOKEN_SIGNING_SECRET`         | yes      | —             | Min 32 chars, signs Discord custom IDs       |
| `CREDENTIAL_ENCRYPTION_KEY`          | yes      | —             | Base64 of exactly 32 bytes                   |
| `DEFAULT_DATHOST_LOCATION`           | no       | —             | Fallback server location                     |
| `WORKER_POLL_INTERVAL_MS`            | no       | `1000`        | Worker polling interval                      |
| `MATCHZY_RECONCILIATION_INTERVAL_MS` | no       | `30000`       | Reconcile interval for stale MatchZy state   |
| `MATCHZY_STALE_AFTER_MS`             | no       | `120000`      | Treat MatchZy as stale after no events       |

## Generating secrets

### Match token signing secret

```bash
openssl rand -base64 32
```

### Credential encryption key

```bash
openssl rand -base64 32
```

The decoded value must be exactly 32 bytes.

## Guild settings

Stored in `GuildSettings` via `/match admin configure`:

- Lobby text channel
- Lobby voice channel
- Team 1 voice channel
- Team 2 voice channel
- Privileged role
- Moderator role
- Administrator role
- DatHost template server ID
- Default DatHost location
- Default game profile key
- Enabled flag

Guild settings are versioned and audited.
