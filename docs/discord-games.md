# Discord server games

Each Discord server has a roster at `public/games/<guild-id>/game.json` and a public game link such as `https://adventures-of-mint.vercel.app/mints-lounge-123456789012345678`. The ID prevents collisions between servers with the same name. Once created, a link stays stable even if the server is renamed. The root URL keeps the original Adventures of Mint cast and workshop.

## Commands

```text
/game create
/game add user:@Bob
/game add user:@Bob name:Wizard Bob desc:Purple coat and a pointed hat
/game add user:@Bob use-pfp:false desc:A cheerful robot in a red scarf
/game add user:@Bob image:<uploaded reference> use-pfp:false
```

`create` makes a town with **zero characters**. Repeating it returns the existing link and preserves the roster. `add` uses the member’s server display name and server avatar by default. A supplied name overrides the display name. `desc` guides the appearance. `use-pfp:false` excludes the avatar; uploaded references remain included. With neither avatar nor upload, generation uses the name and description. Uploads guide the generated appearance.

Members with **Manage Server** can create towns and add characters. Optional `GAME_ALLOWED_USER_IDS` lets designated bot owners do this in any server where they and the bot are present. Other users get a permission message. Commands are server-only. One member gets one character per server, and towns support up to 24 characters. Repeating `add` reports the duplicate before generating another image.

## Connect the existing bot

Import the handler into the existing **discord.js v14** bot. The bot runs Node 22.12+ on its persistent Ubuntu host. The frontend is a static Vite deployment on Vercel.

Install this repository’s dependencies (`npm ci`), or bring the `bot/` modules plus `sharp` into the bot’s existing project, then wire its interaction handler:

```js
import { configuredGameHandler } from "./bot/game-command.mjs";

const handleGame = configuredGameHandler();
client.on("interactionCreate", async (interaction) => {
  if (interaction.isChatInputCommand() && interaction.commandName === "game") {
    await handleGame(interaction);
    return;
  }
  // Existing command routing continues here.
});
```

Configure the existing bot host with the following values.

| Variable                 | Purpose                                                           |
| ------------------------ | ----------------------------------------------------------------- |
| `CODEX_ENABLED`          | Existing VPS repair worker enable flag, set to `true`             |
| `CODEX_BIN`              | Existing Codex CLI executable                                     |
| `CODEX_HOME`             | Existing Codex directory containing the saved ChatGPT login       |
| `DISCORD_BOT_TOKEN`      | Existing bot token, needed by its runner and command registration |
| `DISCORD_APPLICATION_ID` | Existing bot application ID for command registration              |
| `GAME_ALLOWED_USER_IDS`  | Optional comma-separated bot-owner Discord IDs                    |
| `DISCORD_TEST_GUILD_ID`  | Optional single server for initial registration                   |

Repository, branch, and origin defaults are in `.env.example`. The game worker uses the VPS Codex CLI’s saved ChatGPT login for native image generation and its connected GitHub and Vercel apps for publishing. Those apps must be available in the Codex session. Project, team, and repository IDs are configurable through the `GAME_VERCEL_*` and `GAME_GITHUB_REPOSITORY_ID` values in `.env.example`. For local bot work, copy `.env.example` to `.env` and configure the existing Codex executable and login directory. Keep bot secrets in the host configuration.

Register only the new `/game` command:

```sh
npm run bot:register
```

Registration uses Discord’s single-command POST endpoint, preserving the bot’s other commands. Register with `DISCORD_TEST_GUILD_ID` first; omit it for global commands. If the bot has a startup script that bulk-registers all commands, include the exported `gameCommand` in that script too, or its next restart could remove `/game`. The handler needs only the `Guilds` gateway intent; it does not require Message Content or bulk member access.

For a bot application that has no existing runner, the optional runner is:

```sh
npm run bot:start
```

Run this persistent Discord Gateway process on the bot host. A bot that receives HTTP interactions can invoke the handler from its existing interaction router.

### Ubuntu Jackbox bot

The Ubuntu Jackbox bot uses `createUbuntuGameHandler` from `bot/ubuntu-adapter.mjs`. Its existing `CODEX_OWNER_ID` is included in the allowed game managers. The adapter initializes game services on first use and replies privately if its configuration is invalid.

Character generation and the `/debug` repair alias use the shared process runner in `bot/codex-runner.mjs`. It launches `codex exec` with the saved ChatGPT login, a workspace sandbox, JSON progress, a ten-minute timeout, cancellation, and redacted output. Each image job receives its own temporary workspace and the selected references as local image attachments. The worker saves a PNG through Codex’s native image-generation tool, then the bot validates and crops it. Temporary files are removed after the job. Publishing transactions enable Codex’s automatic approval review for the authorized GitHub and Vercel writes while retaining the workspace sandbox.

The installed modules live in `/opt/jackbox/repo/bot/src/rpg/`. The bot’s `src/commands.js` appends `gameDefinition` and the `/debug` repair alias to its command definitions. It routes `/game` to the adapter before checking the streaming session. `/game` is registered globally so the bot can serve each Discord server. The bot’s dependency lockfile includes `sharp` for sprite processing.

## Data and deployment

1. The handler acknowledges the interaction privately before network work.
2. `create` commits an empty manifest. `add` checks the roster, downloads selected references from Discord’s CDN, and launches the VPS Codex CLI to generate one transparent paper-cutout character.
3. `sharp` crops the transparent margins and bounds the PNG to 384 × 460 pixels and under 1 MB.
4. A bounded Codex transaction uses the connected GitHub app to read a pinned branch snapshot and commit the PNG and updated roster together. A compare-and-swap branch update preserves concurrent repository changes. Conflicts reapply the roster edit against the newest head.
5. The same transaction starts a production build through the connected Vercel app and checks its status. Publishing jobs run serially across servers. The command returns the link and deployment status. If a build fails after GitHub saved the game, `/game create` retries deployment while preserving the roster.
6. An open server page checks the deployed manifest every 15 seconds and on focus. New characters join the picker without resetting the current player’s position or camera.

The public repository contains roster names, Discord member IDs, and generated sprites. Reference images, avatar URLs, descriptions, and credentials stay out of the published roster. Each browser’s selected character, position, and TV setting use a save key scoped to the guild ID. Published server rosters are authoritative; the browser workshop remains available for the original Mint game.

The single bot process rejects overlapping updates in the same server. Git ref conflict retries also preserve changes from other processes. A bot restart during generation may require retrying the command. Jobs run in the existing bot process. Image generation and GitHub writes must both succeed before a character becomes part of the roster. The handler reports generation and deployment failures with credential-safe messages. A saved commit checkpoint and a fresh roster read recover a successful commit if a worker’s final result is interrupted.

## Validation

```sh
npm run build
npm test
npm run test:bot
npm run test:e2e
```

Bot tests use injected HTTP responses, mocked Codex workers, the executable connected-app transaction script, and local test pixels. Shared runner tests cover authentication failures, timeouts, cancellation, child-process termination, and redaction. Browser tests cover the original game plus empty rosters, new characters, separate server saves, failed loads, roster refreshes, and mobile layouts. A live `/game` test requires the bot integration, saved Codex login, connected GitHub and Vercel apps, and command registration.

References include [Discord commands](https://docs.discord.com/developers/interactions/application-commands), [Discord interaction responses](https://docs.discord.com/developers/interactions/receiving-and-responding), [GitHub Git Data](https://docs.github.com/en/rest/git), and [Codex image generation](https://learn.chatgpt.com/docs/image-generation?surface=cli).
