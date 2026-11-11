import { Client, Events, GatewayIntentBits } from "discord.js";
import { configuredGameHandler } from "./game-command.mjs";

// Optional standalone runner. Existing bots should import the handler instead
// of opening a second Gateway connection for the same bot application.
if (!process.env.DISCORD_BOT_TOKEN)
  throw new Error("Set DISCORD_BOT_TOKEN on the bot host.");
const handleGame = configuredGameHandler();
const client = new Client({ intents: [GatewayIntentBits.Guilds] });
client.once(Events.ClientReady, () =>
  console.log("Game commands connected to Discord."),
);
client.on(Events.InteractionCreate, (interaction) => {
  void handleGame(interaction).catch(() =>
    console.error("Could not acknowledge a Discord game command."),
  );
});
await client.login(process.env.DISCORD_BOT_TOKEN);
for (const signal of ["SIGINT", "SIGTERM"])
  process.once(signal, () => client.destroy());
