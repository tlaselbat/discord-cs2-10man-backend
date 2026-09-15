# Discord CS2 10man Backend

A production-oriented Discord bot and HTTP backend for organizing privileged Counter-Strike 2 10mans on DatHost disposable servers, managed in-game by MatchZy 0.8.15.

## What it does

- A privileged Discord user creates a 10man.
- Ten Steam-linked users join via Discord.
- The leader organizes teams, chooses a map, and locks the roster.
- The bot provisions a disposable DatHost server from a protected template.
- It builds and loads an authenticated MatchZy 0.8.15 config.
- Discord voice channels are reconciled to match the in-game teams.
- Leaders and moderators send semantic MatchZy commands (start, pause, resume, restore, end).
- When the match ends or is cancelled, the bot persists the result, returns players to the lobby voice channel, deletes the disposable server, and releases the guild slot.

## Architecture

See [docs/architecture.md](docs/architecture.md).

## Setup

1. [Discord setup](docs/discord-setup.md)
2. [DatHost template setup](docs/dathost-template-setup.md)
3. [MatchZy integration](docs/matchzy-integration.md)
4. [Configuration reference](docs/configuration.md)
5. [Permissions matrix](docs/permissions.md)

## Run locally

```bash
cp .env.example .env
# edit .env with your credentials
corepack pnpm install
corepack pnpm prisma migrate dev
corepack pnpm prisma db seed
corepack pnpm build
corepack pnpm start
```

## Verification

```bash
corepack pnpm format
corepack pnpm typecheck
corepack pnpm lint
corepack pnpm test
corepack pnpm build
corepack pnpm prisma:validate
```

## Deployment

Single Docker host with Docker Compose:

```bash
docker compose up --build -d
```

See [docs/operations.md](docs/operations.md) for production runbooks and [docs/troubleshooting.md](docs/troubleshooting.md) for incident response.

## License

Private — for authorized use only.
