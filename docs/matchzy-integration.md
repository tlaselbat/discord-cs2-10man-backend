# MatchZy Integration

## Pinned contract

- **Version:** 0.8.15
- **Commit:** `ef289d512766b89b0f7bf3088208ae88235e61fa`
- **CounterStrikeSharp:** `1.0.342`
- **Contract file:** `contracts/matchzy/0.8.15/manifest.json`

Do not change the MatchZy version without updating the manifest, re-testing the full lifecycle, and recording new artifact hashes.

## Config loading

The bot builds a schema-valid MatchZy config JSON containing:

- Exact team rosters and SteamID64 values
- Map and side assignments
- Remote log/event URLs
- Authenticated MatchZy event endpoint bound to the match

It then sends to the DatHost console:

```text
matchzy_loadmatch_url "<config_url>" "<auth_header_name>" "<auth_header_value>"
```

The config URL is ephemeral and scoped to the match and server generation.

## Events

The bot listens for MatchZy events at `/webhooks/matchzy`.

Handled events include:

- `series_start`
- `going_live`
- `round_end`
- `map_end` / `map_result`
- `series_end`

Each event is journaled, deduplicated by an event-specific key, and translated into the backend state machine.

## Commands

Only these commands are ever sent to the server:

```text
css_start
css_forcepause
css_forceunpause
css_restore <round>
css_forceend
```

All commands are rendered by `src/integrations/matchzy/commands.ts` and passed through DatHost console. No raw RCON is exposed to Discord users.

## Reconciliation

If the bot misses a `series_end` event, the periodic `MATCHZY_RECONCILE` job detects that the DatHost server is gone and transitions the match to `FINISHED`, triggering cleanup.
