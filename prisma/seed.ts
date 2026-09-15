import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';

const databaseUrl = process.env.DATABASE_URL;
if (databaseUrl === undefined) throw new Error('DATABASE_URL is required');

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });

await prisma.gameProfile.upsert({
  where: { key: 'competitive_5v5' },
  update: {},
  create: {
    key: 'competitive_5v5',
    enabled: true,
    playersPerTeam: 5,
    numMaps: 1,
    serverSlots: 11,
    mapAllowlist: [
      'de_mirage',
      'de_inferno',
      'de_nuke',
      'de_ancient',
      'de_anubis',
      'de_dust2',
      'de_train',
    ],
    matchzyOptions: { minPlayersToReady: 10, knifeRound: true, mapSide: 'knife' },
    allowedCvars: {},
  },
});

await prisma.gameProfile.upsert({
  where: { key: 'wingman' },
  update: {},
  create: {
    key: 'wingman',
    enabled: false,
    playersPerTeam: 2,
    numMaps: 1,
    serverSlots: 5,
    mapAllowlist: ['de_inferno'],
    matchzyOptions: { minPlayersToReady: 4, knifeRound: true, mapSide: 'knife', wingman: true },
    allowedCvars: {},
  },
});

await prisma.$disconnect();
