import { createRemoteJWKSet, jwtVerify } from "jose";

export function createVercelVerifier({
  teamSlug,
  teamId,
  projectName,
  projectId,
  jwks,
}) {
  const issuer = `https://oidc.vercel.com/${teamSlug}`;
  const keys =
    jwks ||
    createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks`), {
      timeoutDuration: 5000,
      cooldownDuration: 30_000,
      cacheMaxAge: 600_000,
    });
  return async (token) => {
    if (typeof token !== "string" || token.length > 8192) return false;
    try {
      const { payload } = await jwtVerify(token, keys, {
        issuer,
        audience: `https://vercel.com/${teamSlug}`,
        subject: `owner:${teamSlug}:project:${projectName}:environment:production`,
        algorithms: ["RS256"],
        requiredClaims: ["exp", "iat"],
        clockTolerance: 5,
        maxTokenAge: "65m",
      });
      return (
        payload.owner_id === teamId &&
        payload.project_id === projectId &&
        payload.environment === "production"
      );
    } catch {
      return false;
    }
  };
}
