import {
  Client,
  Events,
  GatewayIntentBits,
  GuildMemberRoleManager,
  REST,
  Routes,
  type ChatInputCommandInteraction,
  type MessageComponentInteraction,
} from 'discord.js';
import type { PrismaClient } from '../generated/prisma/client.js';
import type { MatchService } from '../services/match-service.js';
import type { SteamLinkService } from '../services/steam-link-service.js';
import { GuildSettingsService } from '../services/guild-settings-service.js';
import type { MatchControlService } from '../services/match-control-service.js';
import type { CredentialCipher } from '../services/credential-cipher.js';
import type { DatHostClient } from '../integrations/dathost/client.js';
import { DiagnosticsService } from '../services/diagnostics-service.js';
import { PanelService } from '../services/panel-service.js';
import { renderMatchPanel } from './panel.js';
import { commands } from './commands.js';
import { buildMatchControls } from './components.js';
import { parseCustomId } from './custom-id.js';
import { assertAuthorized, type ActorContext } from '../domain/authorization.js';

async function fetchAllowedProfiles(
  prisma: PrismaClient,
): Promise<{ key: string; label: string }[]> {
  const profiles = await prisma.gameProfile.findMany({ select: { key: true } });
  return profiles.map((profile) => ({ key: profile.key, label: profile.key }));
}

export interface BotDependencies {
  token: string;
  clientId: string;
  prisma: PrismaClient;
  matchService: MatchService;
  steamLinkService: SteamLinkService;
  matchControlService: MatchControlService;
  dathost: DatHostClient;
  cipher: CredentialCipher;
  componentSigningSecret: string;
}

export async function registerCommands(token: string, clientId: string): Promise<void> {
  const rest = new REST().setToken(token);
  await rest.put(Routes.applicationCommands(clientId), { body: commands });
}

export function createDiscordClient(dependencies: BotDependencies): Client {
  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
  });
  const guildSettingsService = new GuildSettingsService(dependencies.prisma, client);
  client.on(Events.InteractionCreate, (interaction) => {
    if (!interaction.isChatInputCommand() && !interaction.isMessageComponent()) return;
    const operation = interaction.isChatInputCommand()
      ? handleCommand(interaction, dependencies, client, guildSettingsService)
      : handleComponent(interaction, dependencies, dependencies.matchControlService);
    void operation.catch(async () => {
      const message = {
        content: 'The action could not be completed. Refresh `/10man status` and try again.',
        ephemeral: true,
      } as const;
      if (interaction.deferred || interaction.replied) await interaction.followUp(message);
      else await interaction.reply(message);
    });
  });
  return client;
}

async function handleCommand(
  interaction: ChatInputCommandInteraction,
  dependencies: BotDependencies,
  client: Client,
  guildSettingsService: GuildSettingsService,
): Promise<void> {
  if (interaction.guildId === null) throw new Error('Guild command required');
  if (interaction.commandName === 'steam' && interaction.options.getSubcommand() === 'register') {
    const challenge = await dependencies.steamLinkService.createChallenge(interaction.user.id);
    await interaction.reply({
      content: `Verify Steam ownership: ${challenge.startUrl.toString()}`,
      ephemeral: true,
    });
    return;
  }
  if (interaction.commandName === 'steam' && interaction.options.getSubcommand() === 'status') {
    const identity = await dependencies.prisma.steamIdentity.findFirst({
      where: { discordUserId: interaction.user.id, invalidatedAt: null },
      select: { steamId64: true, verifiedAt: true },
    });
    await interaction.reply({
      content:
        identity === null
          ? 'No verified Steam account.'
          : `Verified SteamID64: ${identity.steamId64}`,
      ephemeral: true,
    });
    return;
  }
  if (interaction.commandName === '10man' && interaction.options.getSubcommand() === 'create') {
    const settings = await dependencies.prisma.guildSettings.findUnique({
      where: { guildId: interaction.guildId },
    });
    const roles = interaction.member?.roles;
    const memberRoles =
      roles === undefined
        ? []
        : roles instanceof GuildMemberRoleManager
          ? [...roles.cache.keys()]
          : roles;
    if (
      settings === null ||
      !memberRoles.some((role) =>
        [
          ...settings.privilegedRoleIds,
          ...settings.moderatorRoleIds,
          ...settings.administratorRoleIds,
        ].includes(role),
      )
    ) {
      throw new Error('Privileged role required');
    }
    const matchId = await dependencies.matchService.create({
      guildId: interaction.guildId,
      leaderDiscordUserId: interaction.user.id,
      displayName: interaction.user.globalName ?? interaction.user.username,
      correlationId: interaction.id,
    });
    if (interaction.channel !== null) {
      const panelService = new PanelService(
        dependencies.prisma,
        client,
        dependencies.componentSigningSecret,
      );
      await panelService.publishInitialPanel(matchId, interaction.channel);
    }
    await interaction.reply({ content: `10man created: ${matchId}`, ephemeral: true });
    return;
  }
  if (interaction.commandName === '10man' && interaction.options.getSubcommand() === 'cancel') {
    const match = await dependencies.matchService.findGuildMatch(interaction.guildId);
    if (match === null) throw new Error('No active match');
    const actor = await createActorContext(interaction, match.id, dependencies.prisma);
    await dependencies.matchService.cancel(match.id, actor, interaction.id);
    await interaction.reply({
      content: 'The match was canceled. Cleanup status is available in `/10man status`.',
    });
    return;
  }
  if (interaction.commandName === '10man' && interaction.options.getSubcommand() === 'status') {
    const match = await dependencies.matchService.findGuildMatch(interaction.guildId);
    if (match === null) {
      await interaction.reply({ content: 'There is no active 10man.', ephemeral: true });
      return;
    }
    const panel = renderMatchPanel({
      matchId: match.id,
      leaderMention: `<@${match.leaderDiscordUserId}>`,
      state: match.state,
      cleanupStatus: match.cleanupStatus,
      map: match.selectedMap,
      profile: match.selectedGameProfileKey,
      readyCount: match.players.filter((player) => player.readyState === 'READY').length,
      totalCount: match.players.length,
      team1: match.players
        .filter((player) => player.team === 'TEAM_1')
        .map((player) => player.displayNameSnapshot),
      team2: match.players
        .filter((player) => player.team === 'TEAM_2')
        .map((player) => player.displayNameSnapshot),
      score: null,
    });
    const allowedProfiles = await fetchAllowedProfiles(dependencies.prisma);
    await interaction.reply({
      embeds: [panel],
      components: buildMatchControls({
        matchId: match.id,
        version: match.version,
        state: match.state,
        allowedMaps: match.profile.mapAllowlist,
        allowedProfiles,
        secret: dependencies.componentSigningSecret,
      }),
      ephemeral: true,
    });
    return;
  }
  if (interaction.commandName === 'match') {
    const subcommand = interaction.options.getSubcommand();
    if (subcommand === 'transfer') {
      const target = interaction.options.getUser('player', true);
      const match = await dependencies.matchService.findGuildMatch(interaction.guildId);
      if (match === null) throw new Error('No active match');
      const actor = await createActorContext(interaction, match.id, dependencies.prisma);
      await dependencies.matchService.transferLeader(match.id, target.id, actor, interaction.id);
      await interaction.reply({
        content: `Leader transferred to <@${target.id}>.`,
        ephemeral: true,
      });
      return;
    }
    if (subcommand === 'remove') {
      const target = interaction.options.getUser('player', true);
      const match = await dependencies.matchService.findGuildMatch(interaction.guildId);
      if (match === null) throw new Error('No active match');
      const actor = await createActorContext(interaction, match.id, dependencies.prisma);
      await dependencies.matchService.removeParticipant(match.id, target.id, actor, interaction.id);
      await interaction.reply({
        content: `<@${target.id}> removed from the match.`,
        ephemeral: true,
      });
      return;
    }
  }

  if (interaction.commandName === 'match' && interaction.options.getSubcommandGroup() === 'admin') {
    const subcommand = interaction.options.getSubcommand();
    if (subcommand === 'status') {
      const settings = await dependencies.prisma.guildSettings.findUnique({
        where: { guildId: interaction.guildId },
      });
      if (settings === null) {
        await interaction.reply({
          content: 'This server is not configured. Use `/match admin configure`.',
          ephemeral: true,
        });
        return;
      }
      await interaction.reply({
        content:
          `10man configured: ${settings.enabled ? 'enabled' : 'disabled'}\n` +
          `Template: ${settings.dathostTemplateServerId ?? 'unset'}\n` +
          `Location: ${settings.defaultServerLocation ?? 'unset'}\n` +
          `Profile: ${settings.defaultGameProfileKey ?? 'unset'}`,
        ephemeral: true,
      });
      return;
    }
    if (subcommand === 'configure') {
      const adminActor = await createActorContext(interaction, '', dependencies.prisma);
      assertAuthorized('CONFIGURE_GUILD', adminActor);
      const lobbyTextChannel = interaction.options.getChannel('lobby_text_channel', true);
      const lobbyVoiceChannel = interaction.options.getChannel('lobby_voice_channel', true);
      const team1VoiceChannel = interaction.options.getChannel('team1_voice_channel', true);
      const team2VoiceChannel = interaction.options.getChannel('team2_voice_channel', true);
      const privilegedRole = interaction.options.getRole('privileged_role', true);
      const moderatorRole = interaction.options.getRole('moderator_role', true);
      const administratorRole = interaction.options.getRole('administrator_role', true);
      const defaultServerLocation = interaction.options.getString('dathost_location') ?? undefined;
      const defaultGameProfileKey =
        interaction.options.getString('default_game_profile') ?? undefined;
      await guildSettingsService.update({
        guildId: interaction.guildId,
        actorDiscordUserId: interaction.user.id,
        correlationId: interaction.id,
        lobbyTextChannelId: lobbyTextChannel.id,
        lobbyVoiceChannelId: lobbyVoiceChannel.id,
        team1VoiceChannelId: team1VoiceChannel.id,
        team2VoiceChannelId: team2VoiceChannel.id,
        privilegedRoleIds: [privilegedRole.id],
        moderatorRoleIds: [moderatorRole.id],
        administratorRoleIds: [administratorRole.id],
        dathostTemplateServerId: interaction.options.getString('dathost_template_server_id', true),
        ...(defaultServerLocation === undefined ? {} : { defaultServerLocation }),
        ...(defaultGameProfileKey === undefined ? {} : { defaultGameProfileKey }),
      });
      await interaction.reply({ content: '10man configuration saved.', ephemeral: true });
      return;
    }
    if (subcommand === 'diagnostics') {
      const adminActor = await createActorContext(interaction, '', dependencies.prisma);
      assertAuthorized('DIAGNOSTICS', adminActor);
      const report = await new DiagnosticsService(
        dependencies.prisma,
        client,
        dependencies.dathost,
      ).runGuildDiagnostics(interaction.guildId);
      await interaction.reply({
        content: formatDiagnosticsReport(report),
        ephemeral: true,
      });
      return;
    }
  }

  await interaction.reply({
    content: 'This command is not available in the current state.',
    ephemeral: true,
  });
}

async function handleComponent(
  interaction: MessageComponentInteraction,
  dependencies: BotDependencies,
  matchControlService: MatchControlService,
): Promise<void> {
  if (interaction.guildId === null) throw new Error('Guild interaction required');
  const payload = parseCustomId(interaction.customId, dependencies.componentSigningSecret);
  const match = await dependencies.matchService.findGuildMatch(interaction.guildId);
  if (match === null || match.id !== payload.matchId) throw new Error('Match is no longer active');
  const actor = await createActorContext(interaction, match.id, dependencies.prisma);
  const displayName = interaction.user.globalName ?? interaction.user.username;
  const authContext = {
    leaderDiscordUserId: match.leaderDiscordUserId,
    state: match.state,
  };

  if (payload.action === 'JOIN') {
    await dependencies.matchService.join({
      matchId: match.id,
      discordUserId: interaction.user.id,
      displayName,
      correlationId: interaction.id,
    });
  } else if (payload.action === 'LEAVE') {
    await dependencies.matchService.leave(match.id, actor, interaction.id);
  } else if (payload.action === 'RANDOMIZE_TEAMS') {
    await dependencies.matchService.randomizeTeams(
      match.id,
      actor,
      payload.version,
      interaction.id,
    );
  } else if (payload.action === 'LOCK_TEAMS') {
    await dependencies.matchService.lockTeams(match.id, actor, payload.version, interaction.id);
  } else if (payload.action === 'SELECT_MAP' && interaction.isStringSelectMenu()) {
    const mapName = interaction.values[0];
    if (mapName === undefined) throw new Error('Map selection is missing');
    await dependencies.matchService.selectMap(
      match.id,
      mapName,
      actor,
      payload.version,
      interaction.id,
    );
  } else if (payload.action === 'SELECT_PROFILE' && interaction.isStringSelectMenu()) {
    const profileKey = interaction.values[0];
    if (profileKey === undefined) throw new Error('Profile selection is missing');
    assertAuthorized('SELECT_PROFILE', actor, authContext);
    await dependencies.matchService.selectProfile(
      match.id,
      profileKey,
      actor,
      payload.version,
      interaction.id,
    );
  } else if (
    (payload.action === 'ASSIGN_TEAM_1' || payload.action === 'ASSIGN_TEAM_2') &&
    interaction.isUserSelectMenu()
  ) {
    const target = interaction.values[0];
    if (target === undefined) throw new Error('Player selection is missing');
    await dependencies.matchService.assignTeam(
      match.id,
      target,
      payload.action === 'ASSIGN_TEAM_1' ? 'TEAM_1' : 'TEAM_2',
      actor,
      payload.version,
      interaction.id,
    );
  } else if (payload.action === 'READY' || payload.action === 'UNREADY') {
    assertAuthorized('READY', actor, authContext);
    await dependencies.matchService.setReady(
      match.id,
      actor,
      payload.action === 'READY',
      interaction.id,
    );
  } else if (payload.action === 'GET_CONNECT_INFO') {
    assertAuthorized('VIEW', actor, authContext);
    const matchWithConnection = await dependencies.prisma.match.findUnique({
      where: { id: match.id },
      select: {
        dathostIp: true,
        dathostPort: true,
        dathostServerId: true,
        encryptedJoinPassword: true,
      },
    });
    if (
      matchWithConnection === null ||
      matchWithConnection.dathostServerId === null ||
      matchWithConnection.dathostIp === null ||
      matchWithConnection.dathostPort === null ||
      matchWithConnection.encryptedJoinPassword === null
    )
      throw new Error('Connection info is not available yet');
    const password = dependencies.cipher.decrypt(
      matchWithConnection.encryptedJoinPassword,
      `join:${match.id}:${matchWithConnection.dathostServerId}`,
    );
    await interaction.reply({
      content: `\`connect ${matchWithConnection.dathostIp}:${String(matchWithConnection.dathostPort)}; password ${password}\``,
      ephemeral: true,
    });
    return;
  } else if (payload.action === 'FORCE_START') {
    assertAuthorized('START_MATCH', actor, authContext);
    await matchControlService.forceStart(match.id, interaction.user.id, interaction.id);
  } else if (payload.action === 'PAUSE') {
    assertAuthorized('PAUSE', actor, authContext);
    await matchControlService.pause(match.id, interaction.user.id, interaction.id);
  } else if (payload.action === 'RESUME') {
    assertAuthorized('RESUME', actor, authContext);
    await matchControlService.resume(match.id, interaction.user.id, interaction.id);
  } else if (payload.action === 'FORCE_END') {
    assertAuthorized('STOP', actor, authContext);
    await matchControlService.forceEnd(match.id, interaction.user.id, interaction.id);
  } else if (payload.action === 'RESTORE_ROUND' && interaction.isStringSelectMenu()) {
    assertAuthorized('RESTORE', actor, authContext);
    const roundValue = interaction.values[0];
    if (roundValue === undefined) throw new Error('Round selection is missing');
    const round = Number.parseInt(roundValue, 10);
    if (Number.isNaN(round)) throw new Error('Invalid round');
    await matchControlService.restoreRound(match.id, round, interaction.user.id, interaction.id);
  } else {
    throw new Error('Unsupported match control');
  }

  await interaction.deferUpdate();
  const updated = await dependencies.matchService.findGuildMatch(interaction.guildId);
  if (updated === null) {
    await interaction.editReply({
      content: 'The match is no longer active.',
      embeds: [],
      components: [],
    });
    return;
  }
  const updatedProfiles = await fetchAllowedProfiles(dependencies.prisma);
  await interaction.editReply({
    embeds: [
      renderMatchPanel({
        matchId: updated.id,
        leaderMention: `<@${updated.leaderDiscordUserId}>`,
        state: updated.state,
        cleanupStatus: updated.cleanupStatus,
        map: updated.selectedMap,
        profile: updated.selectedGameProfileKey,
        readyCount: updated.players.filter((player) => player.readyState === 'READY').length,
        totalCount: updated.players.length,
        team1: updated.players
          .filter((player) => player.team === 'TEAM_1')
          .map((player) => player.displayNameSnapshot),
        team2: updated.players
          .filter((player) => player.team === 'TEAM_2')
          .map((player) => player.displayNameSnapshot),
        score: null,
      }),
    ],
    components: buildMatchControls({
      matchId: updated.id,
      version: updated.version,
      state: updated.state,
      allowedMaps: updated.profile.mapAllowlist,
      allowedProfiles: updatedProfiles,
      secret: dependencies.componentSigningSecret,
    }),
  });
}

function formatDiagnosticsReport(report: {
  configured: boolean;
  enabled: boolean;
  channels: { label: string; ok: boolean; error?: string }[];
  roles: { label: string; ok: boolean; error?: string }[];
  permissions: { label: string; ok: boolean; missing?: string[] }[];
  template?: { id: string; ok: boolean; error?: string };
  activeMatch?: { id: string; state: string; cleanupStatus: string } | null;
}): string {
  if (!report.configured) return 'This server is not configured. Use `/match admin configure`.';
  const status = (ok: boolean) => (ok ? 'OK' : 'FAIL');
  const lines = [`Configuration: ${report.enabled ? 'enabled' : 'disabled'}`];
  lines.push('Channels:');
  for (const channel of report.channels) {
    lines.push(
      `  ${channel.label}: ${status(channel.ok)}${channel.error ? ` (${channel.error})` : ''}`,
    );
  }
  lines.push('Roles:');
  for (const role of report.roles) {
    lines.push(`  ${role.label}: ${status(role.ok)}${role.error ? ` (${role.error})` : ''}`);
  }
  lines.push('Bot permissions:');
  for (const permission of report.permissions) {
    lines.push(
      `  ${permission.label}: ${status(permission.ok)}${permission.missing ? ` (missing: ${permission.missing.join(', ')})` : ''}`,
    );
  }
  if (report.template !== undefined) {
    lines.push(
      `Template server: ${status(report.template.ok)}${report.template.error ? ` (${report.template.error})` : ''}`,
    );
  }
  if (report.activeMatch !== undefined) {
    lines.push(
      `Active match: ${report.activeMatch === null ? 'none' : `${report.activeMatch.state} (cleanup: ${report.activeMatch.cleanupStatus})`}`,
    );
  }
  return lines.join('\n');
}

async function createActorContext(
  interaction: MessageComponentInteraction | ChatInputCommandInteraction,
  matchId: string,
  prisma: PrismaClient,
): Promise<ActorContext> {
  if (interaction.guildId === null) throw new Error('Guild interaction required');
  const [settings, participant] = await Promise.all([
    prisma.guildSettings.findUnique({ where: { guildId: interaction.guildId } }),
    prisma.matchPlayer.findUnique({
      where: { matchId_discordUserId: { matchId, discordUserId: interaction.user.id } },
      select: { id: true },
    }),
  ]);
  if (settings === null) throw new Error('Guild is not configured');
  const roles = interaction.member?.roles;
  const memberRoles =
    roles === undefined
      ? []
      : roles instanceof GuildMemberRoleManager
        ? [...roles.cache.keys()]
        : roles;
  const hasRole = (configured: readonly string[]): boolean =>
    memberRoles.some((role) => configured.includes(role));
  return {
    discordUserId: interaction.user.id,
    isParticipant: participant !== null,
    isPrivilegedMember: hasRole(settings.privilegedRoleIds),
    isModerator: hasRole(settings.moderatorRoleIds),
    isAdministrator: hasRole(settings.administratorRoleIds),
  };
}
