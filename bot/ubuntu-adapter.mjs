import { configuredGameHandler, gameCommand } from "./game-command.mjs";

export const gameDefinition = {
  ...gameCommand,
  default_member_permissions: null,
  dm_permission: false,
};

// Configure on first use so missing game credentials cannot prevent the existing
// Discord bot from starting. Reuse the bot's configured owner across servers.
export function createUbuntuGameHandler({
  ownerId,
  env = process.env,
  configure = configuredGameHandler,
} = {}) {
  let handler;
  return async (interaction) => {
    if (!handler) {
      try {
        handler = configure({
          ...env,
          GAME_ALLOWED_USER_IDS: [env.GAME_ALLOWED_USER_IDS, ownerId]
            .filter(Boolean)
            .join(","),
        });
      } catch {
        await interaction.reply({
          content:
            "Server games are waiting for the bot owner to finish setup.",
          flags: 64,
          allowedMentions: { parse: [] },
        });
        return true;
      }
    }
    return handler(interaction);
  };
}
