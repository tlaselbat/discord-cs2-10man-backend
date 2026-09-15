CREATE TYPE "ManagedResourceState" AS ENUM ('NONE', 'SETTING_UP', 'ACTIVE', 'TEARING_DOWN');

CREATE TYPE "ManagedSetupStep" AS ENUM (
  'RESERVED',
  'CATEGORY_CREATE_IN_FLIGHT',
  'CATEGORY_CREATED',
  'LOBBY_TEXT_CREATE_IN_FLIGHT',
  'LOBBY_TEXT_CREATED',
  'LOBBY_VOICE_CREATE_IN_FLIGHT',
  'LOBBY_VOICE_CREATED',
  'TEAM1_VOICE_CREATE_IN_FLIGHT',
  'TEAM1_VOICE_CREATED',
  'TEAM2_VOICE_CREATE_IN_FLIGHT',
  'TEAM2_VOICE_CREATED'
);

ALTER TABLE "guild_settings"
  ADD COLUMN "managed_resource_state" "ManagedResourceState" NOT NULL DEFAULT 'NONE',
  ADD COLUMN "managed_setup_step" "ManagedSetupStep",
  ADD COLUMN "managed_attempt_id" UUID,
  ADD COLUMN "managed_category_id" TEXT,
  ADD COLUMN "managed_channel_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "managed_resources_created_at" TIMESTAMP(3);
