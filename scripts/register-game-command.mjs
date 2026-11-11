import { gameCommand } from "../bot/game-command.mjs";

const {
  DISCORD_BOT_TOKEN: token,
  DISCORD_APPLICATION_ID: applicationId,
  DISCORD_TEST_GUILD_ID: guildId,
} = process.env;
if (!token || !/^\d{17,20}$/.test(applicationId || ""))
  throw new Error(
    "Set DISCORD_BOT_TOKEN and DISCORD_APPLICATION_ID on the bot host.",
  );
if (guildId && !/^\d{17,20}$/.test(guildId))
  throw new Error("Invalid DISCORD_TEST_GUILD_ID.");
const command = { ...gameCommand };
if (guildId) {
  delete command.contexts;
  delete command.integration_types;
}
// POST upserts just /game; bulk PUT would delete the existing bot’s other commands.
const response = await fetch(
  `https://discord.com/api/v10/applications/${applicationId}${guildId ? `/guilds/${guildId}` : ""}/commands`,
  {
    method: "POST",
    headers: {
      Authorization: `Bot ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
    signal: AbortSignal.timeout(20_000),
  },
);
if (!response.ok)
  throw new Error(`Discord command registration failed (${response.status}).`);
console.log(
  `Registered /game ${guildId ? "in the test server" : "globally"}. Existing commands were preserved.`,
);
