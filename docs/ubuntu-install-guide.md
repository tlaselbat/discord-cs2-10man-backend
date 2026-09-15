# Ubuntu and Discord Installation Guide

This guide installs the bot on an Ubuntu server, enables public HTTPS, creates the Discord application, invites it to a Discord server, and creates the required Discord channels.

## 1. Gather what you need

Before starting, have:

- An Ubuntu server with root or sudo access.
- A domain or subdomain, such as `10man.example.com`.
- Access to edit the domain's DNS records.
- A Discord account that can create applications and manage the target Discord server.
- A DatHost account.
- A protected DatHost CS2 template running MatchZy 0.8.15 and CounterStrikeSharp 1.0.342.

See [DatHost Template Setup](dathost-template-setup.md) before continuing. Record the template server ID; the installer will ask for it.

## 2. Point your domain at Ubuntu

At your DNS provider, create an `A` record pointing the chosen domain to the Ubuntu server's public IPv4 address. Add an `AAAA` record only if the server has working public IPv6.

Example:

```text
Type: A
Name: 10man
Value: 203.0.113.10
```

Wait until the domain resolves to the server. Ports **80** and **443** must be reachable from the internet so Caddy can issue an HTTPS certificate. The bot application itself is bound only to `127.0.0.1:3000` and is not exposed directly.

You can check DNS from your computer with:

```bash
nslookup 10man.example.com
```

## 3. Create the Discord application

1. Open the [Discord Developer Portal](https://discord.com/developers/applications).
2. Select **New Application** and give it a name.
3. Open **Bot**, then select **Add Bot** if Discord has not created one automatically.
4. Reset or reveal the bot token and store it securely. This is the `DISCORD_TOKEN` requested by the installer.
5. Open **General Information** and copy the **Application ID**. This is the `DISCORD_CLIENT_ID`.

Never commit or paste the bot token into Discord messages. The Ubuntu installer stores it in a root-readable `.env` file.

## 4. Invite the bot to your Discord server

In the Discord Developer Portal:

1. Open **OAuth2 → URL Generator**.
2. Select these scopes:
   - `bot`
   - `applications.commands`
3. Select these bot permissions:
   - View Channels
   - Send Messages
   - Embed Links
   - Read Message History
   - Connect
   - Move Members
   - Manage Channels
4. Open the generated URL.
5. Choose the Discord server and authorize the bot.

`Manage Channels` is used only for `/match admin setup`, setup recovery, and managed teardown. The bot deletes only channel IDs recorded as bot-owned.

## 5. Create Discord roles

Create and assign three Discord roles:

- **10Man Player** — members allowed to create a 10man.
- **10Man Moderator** — members allowed to override match controls and manage participants.
- **10Man Administrator** — members allowed to configure and manage the bot.

You may use different role names. The setup command asks you to select the roles.

The person performing the first setup must also have Discord's native **Administrator** permission because no bot administrator role has been stored yet.

## 6. Connect to Ubuntu

From your computer:

```bash
ssh your-user@your-server-ip
```

Install Git if necessary:

```bash
sudo apt update
sudo apt install -y git
```

Clone the repository and enter it:

```bash
git clone <repository-url> 10manbot
cd 10manbot
```

Replace `<repository-url>` with the actual Git repository URL.

## 7. Run the automated installer

Run:

```bash
sudo bash scripts/setup-ubuntu.sh
```

The installer asks for:

1. The DNS-ready domain, without `https://`.
2. The Discord bot token.
3. The Discord application ID.
4. The DatHost account email.
5. The DatHost account password.
6. The DatHost template server ID.

The installer then:

- Installs Docker Engine and Docker Compose when missing.
- Installs Caddy when missing.
- Generates PostgreSQL, signing, and encryption secrets.
- Writes `.env` with file mode `600`.
- Configures automatic HTTPS.
- Builds the bot image.
- Starts PostgreSQL.
- Applies database migrations.
- Seeds the default game profile.
- Registers Discord slash commands.
- Starts the bot.
- Checks local and public readiness.

A successful installation ends with:

```text
10Man bot deployment is ready at https://your-domain
Next: run /match admin setup in Discord.
```

The installer automatically reuses an existing `.env` when rerun. Do not delete that file unless you intentionally plan to replace the database and cryptographic keys.

## 8. Check the server installation

Show running containers:

```bash
sudo docker compose ps
```

Check bot logs:

```bash
sudo docker compose logs --tail=100 app
```

Check HTTPS readiness:

```bash
curl https://10man.example.com/health/ready
```

Expected response:

```json
{ "status": "ready" }
```

If HTTPS fails but the application is running, check Caddy:

```bash
sudo journalctl -u caddy -n 100 --no-pager
```

## 9. Wait for Discord commands

The installer registers global slash commands. Discord may take a short time to show a newly registered global command.

In the target Discord server, type:

```text
/match admin status
```

If `/match` does not appear, confirm the bot was invited with the `applications.commands` scope and inspect the installer or application logs.

## 10. Create the Discord channels automatically

As a native Discord administrator, run:

```text
/match admin setup
```

For a new server, provide:

- `privileged_role`: the role allowed to create matches.
- `moderator_role`: the moderator role.
- `administrator_role`: the bot administrator role.
- `dathost_template_server_id`: the protected DatHost template ID.
- `dathost_location`: optional; defaults to `dallas`.
- `default_game_profile`: optional; defaults to `competitive_5v5`.

The bot creates:

```text
10Man
├── #10man-lobby
├── Lobby
├── Team 1
└── Team 2
```

The channels inherit the Discord server's normal permissions. Adjust the category's permission overwrites afterward if you want to restrict who can see or join the channels, but preserve the bot permissions listed above.

## 11. Run diagnostics

Run:

```text
/match admin diagnostics
```

Confirm that channels, roles, bot permissions, DatHost template access, managed-resource state, and configuration all report `OK`.

You can also view the saved configuration with:

```text
/match admin status
```

## 12. Link Steam accounts

Each participant runs:

```text
/steam register
```

The bot sends a private Steam verification link. After signing in through Steam, the browser confirms that the account is linked.

Check the link with:

```text
/steam status
```

## 13. Create the first 10man

A member with the configured privileged role runs:

```text
/10man create
```

The persistent match panel appears in `#10man-lobby`. Steam-linked participants can join through the panel. The leader can organize teams, choose a map, lock teams, retrieve connection information, and control the match.

## 14. Common administration commands

```text
/match admin status
/match admin diagnostics
/match admin disable
/match admin enable
/match admin teardown
/match admin recover-setup
```

- **disable** blocks new match creation but does not interrupt an existing match.
- **enable** validates the existing configuration before allowing new matches.
- **teardown** permanently deletes only bot-managed channels after a signed five-minute confirmation. It refuses while a match or cleanup still owns the guild slot.
- **recover-setup** handles interrupted setup. If Discord may have created a channel before its ID was saved, inspect Discord and its audit log, manually remove the ambiguous resource, and then acknowledge recovery. The bot never guesses ownership by channel name.

## 15. Updating the bot

From the repository directory:

```bash
git pull
sudo bash scripts/setup-ubuntu.sh
```

The installer preserves the existing `.env`, rebuilds the image, reapplies pending migrations, reseeds profiles safely, registers current commands, restarts the bot, and verifies readiness.

## Troubleshooting

See:

- [Troubleshooting](troubleshooting.md)
- [Operations Runbook](operations.md)
- [Discord Setup](discord-setup.md)
- [Permissions Matrix](permissions.md)
