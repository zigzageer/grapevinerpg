export function gameConfig(env = process.env) {
  const required = (key) => {
    if (!env[key]?.trim()) throw new Error(`Set ${key} on the bot host.`);
    return env[key].trim();
  };
  const repository = env.GAME_GITHUB_REPOSITORY || "zigzageer/grapevinerpg";
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository))
    throw new Error("Invalid GAME_GITHUB_REPOSITORY.");
  const origin = new URL(
    env.GAME_BASE_URL || "https://adventures-of-mint.vercel.app",
  );
  if (origin.protocol !== "https:" || origin.pathname !== "/")
    throw new Error("GAME_BASE_URL must be an HTTPS origin.");
  return {
    repository,
    branch: env.GAME_GITHUB_BRANCH || "main",
    token: required("GAME_GITHUB_TOKEN"),
    baseUrl: origin.origin,
    openaiKey: env.OPENAI_API_KEY,
    imageModel: env.GAME_IMAGE_MODEL || "gpt-image-2.6-flare",
    allowedUserIds: new Set(
      (env.GAME_ALLOWED_USER_IDS || "")
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean),
    ),
  };
}
