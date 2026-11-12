# Server wars API v1

The Discord bot owns command permissions, challenge messages, and completion notifications. The game service on the VPS owns character links, signup deadlines, simulation, and stored results. The browser reads the same match record to show the lobby and replay.

## Bot connection

Send requests directly to the VPS game service over HTTPS with its configured CA. Use the existing signed bridge format with the dedicated `MINT_MATCH_BOT_SECRET` on the VPS. The headers are `x-mint-ip` (use `127.0.0.1` for bot requests), `x-mint-time` (Unix milliseconds), and `x-mint-signature`. Use `signature({ secret, method, path, ip, timestamp, body })` from `server/bridge.mjs`, with the exact UTF-8 body bytes and an empty buffer for GET. The signature covers the full request path. Keep the secret in the bot and service environment on the VPS.

All Discord IDs are strings. Every POST includes `requestId`, the Discord interaction ID. Retrying an identical request returns its linked character or current match. Reusing a request ID for a different action returns 409. Errors use `{ "error": "..." }`.

## Endpoints

| Method and path | JSON body or result |
| --- | --- |
| `POST /internal/v1/links` | `{ requestId, guildId, userId, characterId }` → `{ guildId, userId, characterId }`. The first version supports the character created for that member with `/game add`, whose ID is `discord-<userId>`. |
| `GET /internal/v1/links/<guildId>/<userId>` | The same link object, or 404. |
| `POST /internal/v1/matches` | For a war send `{ requestId, kind: "war", guildId, userId, opponentGuildId, minPlayersPerSide, manageGuild: true }`. For a duel send `{ requestId, kind: "duel", guildId, userId, opponentUserId }`. Returns the match snapshot. |
| `POST /internal/v1/matches/<matchId>/actions` | `{ requestId, guildId, userId, action, manageGuild? }`. Actions are `accept`, `decline`, `join`, `attack`, and `ability`. Returns the match snapshot. |
| `GET /internal/v1/matches/<matchId>` | Current match snapshot for Discord status and notification polling. |
| `GET /api/studio/matches/<matchId>` | Public match snapshot for the website. The replay page is `/wars/<matchId>`. |

Take `guildId` and `userId` from the verified Discord interaction. Set `manageGuild` from the invoking member’s Discord permission. War challenges, acceptance, and decline require Manage Server. The opponent’s manager accepts in the opposing guild. Duels are accepted by the challenged member in the same guild. The bot owns the list of participating servers and their configured announcement channels.

## Match snapshots

Each snapshot contains `id` (UUID), `kind`, `status`, `createdAt`, `joinUntil`, `minPlayersPerSide`, `sides`, `turnFighterId`, `winnerSide`, `reason`, `events`, and `replayUrl`. Timestamps are Unix milliseconds. `joinUntil` is null until a war is accepted. `winnerSide` is null until a match finishes, then is the zero-based side index. A side has `guildId`, `name`, and `players`. Players have a match-local `id`, `name`, `sprite`, `ability` (display name), `hp`, and `abilityUsed`. Events contain `seq`, `kind`, `actorId`, `targetId`, `move`, `damage`, and `targetHp`.

- Status is `offered`, `signup`, `running`, `finished`, or `cancelled`. Offers expire after ten minutes. A declined offer ends immediately.
- Accepting a war starts a **120-second** signup. `minPlayersPerSide` defaults to two and accepts 1–24. One member can join only one side per match using a linked character. The service finalizes at the deadline, cancels if either side is underfilled, and otherwise simulates the match once. Each standing fighter improves their team's odds in the next exchange. Smaller teams can still win.
- Accepting a duel starts alternating turns. `attack` makes a basic hit. `ability` uses the fighter’s signature move, with Power Strike available for characters without a generated move. Each fighter can use the signature move once in that duel. Match results and replay events come from the service.
- The service advances deadlines on the VPS and when a match is read or updated. Bot restarts can resume polling known match IDs. Persist the Discord channel and message IDs in the bot, and post results once per channel when a match reaches a terminal status.
