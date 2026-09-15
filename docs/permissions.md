# Permissions Matrix

## Discord roles

| Role              | Purpose                                                                            |
| ----------------- | ---------------------------------------------------------------------------------- |
| Privileged member | Can create a 10man (`/10man create`)                                               |
| Moderator         | Can override match controls, transfer leader, remove participants, run diagnostics |
| Administrator     | Can configure the guild and has full override                                      |

## Match actions

| Action                                       | Participant | Leader | Moderator | Admin   |
| -------------------------------------------- | ----------- | ------ | --------- | ------- |
| View status / connect info                   | yes         | yes    | yes       | yes     |
| Join                                         | yes\*       | yes    | yes       | yes     |
| Leave / ready                                | yes         | yes    | yes       | yes     |
| Create match                                 | no          | no     | no        | yes\*\* |
| Organize teams / select map                  | no          | yes    | yes       | yes     |
| Lock teams                                   | no          | yes    | yes       | yes     |
| Force start / pause / resume / restore / end | no          | yes    | yes       | yes     |
| Cancel match                                 | no          | yes    | yes       | yes     |
| Transfer leader / remove participant         | no          | no     | yes       | yes     |
| Configure guild                              | no          | no     | no        | yes     |
| Run diagnostics                              | no          | no     | yes       | yes     |

\* A participant can leave; an unlinked user cannot join until Steam-verified.  
\*\* Requires the configured privileged role, not the Discord admin permission.

## Bot permissions required in Discord

- View Channels
- Send Messages
- Embed Links
- Read Message History
- Connect
- Speak
- Move Members
- Manage Messages (for panel cleanup)

## DatHost permissions required

- API access with email/password
- Permission to duplicate the configured template
- Permission to stop/delete duplicated servers owned by the bot

The bot never deletes or reconfigures the protected template.
