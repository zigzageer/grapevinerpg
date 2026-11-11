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

`create` makes a town with **zero characters**. Repeating it returns the existing link and preserves the roster. `add` uses the member’s server display name and server avatar by default. A supplied name overrides the display name. `desc` guides the appearance. `use-pfp:false` excludes the avatar; uploaded references remain included. With neither avatar nor upload, generation uses the name and description. Uploads are references for generation, not sprites used directly.

Members with **Manage Server** can create towns and add characters. Optional `GAME_ALLOWED_USER_IDS` lets designated bot owners do this in any server where they and the bot are present. Other users get a permission message. Commands are server-only. One member gets one character per server, and towns support up to 24 characters. Repeating `add` reports the duplicate before generating another image.

## Connect the existing bot

The game repository did not contain a Discord bot. Import the handler into the existing **discord.js v14** bot; do not launch a second connection with the same token. The bot must run Node 22.12+ on its existing persistent host. The frontend remains a static Vite deployment on Vercel.

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

Use the host’s secret settings for:

| Variable                 | Purpose                                                                                |
| ------------------------ | -------------------------------------------------------------------------------------- |
| `GAME_GITHUB_TOKEN`      | Fine-grained GitHub token, restricted to `zigzageer/grapevinerpg`, Contents read/write |
| `OPENAI_API_KEY`         | Image generation API key with access to the configured image model                     |
| `DISCORD_BOT_TOKEN`      | Existing bot token, needed by its runner and command registration                      |
| `DISCORD_APPLICATION_ID` | Existing bot application ID for command registration                                   |
| `GAME_ALLOWED_USER_IDS`  | Optional comma-separated bot-owner Discord IDs                                         |
| `DISCORD_TEST_GUILD_ID`  | Optional single server for initial registration                                        |

Repository, branch, origin, and image model defaults are in `.env.example`. **Never prefix bot secrets with `VITE_`**. The frontend needs none of these variables. For local bot work, copy `.env.example` to `.env` and enter values locally; `.env` is ignored by Git.

Register only the new `/game` command:

```sh
npm run bot:register
```

Registration uses Discord’s single-command POST endpoint, preserving the bot’s other commands. Register with `DISCORD_TEST_GUILD_ID` first; omit it for global commands. If the bot has a startup script that bulk-registers all commands, include the exported `gameCommand` in that script too, or its next restart could remove `/game`. The handler needs only the `Guilds` gateway intent; it does not require Message Content or bulk member access.

For a bot application that has no existing runner, the optional runner is:

```sh
npm run bot:start
```

This is a persistent Discord Gateway process; run it on a bot host, rather than in the Vercel static build. An existing bot that receives interactions through HTTP needs an adapter in its current interaction router instead of this Gateway runner.

### Ubuntu Jackbox bot

The Ubuntu Jackbox bot uses `createUbuntuGameHandler` from `bot/ubuntu-adapter.mjs`. Its existing `CODEX_OWNER_ID` is included in the allowed game managers. The adapter initializes game services on first use and replies privately if the GitHub configuration is incomplete.

The installed modules live in `/opt/jackbox/repo/bot/src/rpg/`. The bot’s `src/commands.js` appends `gameDefinition` to its command definitions and routes `/game` to the adapter before checking the streaming session. `/game` is registered globally so the bot can serve each Discord server. The bot’s dependency lockfile includes `sharp` for sprite processing.

## Data and deployment

1. The handler acknowledges the interaction privately before network work.
2. `create` commits an empty manifest. `add` checks the roster, downloads selected references from Discord’s CDN, and generates one transparent paper-cutout character.
3. `sharp` crops the transparent margins and bounds the PNG to 384 × 460 pixels and under 1 MB.
4. The PNG and updated roster are committed together through GitHub’s Git Data API. Non-fast-forward ref updates retry against the newest commit without forcing the branch or losing other characters.
5. Vercel’s existing Git integration builds `main`. The command returns the link and explains that publishing is still in progress; it does not claim the deployment is ready.
6. An open server page checks the deployed manifest every 15 seconds and on focus. New characters join the picker without resetting the current player’s position or camera.

The repository and games are public: roster names, Discord member IDs and generated sprites are published in Git. Raw reference images, avatar URLs, descriptions, and tokens are not written to the roster. Each browser’s selected character, position, and TV setting use a save key scoped to the guild ID. Published server rosters are authoritative; the browser workshop remains available for the original Mint game.

The single bot process rejects overlapping updates in the same server. Git ref conflict retries also preserve changes from other processes. A bot restart during generation may require retrying the command; this version uses the existing bot process, not a durable job queue. Image generation and GitHub writes must both succeed before a character becomes part of the roster. The handler reports provider failures without logging credentials or raw responses.

## Validation

```sh
npm run build
npm test
npm run test:bot
npm run test:e2e
```

Bot tests use injected HTTP responses and generated local test pixels, with no API charges or remote commits. Browser tests cover the original game plus empty rosters, new characters, separate server saves, failed loads, roster refreshes, and mobile layouts. A live `/game` test still requires the actual bot integration, credentials on its host, command registration, and a successful Vercel deployment.

API references: [Discord commands](https://docs.discord.com/developers/interactions/application-commands), [Discord interaction responses](https://docs.discord.com/developers/interactions/receiving-and-responding), [GitHub Git Data](https://docs.github.com/en/rest/git), [OpenAI image generation](https://developers.openai.com/api/docs/guides/image-generation).
