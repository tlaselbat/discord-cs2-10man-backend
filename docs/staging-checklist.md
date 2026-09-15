# Staging Acceptance Checklist

## Environment

- [ ] PostgreSQL reachable via `DATABASE_URL`
- [ ] Migrations applied with `pnpm prisma migrate deploy`
- [ ] Seed profiles present with `pnpm prisma db seed`
- [ ] Public HTTPS URL configured and reachable
- [ ] Docker Compose healthcheck passes
- [ ] Node 22 container verified

## Discord

- [ ] Bot invited with correct scopes and permissions
- [ ] Guild has lobby text channel, lobby voice, Team 1 voice, Team 2 voice
- [ ] Privileged, moderator, and administrator roles assigned
- [ ] `/match admin configure` succeeds with all channel/role inputs

## Steam

- [ ] Ten test Discord accounts with verified SteamID64 links
- [ ] `/steam register` + callback works for each
- [ ] `/steam status` shows correct SteamID64

## Lifecycle

- [ ] `/10man create` posts a persistent panel
- [ ] Ten participants join
- [ ] Teams organized manually and via randomize
- [ ] Map selected
- [ ] Teams lock transactionally
- [ ] DatHost destination created from protected template
- [ ] Server boots (`booting=false`)
- [ ] MatchZy config loads successfully
- [ ] CS2 team membership matches backend teams
- [ ] Discord voice moves to Team 1 / Team 2 channels
- [ ] MatchZy goes live
- [ ] Pause, resume, restore round, and force end controls work
- [ ] Final result persisted

## Recovery and safety

- [ ] Missed `series_end` webhook recovered via `MATCHZY_RECONCILE`
- [ ] Restart mid-provisioning resumes correctly
- [ ] Restart mid-match reconciles voice and panel
- [ ] Uncertain DatHost duplicate response does not create a second server
- [ ] Cleanup returns users to lobby voice
- [ ] Disposable server deleted
- [ ] Guild slot released
- [ ] Protected template remains untouched
- [ ] Orphan scanner reports no unexpected servers

## Sign-off

- [ ] All unit/integration tests pass
- [ ] Build succeeds
- [ ] No secret leakage in logs or responses
- [ ] Operations and troubleshooting runbooks reviewed
