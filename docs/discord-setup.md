# Discord Setup

## Create the application

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications).
2. Create a new application.
3. In **Bot**, enable these privileged intents:
   - `Guilds`
   - `GuildVoiceStates`
4. Copy the **Token** (`DISCORD_TOKEN`) and **Application ID** (`DISCORD_CLIENT_ID`).

## Invite the bot

Generate an invite URL with these scopes and permissions:

```text
scopes: bot, applications.commands
bot permissions:
  - Send Messages
  - Embed Links
  - Read Message History
  - Connect
  - Speak
  - Move Members
  - Manage Messages
  - View Channels
```

## Server layout

Create in your staging/production guild:

- A text channel for the persistent match panel.
- A voice channel for the pre-match lobby.
- A voice channel for Team 1.
- A voice channel for Team 2.
- A privileged role for users allowed to create 10mans.
- A moderator role for users allowed to override controls.
- An administrator role for configuration and diagnostics.

## Configure the bot

Run in a guild:

```text
/match admin configure
```

Provide the channels and roles created above. The bot will verify it has the required permissions in each channel before saving.

## Slash commands

The bot registers these commands:

- `/10man create` — create a new 10man (privileged role or higher)
- `/10man status` — show the active 10man panel
- `/10man cancel` — cancel the active 10man (leader/moderator/admin)
- `/steam register` — link a Steam account via OpenID
- `/steam status` — show the linked Steam account
- `/match admin status` — show guild configuration
- `/match admin configure` — configure or reconfigure the guild (admin only)
- `/match admin diagnostics` — run safe diagnostics (admin only)

## Panels and controls

The bot posts a persistent panel message in the configured lobby text channel. Participants interact with buttons and dropdowns to join, leave, select teams/maps, lock teams, get connection info, and control the live match.
