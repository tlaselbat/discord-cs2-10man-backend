# DatHost Template Setup

## Goal

Create a protected template server on DatHost. The bot duplicates it for every 10man. The template itself is never modified or deleted by the bot.

## Steps

1. Create a CS2 server in the [DatHost panel](https://dathost.net/).
2. Install MatchZy 0.8.15 and CounterStrikeSharp `1.0.342` per the [MatchZy integration guide](matchzy-integration.md).
3. Configure the template minimally:
   - Game mode and type are overridden by MatchZy config at load time.
   - RCON and join passwords are set at duplicate time by the bot.
4. Note the template server's ID from the URL or panel.

## Set environment variables

```bash
DATHOST_EMAIL=your@email.com
DATHOST_PASSWORD=your_password
DATHOST_TEMPLATE_SERVER_ID=the-template-id
DEFAULT_DATHOST_LOCATION=dallas
```

## Protect the template

- Do not grant the bot credentials permission to delete the template.
- The bot's cleanup logic refuses to delete any server whose ID is in the configured template ID set.
- Keep the template stopped when not in use to avoid charges.

## Validation

The `/match admin configure` command accepts a `dathost_template_server_id`. The bot does not verify the template exists at configuration time, but the first provisioning attempt will fail clearly if the ID is wrong or inaccessible.
