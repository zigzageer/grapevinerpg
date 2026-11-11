import { MAX_BODY, bridgeRequest, canonicalIp } from "./bridge.mjs";

const gameId = "(?:mint|[0-9]{17,20})";
const characterId = "[A-Za-z0-9_-]{1,80}";
const uuid = "[a-f0-9-]{36}";
const readRoute = new RegExp(
  `^/(?:health|quota|drafts/${gameId}|games/${gameId}|games/${gameId}/characters/${characterId}/history|jobs/${uuid}|assets/${uuid}\\.png)$`,
);
const writeRoute = new RegExp(
  `^/(?:generations|games/${gameId}/characters/${characterId}/apply)$`,
);

export async function studioGateway(
  request,
  { env = process.env, transport = bridgeRequest } = {},
) {
  const json = (error, status) =>
    Response.json(
      { error },
      { status, headers: { "Cache-Control": "no-store" } },
    );
  const url = new URL(request.url);
  // Vercel can serialize catch-all segments into the route query parameter.
  const parameterNames = [...url.searchParams.keys()];
  const segments = url.searchParams.getAll("route");
  const path =
    segments.length === 1
      ? `/${segments[0].replace(/^\/+/, "")}`
      : url.pathname.replace(/^\/api\/studio/, "");
  url.searchParams.delete("route");
  if (
    segments.length > 1 ||
    !(request.method === "GET" ? readRoute : writeRoute).test(path) ||
    !["GET", "POST"].includes(request.method)
  ) {
    console.warn("[studio] Unmatched public route", {
      method: request.method,
      pathname: url.pathname,
      parameterNames,
    });
    return json("Studio endpoint not found.", 404);
  }
  if (!env.MINT_STUDIO_ORIGIN || !env.MINT_STUDIO_CA)
    return json(
      "The character studio is being connected. Please try again shortly.",
      503,
    );
  try {
    if (request.method === "POST") {
      const origin = request.headers.get("origin");
      if (origin && origin !== url.origin)
        return json("Open this game directly to generate a character.", 403);
      if (!request.headers.get("content-type")?.startsWith("application/json"))
        return json("Send a JSON studio request.", 415);
    }
    const token =
      request.headers.get("x-vercel-oidc-token") || env.VERCEL_OIDC_TOKEN;
    if (!token)
      return json(
        "The studio’s project identity is unavailable. Please try again.",
        503,
      );
    const ip = canonicalIp(
      request.headers.get("x-vercel-forwarded-for") ||
        request.headers.get("x-forwarded-for"),
    );
    if (Number(request.headers.get("content-length")) > MAX_BODY)
      return json("Upload a reference image smaller than 2 MB.", 413);
    const chunks = [];
    let size = 0;
    if (request.body) {
      const reader = request.body.getReader();
      try {
        while (true) {
          const item = await reader.read();
          if (item.done) break;
          size += item.value.byteLength;
          if (size > MAX_BODY) {
            await reader.cancel();
            return json("Upload a reference image smaller than 2 MB.", 413);
          }
          chunks.push(Buffer.from(item.value));
        }
      } finally {
        reader.releaseLock();
      }
    }
    const result = await transport({
      origin: env.MINT_STUDIO_ORIGIN,
      token,
      ca: env.MINT_STUDIO_CA.replaceAll("\\n", "\n"),
      method: request.method,
      path,
      ip,
      body: Buffer.concat(chunks),
    });
    return new Response(result.bytes, {
      status: result.status,
      headers: {
        "Content-Type": result.type || "application/json",
        "X-Content-Type-Options": "nosniff",
        "Cache-Control":
          path.startsWith("/assets/") && result.status === 200
            ? "public, max-age=31536000, immutable"
            : "no-store",
      },
    });
  } catch {
    return json(
      "The character studio could not be reached. Please try again.",
      503,
    );
  }
}
