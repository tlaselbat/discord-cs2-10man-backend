# DatHost Template Setup

## Goal

Create a protected CS2 template that the bot duplicates into a separately identified disposable destination for each match. The bot must never reconfigure or delete the template itself.

## Prepare the template

1. Create a CS2 server in the [DatHost panel](https://dathost.net/).
2. Install MatchZy 0.8.15 and CounterStrikeSharp 1.0.342 as documented in [MatchZy integration](matchzy-integration.md).
3. Keep template configuration minimal. The bot sets destination slots, GOTV/private-server flags, RCON password, join password, autostop, name, location, and ownership marker.
4. Record the exact template server ID.
5. Keep the template stopped when not in use if appropriate for the account's billing model.

## Configure credentials and protection

Set global DatHost credentials and the protected template ID:

```bash
DATHOST_EMAIL=your@email.com
DATHOST_PASSWORD=your_password
DATHOST_TEMPLATE_SERVER_ID=the-template-id
```

Then pass the same intended template ID to `/match admin configure` for each guild. The global ID is included in the worker's protected-template set; the guild value selects the source used by that guild.

The optional `DEFAULT_DATHOST_LOCATION` environment variable is retained in configuration, but current provisioning uses the guild's configured location, defaulting to `dallas` when `/match admin configure` omits it.

## Ownership and deletion safety

Provisioning first persists an intent containing:

- Match and attempt IDs
- Unique provisional server name
- `tenman:<matchId>:<attemptId>` ownership marker
- Requested template and location
- Request timing

It then creates a provisional destination and duplicates the template into that known destination. Timeouts are treated as uncertain outcomes and reconciled against persisted identity evidence; they do not trigger blind duplicate requests.

Cleanup requires the requested server ID to equal the persisted owned server ID and rejects IDs in the protected-template set. Orphan scanning reports unexplained resources but does not blindly delete them.

## Validation

`/match admin configure` stores the guild template ID but does not call DatHost. Run `/match admin diagnostics` to verify template access before staging a real match.

A wrong or inaccessible template can still fail during provisioning. Retries are bounded. On permanent failure, the match becomes `FAILED`; if a provisioning attempt or server may exist, cleanup is queued and the guild slot remains blocked until safe resolution.

## Operational rules

- Never use a disposable server ID as a template ID.
- Never manually duplicate again after a timeout without reconciling the persisted attempt.
- Never clear a guild slot solely to bypass ambiguous ownership.
- Resolve unknown servers using ownership marker, provisional name, location, and request window.
- Confirm the protected template remains untouched during every staging acceptance run.
