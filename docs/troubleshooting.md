# Troubleshooting

## Bot does not respond to slash commands

- Ensure `DISCORD_TOKEN` and `DISCORD_CLIENT_ID` are correct.
- Verify commands are registered (`registerCommands` is called on startup).
- Check that the bot is in the guild and has `applications.commands` scope.

## Panel buttons stop working

- Each button custom ID is signed and bound to a match version. If the panel is stale, run `/10man status` to get a fresh ephemeral panel.
- The persistent panel may have been deleted; trigger `PANEL_REFRESH` or restart the bot.

## Voice moves do not happen

- Verify the bot has `Move Members`, `Connect`, and `View Channel` permissions in all three voice channels.
- Check that the channels configured in `/match admin configure` are still valid.

## DatHost duplicate fails or is ambiguous

- Do not manually retry after an uncertain response. The bot reconciles using the persisted ownership marker.
- Check `ProvisioningAttempt` rows for the match to see the latest status.
- Confirm the configured `DATHOST_TEMPLATE_SERVER_ID` exists and is not the ID of an already-duplicated disposable server.

## MatchZy config does not load

- Verify the `PUBLIC_BASE_URL` is reachable from DatHost and uses HTTPS.
- Check the MatchZy config endpoint returns valid JSON at `/matches/:matchId/config` with the `CONFIG_READ` token.
- Confirm MatchZy 0.8.15 is installed on the template.

## Missed match end

- The `MATCHZY_RECONCILE` job recovers when the server is gone without a `series_end` event.
- If the server is still running but events stopped, inspect DatHost console and MatchZy logs instead of forcing state.

## Cleanup did not delete the server

- Cleanup treats a missing server as success, so an already-deleted server will still release the guild slot.
- Check `CleanupStatus` for `FAILED`; if so, re-enqueue cleanup and inspect logs.

## Steam linking fails

- The callback URL must exactly match `PUBLIC_BASE_URL`.
- The OpenID nonce session is single-use and expires quickly; retry `/steam register`.
