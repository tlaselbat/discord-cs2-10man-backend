# MatchZy Integration

## Pinned contract

- **MatchZy:** 0.8.15
- **Commit:** `ef289d512766b89b0f7bf3088208ae88235e61fa`
- **CounterStrikeSharp:** 1.0.342
- **Contract manifest:** `contracts/matchzy/0.8.15/manifest.json`

Do not upgrade MatchZy without updating the manifest, validating schemas and commands, recording artifact hashes, and repeating the full staging lifecycle.

## Server-ready and config loading

When DatHost stops reporting `booting` and provides IP/port data, the worker records `SERVER_BOOTING → SERVER_READY`. It then issues scoped credentials, builds MatchZy configuration, sends the load command, and records `SERVER_READY → MATCH_LOADED`.

A restart in `SERVER_READY` resumes MatchZy loading. An already `MATCH_LOADED` boot-poll job is an idempotent no-op.

The generated config contains:

- MatchZy numeric match ID
- Selected map and team names
- Exact SteamID64 roster/team assignments
- Players-per-team readiness requirement
- Allowlisted profile CVARs
- Remote event URL and event token header

The worker sends:

```text
matchzy_loadmatch_url "<config_url>" "x-matchzy-token" "<config_token>"
```

The authenticated config endpoint is:

```text
GET /internal/matches/:matchId/matchzy-config
x-matchzy-token: <CONFIG_READ token>
```

Config responses use `Cache-Control: no-store`. Credentials are random, hashed at rest, scoped to `CONFIG_READ`, bound to match/server/version, expiring, and revoked or rotated as lifecycle work proceeds.

## Events

MatchZy posts to:

```text
POST /webhooks/matchzy/:matchId
x-matchzy-token: <EVENT_WRITE token>
```

The route authenticates the server-bound token before parsing and ingesting the event. Handled contract events include:

- `series_start`
- `going_live`
- `round_end`
- `map_result`
- `series_end`

Events are journaled with a payload hash, deduplicated by event-specific keys, and processed transactionally. Round and map events update persisted team scores. State/score changes enqueue idempotent persistent-panel refresh jobs. `series_end` stores the result, moves the match to `FINISHED`, marks cleanup pending, and queues cleanup.

## Discord controls

Only semantic allowlisted commands are rendered:

```text
css_start
css_forcepause
css_forceunpause
css_restore <round>
css_forceend
```

Discord users cannot submit raw console or RCON text. The DatHost client rejects newline-containing console commands, and authorization is checked before controls are sent.

Restore controls currently expose rounds 1-25, matching Discord's maximum select-menu options.

## Reconciliation

`MATCHZY_RECONCILE` is a recurring durable singleton scheduled by `MATCHZY_RECONCILIATION_INTERVAL_MS`.

- If a match is active but its DatHost server is missing/offline without `series_end`, reconciliation moves it to `FINISHED`, records the observation/correction, and queues cleanup and panel refresh.
- If events are older than `MATCHZY_STALE_AFTER_MS` while the server remains on, reconciliation records and logs staleness without forcing a result.
- After successful execution, the job returns to `PENDING` with a future `run_at`; startup recovery reactivates it after restarts.

## Failure handling

Repeated boot or load failures eventually invoke permanent provisioning recovery. The match moves to `FAILED`, the actual prior state is recorded, and cleanup is queued whenever a server or provisioning attempt may exist. The guild slot is retained until cleanup safely completes.
