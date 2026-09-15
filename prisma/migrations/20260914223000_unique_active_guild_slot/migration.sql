DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "matches"
    WHERE "guild_slot_active" = true
    GROUP BY "guild_id"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot enforce one active match per guild: duplicate active guild slots exist';
  END IF;
END $$;

CREATE UNIQUE INDEX "matches_one_active_slot_per_guild"
ON "matches" ("guild_id")
WHERE "guild_slot_active" = true;
